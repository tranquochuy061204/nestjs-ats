import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  PaymentOrderEntity,
  PaymentOrderStatus,
  PaymentOrderType,
} from './entities/payment-order.entity';
import { VnpayService } from './vnpay.service';
import { CreditsService, TopupPackId } from '../credits/credits.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export interface CreateOrderResult {
  orderId: number;
  paymentUrl: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentOrderEntity)
    private readonly orderRepo: Repository<PaymentOrderEntity>,
    private readonly vnpayService: VnpayService,
    private readonly creditsService: CreditsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Tạo đơn mua gói VIP và redirect URL VNPay.
   */
  async createVipOrder(
    companyId: number,
    req: Request,
  ): Promise<CreateOrderResult> {
    // VIP = 499.000 VNĐ — lấy từ package table nếu cần
    const amount = 499_000;

    const order = await this.orderRepo.save(
      this.orderRepo.create({
        companyId,
        orderType: PaymentOrderType.SUBSCRIPTION,
        packageId: null, // sẽ resolve sau
        creditAmount: null,
        amount,
        paymentMethod: 'vnpay',
        paymentStatus: PaymentOrderStatus.PENDING,
      }),
    );

    const txnRef = `VIP-${order.id}-${Date.now()}`;
    await this.orderRepo.update(order.id, { gatewayOrderId: txnRef });

    const returnUrl = `${this.configService.get('APP_URL')}/api/payments/vnpay/return`;
    const paymentUrl = this.vnpayService.createPaymentUrl({
      orderId: txnRef,
      amount,
      orderInfo: `Mua goi VIP 30 ngay - Cong ty ID ${companyId}`,
      returnUrl,
      ipAddr: this.getClientIp(req),
    });

    return { orderId: order.id, paymentUrl };
  }

  /**
   * Tạo đơn nạp Credit và redirect URL VNPay.
   */
  async createCreditTopupOrder(
    companyId: number,
    packId: TopupPackId,
    req: Request,
  ): Promise<CreateOrderResult> {
    const packs = this.creditsService.getTopupPacks();
    const pack = packs.find((p) => p.id === packId);
    if (!pack) throw new BadRequestException('Gói nạp không hợp lệ');

    const totalCredit = pack.creditBase + pack.bonus;

    const order = await this.orderRepo.save(
      this.orderRepo.create({
        companyId,
        orderType: PaymentOrderType.CREDIT_TOPUP,
        packageId: null,
        creditAmount: totalCredit,
        amount: pack.priceVnd,
        paymentMethod: 'vnpay',
        paymentStatus: PaymentOrderStatus.PENDING,
      }),
    );

    const txnRef = `CR-${pack.id}-${order.id}-${Date.now()}`;
    await this.orderRepo.update(order.id, { gatewayOrderId: txnRef });

    const returnUrl = `${this.configService.get('APP_URL')}/api/payments/vnpay/return`;
    const paymentUrl = this.vnpayService.createPaymentUrl({
      orderId: txnRef,
      amount: pack.priceVnd,
      orderInfo: `Nap ${totalCredit} Credit (${packId}) - Cong ty ID ${companyId}`,
      returnUrl,
      ipAddr: this.getClientIp(req),
    });

    return { orderId: order.id, paymentUrl };
  }

  /**
   * Xử lý IPN callback từ VNPay (server-to-server).
   * VNPay yêu cầu response: { RspCode, Message }
   */
  async handleVnpayIpn(
    query: Record<string, string>,
  ): Promise<{ RspCode: string; Message: string }> {
    // 1. Verify signature
    if (!this.vnpayService.verifyReturnUrl(query)) {
      this.logger.warn('VNPay IPN: invalid signature', query);
      return { RspCode: '97', Message: 'Invalid signature' };
    }

    const txnRef = query['vnp_TxnRef'];
    const responseCode = query['vnp_ResponseCode'];
    const transactionNo = query['vnp_TransactionNo'];
    const vnpAmount = parseInt(query['vnp_Amount'] ?? '0', 10) / 100;

    // 2. Tìm đơn hàng
    const order = await this.orderRepo.findOne({
      where: { gatewayOrderId: txnRef },
    });
    if (!order) {
      this.logger.warn(`VNPay IPN: order not found for txnRef=${txnRef}`);
      return { RspCode: '01', Message: 'Order not found' };
    }

    // 3. Kiểm tra đã xử lý chưa (idempotent)
    if (order.paymentStatus === 'completed') {
      return { RspCode: '02', Message: 'Order already completed' };
    }

    // 4. Verify amount
    if (Math.round(order.amount) !== vnpAmount) {
      this.logger.warn(
        `VNPay IPN: amount mismatch. Expected ${order.amount}, got ${vnpAmount}`,
      );
      await this.orderRepo.update(order.id, {
        paymentStatus: PaymentOrderStatus.FAILED,
        gatewayResponseData: JSON.stringify(query),
      });
      return { RspCode: '04', Message: 'Invalid amount' };
    }

    // 5. Cập nhật trạng thái
    if (this.vnpayService.isSuccessResponse(responseCode)) {
      await this.orderRepo.update(order.id, {
        paymentStatus: 'completed',
        gatewayTransactionId: transactionNo,
        gatewayResponseData: JSON.stringify(query),
        paidAt: new Date(),
      });

      // 6. Kích hoạt dịch vụ
      try {
        await this.fulfillOrder(order);
      } catch (err) {
        this.logger.error(`Fulfill order ${order.id} failed`, err);
        // Không fail IPN — đã lưu payment, cần retry fulfillment
      }

      return { RspCode: '00', Message: 'Confirm success' };
    } else {
      await this.orderRepo.update(order.id, {
        paymentStatus: 'failed',
        gatewayResponseData: JSON.stringify(query),
      });
      return { RspCode: '00', Message: 'Confirm success' }; // VNPay vẫn yêu cầu 00
    }
  }

  /**
   * Xử lý Return URL (user redirect về sau thanh toán).
   * Chỉ dùng để verify & hiển thị kết quả cho user.
   */
  verifyReturnUrl(query: Record<string, string>): {
    success: boolean;
    message: string;
    orderId?: string;
  } {
    if (!this.vnpayService.verifyReturnUrl(query)) {
      return { success: false, message: 'Chữ ký không hợp lệ' };
    }

    const success = this.vnpayService.isSuccessResponse(
      query['vnp_ResponseCode'],
    );
    return {
      success,
      message: success
        ? 'Thanh toán thành công'
        : 'Thanh toán thất bại hoặc bị hủy',
      orderId: query['vnp_TxnRef'],
    };
  }

  // ──────────────────────────────────────────────────────
  // Private
  // ──────────────────────────────────────────────────────

  private async fulfillOrder(order: PaymentOrderEntity): Promise<void> {
    if (order.orderType === 'subscription') {
      await this.subscriptionsService.activateVip(order.companyId);
      this.logger.log(
        `VIP activated for company ${order.companyId} via order ${order.id}`,
      );
    } else if (order.orderType === 'credit_topup' && order.creditAmount) {
      const packId = this.extractPackIdFromTxnRef(order.gatewayOrderId ?? '');
      if (packId) {
        await this.creditsService.topupCredit(
          order.companyId,
          packId as TopupPackId,
          order.id,
        );
        this.logger.log(
          `Credit topup ${order.creditAmount} for company ${order.companyId}`,
        );
      }
    }
  }

  private extractPackIdFromTxnRef(txnRef: string): string | null {
    // Format: CR-{packId}-{orderId}-{timestamp}
    const parts = txnRef.split('-');
    if (parts[0] === 'CR' && parts.length >= 3) {
      return parts[1]; // starter | plus | pro | enterprise
    }
    return null;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return req.socket?.remoteAddress ?? '127.0.0.1';
  }
}
