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
import { CreditsService } from '../credits/credits.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SubscriptionPackageEntity } from '../subscriptions/entities/subscription-package.entity';
import { CreditPackageEntity } from '../credits/entities/credit-package.entity';
import { CreateOrderResult } from './interfaces/payments.interface';

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
    const vipPkg: SubscriptionPackageEntity | null =
      await this.subscriptionsService.getPackageByName('vip');
    if (!vipPkg) throw new BadRequestException('Gói VIP không tồn tại');
    const amount = Number(vipPkg.price);

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

    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      this.configService.get<string>('APP_URL');
    const returnUrl = `${backendUrl}/api/payments/vnpay/return`;
    const paymentUrl = this.vnpayService.createPaymentUrl({
      orderId: txnRef,
      amount,
      orderInfo: `Thanh toan VIP 30 ngay - CT ${companyId}`,
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
    packSlug: string,
    req: Request,
  ): Promise<CreateOrderResult> {
    const packs: CreditPackageEntity[] =
      await this.creditsService.getTopupPacks();
    const pack = packs.find((p) => p.slug === packSlug);
    if (!pack) throw new BadRequestException('Gói nạp không hợp lệ');

    const amount = Number(pack.priceVnd);
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

    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      this.configService.get<string>('APP_URL');
    const returnUrl = `${backendUrl}/api/payments/vnpay/return`;
    const paymentUrl = this.vnpayService.createPaymentUrl({
      orderId: txnRef,
      amount,
      orderInfo: `Nap ${totalCredit} Credit - CT ${companyId}`,
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

    // 3. (Removed early check, handled atomically in step 5)

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
      const updateResult = await this.orderRepo.update(
        { id: order.id, paymentStatus: PaymentOrderStatus.PENDING },
        {
          paymentStatus: 'completed', // PaymentOrderStatus.COMPLETED actually
          gatewayTransactionId: transactionNo,
          gatewayResponseData: JSON.stringify(query),
          paidAt: new Date(),
        },
      );

      // Đã xử lý bởi Return URL trước đó
      if (updateResult.affected === 0) {
        return { RspCode: '02', Message: 'Order already completed' };
      }

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
   * Vừa xác thực chữ ký, vừa cập nhật DB nếu IPN chưa kịp gọi (dành cho localhost/dev).
   */
  async processReturnUrl(query: Record<string, string>): Promise<{
    success: boolean;
    message: string;
    orderId?: string;
  }> {
    // 1. Verify chữ ký
    if (!this.vnpayService.verifyReturnUrl(query)) {
      this.logger.error('VNPay Return: Invalid signature');
      return { success: false, message: 'Chữ ký không hợp lệ' };
    }

    const txnRef = query['vnp_TxnRef'];
    const responseCode = query['vnp_ResponseCode'];
    const vnpAmount = parseInt(query['vnp_Amount'] ?? '0', 10) / 100;

    // 2. Tìm đơn hàng
    const order = await this.orderRepo.findOne({
      where: { gatewayOrderId: txnRef },
    });

    if (!order) {
      return { success: false, message: 'Không tìm thấy đơn hàng' };
    }

    // 3. (Removed early check, handled atomically in step 6)

    // 4. Kiểm tra mã phản hồi thành công
    const isSuccess = this.vnpayService.isSuccessResponse(responseCode);
    if (!isSuccess) {
      await this.orderRepo.update(order.id, {
        paymentStatus: 'failed',
        gatewayResponseData: JSON.stringify(query),
      });
      return {
        success: false,
        message: 'Giao dịch không thành công hoặc bị hủy',
        orderId: txnRef,
      };
    }

    // 5. Kiểm tra số tiền
    if (Math.round(order.amount) !== vnpAmount) {
      this.logger.warn(
        `VNPay Return: Amount mismatch. Expected ${order.amount}, got ${vnpAmount}`,
      );
      return { success: false, message: 'Số tiền không khớp', orderId: txnRef };
    }

    // 6. Cập nhật thành công & Fulfilment (Atomic)
    const updateResult = await this.orderRepo.update(
      { id: order.id, paymentStatus: PaymentOrderStatus.PENDING },
      {
        paymentStatus: 'completed',
        gatewayTransactionId: query['vnp_TransactionNo'],
        gatewayResponseData: JSON.stringify(query),
        paidAt: new Date(),
      },
    );

    if (updateResult.affected === 0) {
      // Đã được xử lý bởi IPN
      return {
        success: true,
        message: 'Thanh toán thành công',
        orderId: txnRef,
      };
    }

    try {
      await this.fulfillOrder(order);
    } catch (err) {
      this.logger.error(
        `Fulfill order ${order.id} failed after Return URL`,
        err,
      );
    }

    return {
      success: true,
      message: 'Thanh toán thành công',
      orderId: txnRef,
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
      const packSlug = this.extractPackIdFromTxnRef(order.gatewayOrderId ?? '');
      if (packSlug) {
        await this.creditsService.topupCredit(
          order.companyId,
          packSlug,
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
    // Khi đã bật 'trust proxy', req.ip sẽ tự động lấy từ X-Forwarded-For hoặc remoteAddress
    const ip = req.ip || '127.0.0.1';
    if (ip === '::1' || ip === '::ffff:127.0.0.1') return '127.0.0.1';
    if (ip.startsWith('::ffff:')) return ip.substring(7);
    return ip;
  }
}
