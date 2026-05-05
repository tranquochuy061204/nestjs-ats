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
  console.log(' ADMIN DASHBOARD — FULL ENDPOINT TEST');
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
  token = loginRes.body?.access_token || loginRes.body?.data?.access_token || loginRes.body?.data?.accessToken || loginRes.body?.accessToken;
  console.log(`✅ [${loginRes.status}] Login OK — token: ${token?.slice(0, 30)}...`);

  // ── 1. STATS OVERVIEW ─────────────────────────────────────
  console.log('\n📌 [1] STATS — Overview');
  const overviewRes = await req('GET', '/admin/stats/overview');
  printResult('GET /admin/stats/overview', overviewRes, [
    { key: 'data.users.total', test: v => typeof v === 'number', desc: 'users.total is number' },
    { key: 'data.companies.total', test: v => typeof v === 'number', desc: 'companies.total is number' },
    { key: 'data.jobs.total', test: v => typeof v === 'number', desc: 'jobs.total is number' },
    { key: 'data.revenue', test: v => v !== undefined, desc: 'revenue exists' },
  ]);
  if (ok(overviewRes.status)) {
    const sample = JSON.stringify(overviewRes.body, null, 2);
    console.log('   Sample:', sample.split('\n').slice(0, 20).join('\n'));
  }

  // ── 2. REVENUE CHART ───────────────────────────────────────
  console.log('\n📌 [2] STATS — Revenue chart');
  const revenueRes = await req('GET', '/admin/stats/revenue?period=monthly');
  printResult('GET /admin/stats/revenue?period=monthly', revenueRes, [
    { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
  ]);
  if (ok(revenueRes.status) && Array.isArray(revenueRes.body?.data)) {
    console.log(`   Rows: ${revenueRes.body.data.length}`);
    if (revenueRes.body.data[0]) console.log(`   Sample row: ${JSON.stringify(revenueRes.body.data[0])}`);
  }

  // ── 3. USER GROWTH CHART ───────────────────────────────────
  console.log('\n📌 [3] STATS — User growth chart');
  const growthRes = await req('GET', '/admin/stats/user-growth?period=monthly');
  printResult('GET /admin/stats/user-growth?period=monthly', growthRes, [
    { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
  ]);
  if (ok(growthRes.status) && Array.isArray(growthRes.body?.data)) {
    console.log(`   Rows: ${growthRes.body.data.length}`);
    if (growthRes.body.data[0]) console.log(`   Sample row: ${JSON.stringify(growthRes.body.data[0])}`);
  }

  // ── 4. VIP PACKAGES ────────────────────────────────────────
  console.log('\n📌 [4] VIP — List packages');
  const vipPkgRes = await req('GET', '/admin/vip/packages');
  printResult('GET /admin/vip/packages', vipPkgRes, [
    { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
  ]);
  if (ok(vipPkgRes.status) && vipPkgRes.body?.data?.length) {
    vipPackageId = vipPkgRes.body.data[0]?.id;
    console.log(`   Packages: ${vipPkgRes.body.data.length}, First ID: ${vipPackageId}`);
    const p = vipPkgRes.body.data[0];
    console.log(`   Sample keys: ${Object.keys(p || {}).join(', ')}`);
  }

  // ── 5. VIP PACKAGE DETAIL ──────────────────────────────────
  if (vipPackageId) {
    console.log('\n📌 [5] VIP — Get single package');
    const vipOneRes = await req('GET', `/admin/vip/packages/${vipPackageId}`);
    printResult(`GET /admin/vip/packages/${vipPackageId}`, vipOneRes, [
      { key: 'data.id', test: v => v === vipPackageId, desc: 'id matches' },
      { key: 'data.price', test: v => v !== undefined, desc: 'price exists' },
      { key: 'data.durationDays', test: v => v !== undefined, desc: 'durationDays exists' },
    ]);
  }

  // ── 6. VIP SUBSCRIPTIONS ───────────────────────────────────
  console.log('\n📌 [6] VIP — List subscriptions');
  const vipSubRes = await req('GET', '/admin/vip/subscriptions?limit=3');
  printResult('GET /admin/vip/subscriptions?limit=3', vipSubRes, [
    { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
    { key: 'summary.totalActive', test: v => typeof v === 'number', desc: 'summary.totalActive is number' },
    { key: 'pagination.total', test: v => typeof v === 'number', desc: 'pagination.total is number' },
  ]);
  if (ok(vipSubRes.status)) {
    console.log(`   Summary: ${JSON.stringify(vipSubRes.body?.summary)}`);
  }

  // ── 7. EXPIRING SUBSCRIPTIONS ──────────────────────────────
  console.log('\n📌 [7] VIP — Expiring subscriptions');
  const expiringRes = await req('GET', '/admin/vip/subscriptions/expiring?days=30');
  printResult('GET /admin/vip/subscriptions/expiring?days=30', expiringRes, [
    { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
  ]);

  // ── 8. CREDIT PACKAGES ─────────────────────────────────────
  console.log('\n📌 [8] CREDITS — List packages');
  const creditPkgRes = await req('GET', '/admin/credits/packages');
  printResult('GET /admin/credits/packages', creditPkgRes, [
    { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
  ]);
  if (ok(creditPkgRes.status) && creditPkgRes.body?.data?.length) {
    creditPackageId = creditPkgRes.body.data[0]?.id;
    console.log(`   Packages: ${creditPkgRes.body.data.length}, First ID: ${creditPackageId}`);
    const p = creditPkgRes.body.data[0];
    console.log(`   Sample keys: ${Object.keys(p || {}).join(', ')}`);
  }

  // ── 9. COMPANIES LIST ──────────────────────────────────────
  console.log('\n📌 [9] COMPANIES — List');
  const companiesRes = await req('GET', '/admin/companies?limit=3&page=1');
  printResult('GET /admin/companies?limit=3', companiesRes, [
    { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
    { key: 'pagination.total', test: v => typeof v === 'number', desc: 'pagination.total is number' },
  ]);
  if (ok(companiesRes.status) && companiesRes.body?.data?.length) {
    companyId = companiesRes.body.body?.data?.[0]?.id || companiesRes.body?.data?.[0]?.id;
    const c = companiesRes.body.data[0];
    companyId = c?.id;
    console.log(`   Companies: ${companiesRes.body.data.length}, First company: ${c?.name} (ID:${companyId})`);
    console.log(`   Sample keys: ${Object.keys(c || {}).join(', ')}`);
  }

  // ── 10. COMPANY DETAIL ─────────────────────────────────────
  if (companyId) {
    console.log('\n📌 [10] COMPANIES — Single company detail');
    const compDetailRes = await req('GET', `/admin/companies/${companyId}`);
    printResult(`GET /admin/companies/${companyId}`, compDetailRes, [
      { key: 'data.id', test: v => v !== undefined, desc: 'id exists' },
    ]);

    // ── 11. COMPANY SUBSCRIPTION ───────────────────────────
    console.log('\n📌 [11] COMPANIES — Active subscription');
    const compSubRes = await req('GET', `/admin/companies/${companyId}/subscription`);
    printResult(`GET /admin/companies/${companyId}/subscription`, compSubRes);
    if (ok(compSubRes.status)) {
      console.log(`   Sub keys: ${Object.keys(compSubRes.body?.data || {}).join(', ')}`);
    }

    // ── 12. CREDIT WALLET ──────────────────────────────────
    console.log('\n📌 [12] COMPANIES — Credit wallet');
    const walletRes = await req('GET', `/admin/companies/${companyId}/credit-wallet`);
    printResult(`GET /admin/companies/${companyId}/credit-wallet`, walletRes, [
      { key: 'data.balance', test: v => v !== undefined, desc: 'balance exists' },
    ]);

    // ── 13. PAYMENT HISTORY ────────────────────────────────
    console.log('\n📌 [13] COMPANIES — Payment history');
    const payHistRes = await req('GET', `/admin/companies/${companyId}/payment-history?limit=2`);
    printResult(`GET /admin/companies/${companyId}/payment-history`, payHistRes, [
      { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
    ]);

    // ── 14. COMPANY JOBS ───────────────────────────────────
    console.log('\n📌 [14] COMPANIES — Jobs by company');
    const compJobsRes = await req('GET', `/admin/companies/${companyId}/jobs?limit=2`);
    printResult(`GET /admin/companies/${companyId}/jobs`, compJobsRes, [
      { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
    ]);

    // ── 15. ADJUST CREDIT (small positive amount) ──────────
    console.log('\n📌 [15] COMPANIES — Adjust credit (+10 test)');
    const adjustRes = await req('POST', `/admin/companies/${companyId}/credits/adjust`, {
      amount: 10,
      reason: '[Test] Admin dashboard endpoint verification',
    });
    printResult(`POST /admin/companies/${companyId}/credits/adjust`, adjustRes, [
      { key: 'data.balanceAfter', test: v => typeof v === 'number', desc: 'balanceAfter is number' },
    ]);
    if (ok(adjustRes.status)) {
      console.log(`   New balance: ${adjustRes.body?.data?.balanceAfter}`);
    }
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
    console.log(`   Users: ${usersRes.body.data.length}, Sample: ${u?.email} (role: ${u?.role}, status: ${u?.status})`);
    console.log(`   Sample keys: ${Object.keys(u || {}).join(', ')}`);
  }

  // ── 17. USER DETAIL ────────────────────────────────────────
  if (userId) {
    console.log('\n📌 [17] USERS — Single user');
    const userDetailRes = await req('GET', `/admin/users/${userId}`);
    printResult(`GET /admin/users/${userId}`, userDetailRes, [
      { key: 'data.id', test: v => v !== undefined, desc: 'id exists' },
      { key: 'data.email', test: v => typeof v === 'string', desc: 'email is string' },
      { key: 'data.profile', test: v => v !== undefined, desc: 'profile field exists' },
    ]);
  }

  // ── 18. JOBS ADMIN LIST ────────────────────────────────────
  console.log('\n📌 [18] JOBS — Admin list (pending)');
  const jobsRes = await req('GET', '/jobs/admin/all?status=pending&limit=3');
  printResult('GET /jobs/admin/all?status=pending', jobsRes, [
    { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
  ]);
  if (ok(jobsRes.status)) {
    console.log(`   Pending jobs: ${jobsRes.body?.data?.length ?? 0}`);
  }

  // ── 19. AUDIT LOGS ─────────────────────────────────────────
  console.log('\n📌 [19] AUDIT LOGS — List');
  const auditRes = await req('GET', '/admin/audit-logs?limit=5');
  printResult('GET /admin/audit-logs?limit=5', auditRes, [
    { key: 'data', test: v => Array.isArray(v), desc: 'data is array' },
    { key: 'pagination', test: v => v !== undefined, desc: 'pagination exists' },
  ]);
  if (ok(auditRes.status)) {
    console.log(`   Log count: ${auditRes.body?.data?.length}`);
    if (auditRes.body?.data?.[0]) {
      const log = auditRes.body.data[0];
      console.log(`   Sample keys: ${Object.keys(log).join(', ')}`);
    }
  }

  // ── SUMMARY ───────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(' TEST COMPLETE');
  console.log('='.repeat(60));
}

run().catch(console.error);
