import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface VnpayCreateOrderParams {
  orderId: string; // vnp_TxnRef
  amount: number; // VNĐ (sẽ x100 khi gửi VNPay)
  orderInfo: string; // Mô tả đơn
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
    this.tmnCode = (
      this.configService.get<string>('VNPAY_TMN_CODE', '') || ''
    ).trim();
    this.hashSecret = (
      this.configService.get<string>('VNPAY_HASH_SECRET', '') || ''
    ).trim();
    this.paymentUrl = (
      this.configService.get<string>(
        'VNPAY_PAYMENT_URL',
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      ) || ''
    ).trim();
  }

  /**
   * Tạo URL thanh toán VNPay.
   */
  createPaymentUrl(params: VnpayCreateOrderParams): string {
    const now = new Date();
    const createDate = this.formatDate(now);
    const expireDate = this.formatDate(
      new Date(now.getTime() + 15 * 60 * 1000),
    ); // 15 phút

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: params.locale ?? 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.orderId,
      vnp_OrderInfo: params.orderInfo,
      vnp_OrderType: params.orderType ?? '190000', // 190000: Mã loại hàng hóa - Thực phẩm - Tiêu dùng (phổ biến nhất)
      vnp_Amount: String(Math.round(params.amount) * 100),
      vnp_ReturnUrl: params.returnUrl,
      vnp_IpAddr: params.ipAddr,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate,
    };

    const sortedParams = this.sortObject(vnpParams);

    // Chuỗi data để băm chữ ký (không chứa vnp_SecureHash)
    const signData = Object.entries(sortedParams)
      .map(([key, val]) => `${key}=${val}`)
      .join('&');

    const secureHash = this.hmacSHA512(this.hashSecret, signData);

    // Chuỗi query params cho URL redirect (SecureHash phải ở cuối)
    return `${this.paymentUrl}?${signData}&vnp_SecureHash=${secureHash}`;
  }

  /**
   * Xác thực chữ ký IPN / Return URL từ VNPay.
   *
   * QUAN TRỌNG: Express đã URL-decode các query params trước khi truyền vào đây.
   * Do đó, cần encode lại theo đúng cách VNPay hash để so sánh.
   * VNPay hash chuỗi với encode: space='+', '(' → '%28', ')' → '%29'
   */
  verifyReturnUrl(query: VnpayIpnParams): boolean {
    const secureHash = query['vnp_SecureHash'];
    if (!secureHash) return false;

    const params = { ...query };
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    // Dùng sortObject (có encode) vì params vừa được Express decode → cần encode lại trước khi hash
    const sortedParams = this.sortObject(params);
    const signData = Object.entries(sortedParams)
      .map(([key, val]) => `${key}=${val}`)
      .join('&');

    const expectedHash = this.hmacSHA512(this.hashSecret, signData);

    this.logger.debug('--- DEBUG VNPAY VERIFY ---');
    this.logger.debug(`Incoming Hash: ${secureHash}`);
    this.logger.debug(`Expected Hash: ${expectedHash}`);
    this.logger.debug(`signData: ${signData}`);
    this.logger.debug(`Match: ${secureHash === expectedHash}`);

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
      .digest('hex'); // Tiêu chuẩn phải là viết thường (lowercase)
  }

  /**
   * Thuật toán sort object khớp 100% với file demo của VNPay
   */
  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        // Chỉ encode và đổi %20 thành + như trong file demo line 315
        const value = encodeURIComponent(String(obj[key])).replace(/%20/g, '+');
        sorted[key] = value;
      }
    }
    return sorted;
  }

  /** Format: YYYYMMDDHHmmss theo chuẩn GMT+7 (Asia/Ho_Chi_Minh) */
  private formatDate(date: Date): string {
    // Force múi giờ GMT+7 tránh lỗi khi Deploy lên server UTC (như Render / AWS)
    const gmt7Date = new Date(
      date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
    );

    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      String(gmt7Date.getFullYear()) +
      pad(gmt7Date.getMonth() + 1) +
      pad(gmt7Date.getDate()) +
      pad(gmt7Date.getHours()) +
      pad(gmt7Date.getMinutes()) +
      pad(gmt7Date.getSeconds())
    );
  }
}
