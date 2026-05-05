const http = require('http');

async function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
             console.error(`[${method}] ${path} - Failed with status ${res.statusCode}: ${body}`);
             resolve(null);
          } else {
             const parsed = JSON.parse(body);
             resolve({ status: res.statusCode, data: parsed });
          }
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('--- Đăng nhập Admin ---');
  const loginRes = await request('POST', '/auth/login', {
    email: 'admin@ats.com',
    password: 'Admin@123',
  });

  if (!loginRes || !loginRes.data.access_token) {
    console.error('Đăng nhập thất bại.');
    return;
  }
  const token = loginRes.data.access_token;
  console.log('Đăng nhập thành công, nhận Token.');

  console.log('\n--- Test 1: Lấy danh sách Audit Logs ---');
  const logsRes = await request('GET', '/admin/audit-logs?limit=5', null, token);
  if (logsRes) {
    console.log(`Status: ${logsRes.status}`);
    console.log(`Số lượng log: ${logsRes.data.data ? logsRes.data.data.length : 0}`);
    if (logsRes.data.data && logsRes.data.data.length > 0) {
      console.log('Sample log đầu tiên:', JSON.stringify(logsRes.data.data[0], null, 2));
    }
  }

  console.log('\n--- Test 2: Lấy danh sách Companies ---');
  const compRes = await request('GET', '/admin/companies?limit=2', null, token);
  if (compRes) {
    console.log(`Status: ${compRes.status}`);
    console.log(`Số lượng công ty: ${compRes.data.data ? compRes.data.data.length : 0}`);
  }

  console.log('\n--- Test 3: Lấy danh sách Users ---');
  const userRes = await request('GET', '/admin/users?limit=2', null, token);
  if (userRes) {
    console.log(`Status: ${userRes.status}`);
    console.log(`Số lượng user: ${userRes.data.data ? userRes.data.data.length : 0}`);
  }
  
  console.log('\n--- Test 4: Lấy thống kê VIP ---');
  const vipRes = await request('GET', '/admin/vip/subscriptions', null, token);
  if (vipRes) {
    console.log(`Status: ${vipRes.status}`);
    console.log('VIP Stats (Summary):', JSON.stringify(vipRes.data.summary, null, 2));
  }
  
  console.log('\nAll tests completed.');
}

run().catch(console.error);
