// Verification harness only: prove shared vs exclusive advisory lock semantics for
// quotation-accounting-connection:<workspaceId> against real PostgreSQL.
// Does not modify product source. Skips if PGPASSWORD / CRM129_DATABASE_URL absent.
const { Client } = require('pg');

const resolveDatabaseUrl = () => {
  const fromEnv = (process.env.CRM129_DATABASE_URL || '').trim();
  if (fromEnv) return fromEnv;
  const password = (process.env.CRM129_DB_PASSWORD || process.env.PGPASSWORD || '').trim();
  if (!password) return null;
  const host = (process.env.CRM129_DB_HOST || process.env.PGHOST || '127.0.0.1').trim() || '127.0.0.1';
  const port = (process.env.CRM129_DB_PORT || process.env.PGPORT || '5432').trim() || '5432';
  const user = (process.env.CRM129_DB_USER || process.env.PGUSER || 'postgres').trim() || 'postgres';
  const database = (process.env.CRM129_DB_NAME || process.env.PGDATABASE || 'default').trim() || 'default';
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

const DATABASE_URL = resolveDatabaseUrl();
if (!DATABASE_URL) {
  console.error(JSON.stringify({ status: 'BLOCKED', reason: 'no database credentials' }));
  process.exit(2);
}

const workspaceId = `g0-090-conn-${process.pid}-${Date.now()}`;
const lockKey = `quotation-accounting-connection:${workspaceId}`;

(async () => {
  const holder = new Client({ connectionString: DATABASE_URL });
  const challenger = new Client({ connectionString: DATABASE_URL });
  await holder.connect();
  await challenger.connect();
  const results = { workspaceId, lockKey, cases: {} };
  try {
    await holder.query('BEGIN');
    await holder.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [lockKey]);
    const sharedPeer = new Client({ connectionString: DATABASE_URL });
    await sharedPeer.connect();
    await sharedPeer.query('BEGIN');
    await sharedPeer.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [lockKey]);
    results.cases.twoSharedHolders = 'PASS';
    await sharedPeer.query('COMMIT');
    await sharedPeer.end();

    const exclusiveTry = await challenger.query(
      'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS got',
      [lockKey],
    );
    results.cases.exclusiveBlockedWhileSharedHeld =
      exclusiveTry.rows[0].got === false ? 'PASS' : 'FAIL';

    await holder.query('COMMIT');

    await challenger.query('BEGIN');
    await challenger.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
    const sharedTry = await holder.query(
      'SELECT pg_try_advisory_xact_lock_shared(hashtext($1)) AS got',
      [lockKey],
    );
    results.cases.sharedBlockedWhileExclusiveHeld =
      sharedTry.rows[0].got === false ? 'PASS' : 'FAIL';
    await challenger.query('COMMIT');

    const failed = Object.values(results.cases).some((v) => v === 'FAIL');
    results.status = failed ? 'FAIL' : 'PASS';
    console.log(JSON.stringify(results, null, 2));
    process.exit(failed ? 1 : 0);
  } finally {
    try { await holder.end(); } catch {}
    try { await challenger.end(); } catch {}
  }
})().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error && error.message ? error.message : error) }));
  process.exit(1);
});
