const http = require('http');

const BASE = 'http://localhost:3000/api';
let token = '';
let companyId = null;
let userId = null;
let vipPackageId = null;
let creditPackageId = null;

function req(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', (e) => resolve({ status: 0, error: e.message }));
    if (data) r.write(data);
    r.end();
  });
}

function ok(status) { return status >= 200 && status < 300; }
function label(status) { return ok(status) ? '✅' : '❌'; }

function printResult(name, res, checks = []) {
  const icon = ok(res.status) ? '✅' : '❌';
  console.log(`\n${icon} [${res.status}] ${name}`);
  if (!ok(res.status)) {
    console.log('   Error:', JSON.stringify(res.body?.message || res.body));
    return;
  }
  checks.forEach(({ key, test, desc }) => {
    const val = key.split('.').reduce((o, k) => o?.[k], res.body);
    const pass = test(val);
    console.log(`   ${pass ? '✅' : '⚠️'} ${desc}: ${JSON.stringify(val)}`);
  });
}

async function run() {
  console.log('='.repeat(60));
  console.log(' ADMIN DASHBOARD — FULL ENDPOINT TEST (REVERTED WRAPPER)');
  console.log('='.repeat(60));

  // ── 0. LOGIN ──────────────────────────────────────────────
  console.log('\n📌 [0] AUTH — Login');
  const loginRes = await req('POST', '/auth/login', {
    email: 'admin@ats.com',
    password: 'Admin@123',
  });
  if (!ok(loginRes.status)) {
    console.log('❌ Login failed:', loginRes.body);
    return;
  }
  token = loginRes.body?.access_token || loginRes.body?.accessToken;
  console.log(`✅ [${loginRes.status}] Login OK — token: ${token?.slice(0, 30)}...`);

  // ── 1. STATS OVERVIEW ─────────────────────────────────────
  console.log('\n📌 [1] STATS — Overview');
  const overviewRes = await req('GET', '/admin/stats/overview');
  printResult('GET /admin/stats/overview', overviewRes, [
    { key: 'users.total', test: v => typeof v === 'number', desc: 'users.total is number' },
    { key: 'companies.total', test: v => typeof v === 'number', desc: 'companies.total is number' },
    { key: 'jobs.total', test: v => typeof v === 'number', desc: 'jobs.total is number' },
    { key: 'revenue', test: v => v !== undefined, desc: 'revenue exists' },
  ]);

  // ── 2. REVENUE CHART ───────────────────────────────────────
  console.log('\n📌 [2] STATS — Revenue chart');
  const revenueRes = await req('GET', '/admin/stats/revenue?period=monthly');
  printResult('GET /admin/stats/revenue?period=monthly', revenueRes, [
    { key: '', test: v => Array.isArray(v), desc: 'is array' },
  ]);

  // ── 3. USER GROWTH CHART ───────────────────────────────────
  console.log('\n📌 [3] STATS — User growth chart');
  const growthRes = await req('GET', '/admin/stats/user-growth?period=monthly');
  printResult('GET /admin/stats/user-growth?period=monthly', growthRes, [
    { key: '', test: v => Array.isArray(v), desc: 'is array' },
  ]);

  // ── 4. VIP PACKAGES ────────────────────────────────────────
  console.log('\n📌 [4] VIP — List packages');
  const vipPkgRes = await req('GET', '/admin/vip/packages');
  printResult('GET /admin/vip/packages', vipPkgRes, [
    { key: '', test: v => Array.isArray(v), desc: 'is array' },
  ]);
  if (ok(vipPkgRes.status) && vipPkgRes.body?.length) {
    vipPackageId = vipPkgRes.body[0]?.id;
  }

  // ── 6. VIP SUBSCRIPTIONS ───────────────────────────────────
  console.log('\n📌 [6] VIP — List subscriptions');
  const vipSubRes = await req('GET', '/admin/vip/subscriptions?limit=3');
  printResult('GET /admin/vip/subscriptions?limit=3', vipSubRes, [
    { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
    { key: 'summary.totalActive', test: v => typeof v === 'number', desc: 'summary.totalActive is number' },
    { key: 'pagination.total', test: v => typeof v === 'number', desc: 'pagination.total is number' },
  ]);

  // ── 9. COMPANIES LIST ──────────────────────────────────────
  console.log('\n📌 [9] COMPANIES — List');
  const companiesRes = await req('GET', '/admin/companies?limit=3&page=1');
  printResult('GET /admin/companies?limit=3', companiesRes, [
    { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
    { key: 'pagination.total', test: v => typeof v === 'number', desc: 'pagination.total is number' },
  ]);
  if (ok(companiesRes.status) && companiesRes.body?.data?.length) {
    companyId = companiesRes.body.data[0]?.id;
  }

  // ── 10. COMPANY DETAIL ─────────────────────────────────────
  if (companyId) {
    console.log('\n📌 [10] COMPANIES — Single company detail');
    const compDetailRes = await req('GET', `/admin/companies/${companyId}`);
    printResult(`GET /admin/companies/${companyId}`, compDetailRes, [
      { key: 'id', test: v => v !== undefined, desc: 'id exists' },
    ]);

    // ── 12. CREDIT WALLET ──────────────────────────────────
    console.log('\n📌 [12] COMPANIES — Credit wallet');
    const walletRes = await req('GET', `/admin/companies/${companyId}/credit-wallet`);
    printResult(`GET /admin/companies/${companyId}/credit-wallet`, walletRes, [
      { key: 'balance', test: v => v !== undefined, desc: 'balance exists' },
    ]);

    // ── 15. ADJUST CREDIT (small positive amount) ──────────
    console.log('\n📌 [15] COMPANIES — Adjust credit (+10 test)');
    const adjustRes = await req('POST', `/admin/companies/${companyId}/credits/adjust`, {
      amount: 10,
      reason: '[Test] Admin dashboard endpoint verification',
    });
    printResult(`POST /admin/companies/${companyId}/credits/adjust`, adjustRes, [
      { key: 'balanceAfter', test: v => typeof v === 'number', desc: 'balanceAfter is number' },
    ]);
  }

  // ── 16. USERS LIST ─────────────────────────────────────────
  console.log('\n📌 [16] USERS — List');
  const usersRes = await req('GET', '/admin/users?limit=3');
  printResult('GET /admin/users?limit=3', usersRes, [
    { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
    { key: 'pagination.total', test: v => typeof v === 'number', desc: 'pagination.total is number' },
  ]);
  if (ok(usersRes.status) && usersRes.body?.data?.length) {
    const u = usersRes.body.data.find(x => x.role !== 'admin') || usersRes.body.data[0];
    userId = u?.id;
  }

  // ── 17. USER DETAIL ────────────────────────────────────────
  if (userId) {
    console.log('\n📌 [17] USERS — Single user');
    const userDetailRes = await req('GET', `/admin/users/${userId}`);
    printResult(`GET /admin/users/${userId}`, userDetailRes, [
      { key: 'id', test: v => v !== undefined, desc: 'id exists' },
      { key: 'email', test: v => typeof v === 'string', desc: 'email is string' },
    ]);
  }

  // ── 19. AUDIT LOGS ─────────────────────────────────────────
  console.log('\n📌 [19] AUDIT LOGS — List');
  const auditRes = await req('GET', '/admin/audit-logs?limit=5');
  printResult('GET /admin/audit-logs?limit=5', auditRes, [
    { key: 'items', test: v => Array.isArray(v), desc: 'items is array' },
    { key: 'meta', test: v => v !== undefined, desc: 'meta exists' },
  ]);

  // ── SUMMARY ───────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(' TEST COMPLETE');
  console.log('='.repeat(60));
}

run().catch(console.error);
