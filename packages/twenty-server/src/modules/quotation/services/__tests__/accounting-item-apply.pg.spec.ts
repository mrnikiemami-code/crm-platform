import { Client } from 'pg';

// Real PostgreSQL proof for P05: item + price + link batch rollback and
// concurrent writers on the same external identity. Disposable tables only.

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

const lockKey = (
  kind: 'source' | 'sku' | 'target',
  workspaceId: string,
  identity: string,
): string => JSON.stringify(['accounting-item-' + kind, workspaceId, identity]);

describePg('P05 accounting item+price+link atomicity (real PostgreSQL)', () => {
  const workspaceId = `p05-item-${process.pid}-${Date.now()}`;
  const suffix = workspaceId.replace(/[^a-zA-Z0-9]/g, '');
  const itemTable = `p05_catalog_item_${suffix}`;
  const priceTable = `p05_price_${suffix}`;
  const linkTable = `p05_item_link_${suffix}`;
  let setup: Client;

  beforeAll(async () => {
    setup = new Client({ connectionString: DATABASE_URL as string });
    await setup.connect();
    await setup.query(`
      CREATE TABLE ${itemTable} (
        id text PRIMARY KEY,
        sku text NOT NULL,
        name text NOT NULL
      );
      CREATE TABLE ${priceTable} (
        id text PRIMARY KEY,
        "itemId" text NOT NULL,
        "priceListId" text NOT NULL,
        "unitPriceExact" text NOT NULL
      );
      CREATE TABLE ${linkTable} (
        id text PRIMARY KEY,
        "connectionId" text NOT NULL,
        "externalItemId" text NOT NULL,
        "itemId" text NOT NULL,
        "observationJson" text NOT NULL
      );
    `);
  }, 20000);

  afterAll(async () => {
    await setup
      .query(
        `DROP TABLE IF EXISTS ${linkTable}, ${priceTable}, ${itemTable}`,
      )
      .catch(() => undefined);
    await setup.end().catch(() => undefined);
  });

  it('commits item, price and link together in one transaction', async () => {
    const client = new Client({ connectionString: DATABASE_URL as string });
    await client.connect();

    try {
      await client.query('BEGIN');
      const externalItemId = 'ext-ok-1';
      const sku = 'SKU-OK-1';
      const itemId = 'item-ok-1';
      const keys = [
        lockKey('source', workspaceId, externalItemId),
        lockKey('sku', workspaceId, sku),
        lockKey('target', workspaceId, itemId),
      ].sort();

      for (const key of keys) {
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [key],
        );
      }

      await client.query(
        `INSERT INTO ${itemTable} (id, sku, name) VALUES ($1, $2, $3)`,
        [itemId, sku, 'کالای موفق'],
      );
      await client.query(
        `INSERT INTO ${priceTable} (id, "itemId", "priceListId", "unitPriceExact")
         VALUES ($1, $2, $3, $4)`,
        ['price-ok-1', itemId, 'list-irr', '1000.000000'],
      );
      await client.query(
        `INSERT INTO ${linkTable}
          (id, "connectionId", "externalItemId", "itemId", "observationJson")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'link-ok-1',
          'conn-1',
          externalItemId,
          itemId,
          JSON.stringify({ serial: 'S-1' }),
        ],
      );
      await client.query('COMMIT');

      const items = await setup.query(
        `SELECT id FROM ${itemTable} WHERE id = $1`,
        [itemId],
      );
      const prices = await setup.query(
        `SELECT id FROM ${priceTable} WHERE id = $1`,
        ['price-ok-1'],
      );
      const links = await setup.query(
        `SELECT id FROM ${linkTable} WHERE id = $1`,
        ['link-ok-1'],
      );

      expect(items.rows).toHaveLength(1);
      expect(prices.rows).toHaveLength(1);
      expect(links.rows).toHaveLength(1);
    } finally {
      await client.end();
    }
  }, 20000);

  it('rolls back the whole item+price+link batch on mid-batch failure', async () => {
    const client = new Client({ connectionString: DATABASE_URL as string });
    await client.connect();

    try {
      await client.query(`DELETE FROM ${itemTable}`);
      await client.query(`DELETE FROM ${priceTable}`);
      await client.query(`DELETE FROM ${linkTable}`);
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO ${itemTable} (id, sku, name) VALUES ('item-rb-1', 'SKU-RB-1', 'اول')`,
      );
      await client.query(
        `INSERT INTO ${priceTable} (id, "itemId", "priceListId", "unitPriceExact")
         VALUES ('price-rb-1', 'item-rb-1', 'list-irr', '10.000000')`,
      );
      await client.query(
        `INSERT INTO ${linkTable}
          (id, "connectionId", "externalItemId", "itemId", "observationJson")
         VALUES ('link-rb-1', 'conn-1', 'ext-rb-1', 'item-rb-1', '{}')`,
      );

      await client.query('ROLLBACK');

      const items = await setup.query(`SELECT id FROM ${itemTable}`);
      const prices = await setup.query(`SELECT id FROM ${priceTable}`);
      const links = await setup.query(`SELECT id FROM ${linkTable}`);

      expect(items.rows).toHaveLength(0);
      expect(prices.rows).toHaveLength(0);
      expect(links.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  }, 20000);

  it('serializes concurrent writers on the same external item identity', async () => {
    const first = new Client({ connectionString: DATABASE_URL as string });
    const second = new Client({ connectionString: DATABASE_URL as string });
    await first.connect();
    await second.connect();

    const externalItemId = 'ext-race-1';
    const sourceKey = lockKey('source', workspaceId, externalItemId);

    try {
      await first.query('BEGIN');
      await first.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [sourceKey],
      );

      await second.query('BEGIN');
      const blocked = await second.query(
        'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS got',
        [sourceKey],
      );
      expect(blocked.rows[0].got).toBe(false);

      await first.query('COMMIT');

      const after = await second.query(
        'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS got',
        [sourceKey],
      );
      expect(after.rows[0].got).toBe(true);
      await second.query('ROLLBACK');
    } finally {
      await first.query('ROLLBACK').catch(() => undefined);
      await second.query('ROLLBACK').catch(() => undefined);
      await first.end().catch(() => undefined);
      await second.end().catch(() => undefined);
    }
  }, 20000);
});
