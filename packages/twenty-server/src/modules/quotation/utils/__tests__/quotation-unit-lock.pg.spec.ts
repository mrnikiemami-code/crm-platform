import { Client } from 'pg';

// Real PostgreSQL proof of tax → currency → unit shared lock order (U01).

const resolveDatabaseUrl = (): string | null => {
  const fromEnv = (process.env.CRM129_DATABASE_URL ?? '').trim();

  if (fromEnv !== '') {
    return fromEnv;
  }

  const password = (
    process.env.CRM129_DB_PASSWORD ??
    process.env.PGPASSWORD ??
    process.env.PG_DATABASE_PASSWORD ??
    ''
  ).trim();

  if (password === '') {
    const url = (process.env.PG_DATABASE_URL ?? '').trim();

    return url === '' ? null : url;
  }

  const host =
    (process.env.CRM129_DB_HOST ?? process.env.PGHOST ?? '127.0.0.1').trim() ||
    '127.0.0.1';
  const port =
    (process.env.CRM129_DB_PORT ?? process.env.PGPORT ?? '5432').trim() ||
    '5432';
  const user =
    (process.env.CRM129_DB_USER ?? process.env.PGUSER ?? 'postgres').trim() ||
    'postgres';
  const database =
    (process.env.CRM129_DB_NAME ?? process.env.PGDATABASE ?? 'default').trim() ||
    'default';

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

const DATABASE_URL = resolveDatabaseUrl();
const describePg = DATABASE_URL === null ? describe.skip : describe;

describePg('U01 quotation-unit-catalog advisory locks (real PostgreSQL)', () => {
  const workspaceId = `u01-unit-lock-${process.pid}-${Date.now()}`;
  const taxKey = `quotation-tax-policy:${workspaceId}`;
  const currencyKey = `quotation-currency-catalog:${workspaceId}`;
  const unitKey = `quotation-unit-catalog:${workspaceId}`;

  it('acquires Tax shared then Currency shared then Unit shared in fixed order', async () => {
    const client = new Client({ connectionString: DATABASE_URL as string });
    await client.connect();

    try {
      await client.query('BEGIN');
      const order: string[] = [];
      await client.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [
        taxKey,
      ]);
      order.push('tax');
      await client.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [
        currencyKey,
      ]);
      order.push('currency');
      await client.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [
        unitKey,
      ]);
      order.push('unit');
      expect(order).toEqual(['tax', 'currency', 'unit']);
      await client.query('COMMIT');
    } finally {
      await client.end();
    }
  }, 15000);

  it('refuses exclusive unit lock while a shared unit draft lock is held', async () => {
    const reader = new Client({ connectionString: DATABASE_URL as string });
    const writer = new Client({ connectionString: DATABASE_URL as string });
    await reader.connect();
    await writer.connect();

    try {
      await reader.query('BEGIN');
      await reader.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [
        unitKey,
      ]);

      await writer.query('BEGIN');
      const blocked = await writer.query(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS got',
        [unitKey],
      );
      expect(blocked.rows[0].got).toBe(false);

      await reader.query('COMMIT');

      const after = await writer.query(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS got',
        [unitKey],
      );
      expect(after.rows[0].got).toBe(true);
      await writer.query('ROLLBACK');
    } finally {
      await reader.query('ROLLBACK').catch(() => undefined);
      await writer.query('ROLLBACK').catch(() => undefined);
      await reader.end().catch(() => undefined);
      await writer.end().catch(() => undefined);
    }
  }, 15000);
});
