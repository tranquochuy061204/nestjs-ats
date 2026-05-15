const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.bynfobgceunurbybmgve:AoCYBZ9w4zX5jDSO@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true' });
(async () => {
  const res = await pool.query("UPDATE company SET status = 'pending' WHERE status = 'idle' AND business_license_url IS NOT NULL RETURNING id");
  console.log('Fixed IDs:', res.rows.map(r => r.id));
  process.exit(0);
})().catch(console.error);
