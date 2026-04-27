const crypto = require('crypto');
const secret = 'LTRAWY0MNR4CMGZ02QUATLD8ZLT6S3U6';
const qs = require('querystring');

const params = {
  vnp_Amount: '10000000',
  vnp_BankCode: 'NCB',
  vnp_BankTranNo: 'VNP15515345',
  vnp_CardType: 'ATM',
  vnp_OrderInfo: 'Nap 100 Credit (starter) - Cong ty ID 8',
  vnp_PayDate: '20260427213653',
  vnp_ResponseCode: '00',
  vnp_TmnCode: 'Q8X4GQAV',
  vnp_TransactionNo: '15515345',
  vnp_TransactionStatus: '00',
  vnp_TxnRef: 'CR-starter-15-1777300524421',
};

function sortOld(obj) {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((k) => {
      let value = encodeURIComponent(String(obj[k])).replace(/%20/g, '+');
      sorted[k] = value;
    });
  return Object.entries(sorted)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

function sortNew(obj) {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((k) => {
      let value = encodeURIComponent(String(obj[k]))
        .replace(/%20/g, '+')
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A');
      sorted[k] = value;
    });
  return Object.entries(sorted)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

function rawQsSort(obj) {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((k) => {
      sorted[k] = obj[k];
    });
  return qs.stringify(sorted);
}

const signOld = sortOld(params);
const signNew = sortNew(params);
const signQs = rawQsSort(params);

const hashOld = crypto
  .createHmac('sha512', secret)
  .update(Buffer.from(signOld, 'utf-8'))
  .digest('hex');
const hashNew = crypto
  .createHmac('sha512', secret)
  .update(Buffer.from(signNew, 'utf-8'))
  .digest('hex');
const hashQs = crypto
  .createHmac('sha512', secret)
  .update(Buffer.from(signQs, 'utf-8'))
  .digest('hex');

console.log(
  'Target:',
  '7f4b212c5a9e44b1377a5397566acc2b141245d60b00f94458695501ecc901db51febc47d8dcff00ec4731bf96937643ff9838a76a9d8be381472a34615ab907',
);
console.log(
  'hashOld==target?',
  hashOld ===
    '7f4b212c5a9e44b1377a5397566acc2b141245d60b00f94458695501ecc901db51febc47d8dcff00ec4731bf96937643ff9838a76a9d8be381472a34615ab907',
);
console.log(
  'hashNew==target?',
  hashNew ===
    '7f4b212c5a9e44b1377a5397566acc2b141245d60b00f94458695501ecc901db51febc47d8dcff00ec4731bf96937643ff9838a76a9d8be381472a34615ab907',
);
console.log(
  'hashQs==target?',
  hashQs ===
    '7f4b212c5a9e44b1377a5397566acc2b141245d60b00f94458695501ecc901db51febc47d8dcff00ec4731bf96937643ff9838a76a9d8be381472a34615ab907',
);

// Lets see exactly the generated output
console.log('Old output hash:', hashOld);
console.log('New output hash:', hashNew);
console.log('QS output hash:', hashQs);
