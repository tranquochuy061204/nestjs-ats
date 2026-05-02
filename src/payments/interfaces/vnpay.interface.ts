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
