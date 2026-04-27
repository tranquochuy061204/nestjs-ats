/**
 * Simulate chính xác createPaymentUrl() với tham số của Order 27
 * So sánh hash sinh ra vs hash có trong URL
 * 
 * Chạy: node test-create-url.js
 */
const crypto = require('crypto');
const secret = 'LTRAWY0MNR4CMGZ02QUATLD8ZLT6S3U6';

// Params raw (chưa encode) — đúng như PaymentsService.createCreditTopupOrder truyền vào
const rawParams = {
  vnp_Amount: '10000000',
  vnp_Command: 'pay',
  vnp_CreateDate: '20260427225056',
  vnp_CurrCode: 'VND',
  vnp_ExpireDate: '20260427230556',
  vnp_IpAddr: '127.0.0.1',
  vnp_Locale: 'vn',
  vnp_OrderInfo: 'Nap 100 Credit (starter) - Cong ty ID 8',
  vnp_OrderType: 'other',
  vnp_ReturnUrl: 'http://localhost:3000/api/payments/vnpay/return',
  vnp_TmnCode: 'Q8X4GQAV',
  vnp_TxnRef: 'CR-starter-29-1777305056055',
  vnp_Version: '2.1.0',
};

// Copy chính xác sortObject hiện tại trong vnpay.service.ts
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      const value = encodeURIComponent(String(obj[key]))
        .replace(/%20/g, '+')
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A');
      sorted[key] = value;
    }
  }
  return sorted;
}

// Simulate createPaymentUrl
const sortedParams = sortObject(rawParams);
const signData = Object.entries(sortedParams)
  .map(([key, val]) => `${key}=${val}`)
  .join('&');

const computedHash = crypto.createHmac('sha512', secret)
  .update(Buffer.from(signData, 'utf-8'))
  .digest('hex');

// Hash có trong URL mà API trả về
const urlHash = '556bab64f036b2e7f7d3fc7b6fa591b9320c410f632fad42f0f107c8845dc45ca23f71052f75daf015b187c3127de28ed202a5618dfa917939b3bc3f0b9d7d1d';

console.log('\n=== Simulate createPaymentUrl (Order 29) ===');
console.log('signData     :', signData);
console.log('\nComputed Hash:', computedHash);
console.log('URL Hash     :', urlHash);
console.log('\nMATCH (createPaymentUrl consistent?) :', computedHash === urlHash ? '✅ YES — URL hash đúng' : '❌ NO — URL hash SAI');

// Test thêm: VNPay nhận params thế nào?
const qs = require('querystring');
const decodedFromUrl = qs.parse(Object.entries(sortedParams).map(([k,v]) => `${k}=${v}`).join('&'));
console.log('\n=== Params VNPay nhận được sau decode ===');
console.log('vnp_IpAddr  :', decodedFromUrl.vnp_IpAddr);
console.log('vnp_OrderInfo:', decodedFromUrl.vnp_OrderInfo);
console.log('vnp_ReturnUrl:', decodedFromUrl.vnp_ReturnUrl);
