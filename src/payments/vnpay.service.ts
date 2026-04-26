import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface VnpayCreateOrderParams {
  orderId: string;      // vnp_TxnRef
  amount: number;       // VNĐ (sẽ x100 khi gửi VNPay)
  orderInfo: string;    // Mô tả đơn
  returnUrl: string;
  ipAddr: string;
  locale?: 'vn' | 'en';
  orderType?: string;
}

export interface VnpayIpnParams {
  [key: string]: string;
}

@Injectable()
export class VnpayService {
  private readonly logger = new Logger(VnpayService.name);

  private readonly tmnCode: string;
  private readonly hashSecret: string;
  private readonly paymentUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.tmnCode = this.configService.get<string>('VNPAY_TMN_CODE', '');
    this.hashSecret = this.configService.get<string>('VNPAY_HASH_SECRET', '');
    this.paymentUrl = this.configService.get<string>(
      'VNPAY_PAYMENT_URL',
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    );
  }

  /**
   * Tạo URL thanh toán VNPay.
   */
  createPaymentUrl(params: VnpayCreateOrderParams): string {
    const now = new Date();
    const createDate = this.formatDate(now);
    const expireDate = this.formatDate(new Date(now.getTime() + 15 * 60 * 1000)); // 15 phút

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: params.locale ?? 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.orderId,
      vnp_OrderInfo: params.orderInfo,
      vnp_OrderType: params.orderType ?? 'other',
      vnp_Amount: String(Math.round(params.amount) * 100),
      vnp_ReturnUrl: params.returnUrl,
      vnp_IpAddr: params.ipAddr,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    const sortedParams = this.sortObject(vnpParams);
    const signData = new URLSearchParams(sortedParams).toString();
    const secureHash = this.hmacSHA512(this.hashSecret, signData);

    sortedParams['vnp_SecureHash'] = secureHash;

    const queryString = new URLSearchParams(sortedParams).toString();
    return `${this.paymentUrl}?${queryString}`;
  }

  /**
   * Xác thực chữ ký IPN / Return URL từ VNPay.
   * Trả về true nếu hợp lệ.
   */
  verifyReturnUrl(query: VnpayIpnParams): boolean {
    const secureHash = query['vnp_SecureHash'];
    if (!secureHash) return false;

    const params = { ...query };
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    const sortedParams = this.sortObject(params);
    const signData = new URLSearchParams(sortedParams).toString();
    const expectedHash = this.hmacSHA512(this.hashSecret, signData);

    return secureHash === expectedHash;
  }

  /**
   * Kiểm tra response code.
   * '00' = thành công.
   */
  isSuccessResponse(responseCode: string): boolean {
    return responseCode === '00';
  }

  // ──────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────

  private hmacSHA512(secret: string, data: string): string {
    return crypto
      .createHmac('sha512', secret)
      .update(Buffer.from(data, 'utf-8'))
      .digest('hex');
  }

  private sortObject(obj: Record<string, string>): Record<string, string> {
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, string>>((sorted, key) => {
        sorted[key] = obj[key];
        return sorted;
      }, {});
  }

  /** Format: YYYYMMDDHHmmss */
  private formatDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      String(date.getFullYear()) +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }
}
