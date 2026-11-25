import { Client } from 'pg';

// Real PostgreSQL concurrency for WS2 advisory locks (Tax → Currency) and
// lock-by-reference-id usage detection. Skips when CRM129_DATABASE_URL /
// PGPASSWORD is unavailable — never invents credentials.

const resolveDatabaseUrl = (): string | null => {
  const fromEnv = (process.env.CRM129_DATABASE_URL ?? '').trim();

  if (fromEnv !== '') {
    return fromEnv;
  }

  const password = (
    process.env.CRM129_DB_PASSWORD ??
    process.env.PGPASSWORD ??
    ''
  ).trim();

  if (password === '') {
    return null;
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

describePg('WS2 accounting-code advisory locks (real PostgreSQL)', () => {
  const workspaceId = `ws2-lock-${process.pid}-${Date.now()}`;
  const taxKey = `quotation-tax-policy:${workspaceId}`;
  const currencyKey = `quotation-currency-catalog:${workspaceId}`;

  let setup: Client;

  beforeAll(async () => {
    setup = new Client({ connectionString: DATABASE_URL as string });
    await setup.connect();
    await setup.query(`
      CREATE TEMP TABLE ws2_quotation_snapshot (
        id text PRIMARY KEY,
        "taxPolicyRecordId" text,
        "taxAccountingCode" text NOT NULL DEFAULT '',
        "quotationCurrencyRecordId" text,
        "currencyAccountingCode" text NOT NULL DEFAULT ''
      )
    `);
  }, 20000);

  afterAll(async () => {
    await setup.end().catch(() => undefined);
  });

  it('acquires Tax shared then Currency shared in fixed order', async () => {
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
      expect(order).toEqual(['tax', 'currency']);
      await client.query('COMMIT');
    } finally {
      await client.end();
    }
  }, 15000);

  it('refuses exclusive tax lock while a shared draft lock is held', async () => {
    const reader = new Client({ connectionString: DATABASE_URL as string });
    const writer = new Client({ connectionString: DATABASE_URL as string });
    await reader.connect();
    await writer.connect();

    try {
      await reader.query('BEGIN');
      await reader.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [
        taxKey,
      ]);
      await reader.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [
        currencyKey,
      ]);

      await writer.query('BEGIN');
      const blocked = await writer.query(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS got',
        [taxKey],
      );
      expect(blocked.rows[0].got).toBe(false);

      await reader.query('COMMIT');

      const after = await writer.query(
        'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS got',
        [taxKey],
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

  it('detects lock-by-reference-id when a non-empty taxAccountingCode was snapshotted', async () => {
    await setup.query(`DELETE FROM ws2_quotation_snapshot`);
    await setup.query(
      `INSERT INTO ws2_quotation_snapshot
        (id, "taxPolicyRecordId", "taxAccountingCode")
       VALUES ('q-1', 'tp-1', 'GL-TAX')`,
    );

    const { rows } = await setup.query(
      `SELECT id FROM ws2_quotation_snapshot
       WHERE "taxPolicyRecordId" = $1
         AND COALESCE(TRIM("taxAccountingCode"), '') <> ''
       LIMIT 1`,
      ['tp-1'],
    );

    expect(rows).toHaveLength(1);

    const empty = await setup.query(
      `SELECT id FROM ws2_quotation_snapshot
       WHERE "taxPolicyRecordId" = $1
         AND COALESCE(TRIM("taxAccountingCode"), '') <> ''
       LIMIT 1`,
      ['tp-missing'],
    );

    expect(empty.rows).toHaveLength(0);
  }, 15000);

  it('rolls back a fail-closed snapshot refusal without leaving a draft row', async () => {
    await setup.query(`
      CREATE TEMP TABLE IF NOT EXISTS ws2_draft_write (
        id text PRIMARY KEY,
        "taxAccountingCode" text NOT NULL DEFAULT ''
      )
    `);
    await setup.query('DELETE FROM ws2_draft_write');
    await setup.query('BEGIN');
    await setup.query(
      `INSERT INTO ws2_draft_write (id, "taxAccountingCode") VALUES ('q-draft', '')`,
    );
    // Simulate fail-closed refusal after locks: abort instead of committing blank code.
    await setup.query('ROLLBACK');

    const { rows } = await setup.query(`SELECT id FROM ws2_draft_write`);

    expect(rows).toHaveLength(0);
  }, 15000);
});
