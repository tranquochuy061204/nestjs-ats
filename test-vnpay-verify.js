/**
 * Test script: Verify chữ ký VNPay Return URL
 * Mô phỏng chính xác hành vi Express parse query string + Backend hash
 * 
 * Chạy: node test-vnpay-verify.js
 */
const crypto = require('crypto');
const secret = 'LTRAWY0MNR4CMGZ02QUATLD8ZLT6S3U6';

// URL VNPay trả về sau khi thanh toán:
// http://localhost:3000/api/payments/vnpay/return?vnp_Amount=10000000&...
// Express parse URL này → các giá trị đã được URL-decoded:
//   vnp_OrderInfo = "Nap 100 Credit (starter) - Cong ty ID 8"  <-- đã decode
//   vnp_SecureHash = "7f4b212c..."
const expressDecodedParams = {
  vnp_Amount: '10000000',
  vnp_BankCode: 'NCB',
  vnp_BankTranNo: 'VNP15515345',
  vnp_CardType: 'ATM',
  vnp_OrderInfo: 'Nap 100 Credit (starter) - Cong ty ID 8',  // Express đã decode
  vnp_PayDate: '20260427213653',
  vnp_ResponseCode: '00',
  vnp_TmnCode: 'Q8X4GQAV',
  vnp_TransactionNo: '15515345',
  vnp_TransactionStatus: '00',
  vnp_TxnRef: 'CR-starter-15-1777300524421',
  // Đây là incoming secureHash từ VNPay:
  vnp_SecureHash: '7f4b212c5a9e44b1377a5397566acc2b141245d60b00f94458695501ecc901db51febc47d8dcff00ec4731bf96937643ff9838a76a9d8be381472a34615ab907'
};

// ─── Copy chính xác sortObject của vnpay.service.ts ───
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

// ─── Simulate verifyReturnUrl ───
const incoming = expressDecodedParams['vnp_SecureHash'];
const params = { ...expressDecodedParams };
delete params['vnp_SecureHash'];
delete params['vnp_SecureHashType'];

const sortedParams = sortObject(params);
const signData = Object.entries(sortedParams)
  .map(([key, val]) => `${key}=${val}`)
  .join('&');

const expectedHash = crypto
  .createHmac('sha512', secret)
  .update(Buffer.from(signData, 'utf-8'))
  .digest('hex');

console.log('\n=== VNPay Verify Simulation ===');
console.log('signData     :', signData);
console.log('Incoming Hash:', incoming);
console.log('Expected Hash:', expectedHash);
console.log('MATCH?       :', incoming === expectedHash ? '✅ PASS' : '❌ FAIL');
