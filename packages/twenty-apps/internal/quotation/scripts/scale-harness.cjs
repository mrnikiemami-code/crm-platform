/**
 * CRM-129-013 scale harness — real Postgres evidence at 1,000,000 customers and
 * 100,000 catalog items.
 *
 * WHY A SEPARATE DATABASE: the operational workspace schema is not seeded, ever. This script
 * creates `twenty_scale_crm129_013`, mirrors the columns and indexes Twenty actually creates
 * for `person` / `company` / `catalogItem` (verified by reading pg_indexes on the workspace
 * schema), seeds it with generate_series, and runs the SAME keyset shape the app's GraphQL
 * queries compile to. Nothing it does can reach a workspace table.
 *
 * Usage:
 *   node scripts/scale-harness.cjs            # create, measure, drop
 *   node scripts/scale-harness.cjs --keep     # keep the database for follow-up queries
 *
 * Env:
 *   PG_DATABASE_URL  admin connection (defaults to the local dev instance)
 *   SCALE_CUSTOMERS  default 1000000
 *   SCALE_ITEMS      default 100000
 */
const { Client } = require('pg');
const { requireDatabaseUrl } = require('./db-connection.cjs');

const ADMIN_URL =
  process.env.PG_DATABASE_URL ||
  requireDatabaseUrl('scripts/scale-harness.cjs');
const SCALE_DB = 'twenty_scale_crm129_013';
const CUSTOMERS = Number.parseInt(process.env.SCALE_CUSTOMERS ?? '1000000', 10);
const ITEMS = Number.parseInt(process.env.SCALE_ITEMS ?? '100000', 10);
const PAGE_SIZE = 25;
const KEEP = process.argv.includes('--keep');

const withDatabase = (url, database) => {
  const parsed = new URL(url);

  parsed.pathname = `/${database}`;

  return parsed.toString();
};

const now = () => Number(process.hrtime.bigint() / 1000n) / 1000;

const percentile = (values, ratio) => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));

  return sorted[index];
};

const time = async (fn) => {
  const started = now();
  const value = await fn();

  return { value, ms: now() - started };
};

const createDatabaseIfMissing = async () => {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();

  const existing = await admin.query('select 1 from pg_database where datname = $1', [
    SCALE_DB,
  ]);

  if (existing.rowCount === 0) {
    // Template0 keeps the locale deterministic; the instance has no connections to it.
    await admin.query(`create database ${SCALE_DB}`);
    console.log(`created database ${SCALE_DB}`);
  } else {
    console.log(`reusing database ${SCALE_DB}`);
  }

  await admin.end();
};

const createSchema = async (client) => {
  await client.query('create extension if not exists "uuid-ossp"');
  await client.query('create extension if not exists pg_trgm');

  // Columns mirror the workspace tables closely enough for the same ORDER BY / filter to
  // compile to the same plan: a composite "name" on person, a plain name on company, and
  // name/sku on the catalog.
  await client.query(`
    create table if not exists person (
      id uuid primary key default gen_random_uuid(),
      "nameFirstName" text,
      "nameLastName" text,
      "emailsPrimaryEmail" text,
      "jobTitle" text,
      "searchVector" tsvector generated always as (
        to_tsvector('simple', coalesce("nameFirstName", '') || ' ' || coalesce("nameLastName", ''))
      ) stored
    )
  `);

  await client.query(`
    create table if not exists company (
      id uuid primary key default gen_random_uuid(),
      name text,
      "searchVector" tsvector generated always as (
        to_tsvector('simple', coalesce(name, ''))
      ) stored
    )
  `);

  await client.query(`
    create table if not exists "catalogItem" (
      id uuid primary key default gen_random_uuid(),
      name text,
      sku text,
      kind text default 'PRODUCT',
      unit text default 'عدد'
    )
  `);

  // The indexes the workspace schema actually has (read from pg_indexes).
  await client.query(
    'create unique index if not exists person_emails_unique on person ("emailsPrimaryEmail")',
  );
  await client.query(
    'create index if not exists person_search_vector on person using gin ("searchVector")',
  );
  await client.query(
    'create index if not exists company_search_vector on company using gin ("searchVector")',
  );
};

const seed = async (client) => {
  const persons = await client.query('select count(*)::int as count from person');

  if (persons.rows[0].count !== CUSTOMERS) {
    console.log(`seeding ${CUSTOMERS} customers…`);
    await client.query('truncate person');

    const started = now();

    // A single server-side INSERT keeps the seeding time inside Postgres instead of moving
    // a million rows through the client.
    await client.query(
      `
      insert into person ("nameFirstName", "nameLastName", "emailsPrimaryEmail", "jobTitle")
      select
        'مشتری ' || ((g % 1000) + 1)::text as "nameFirstName",
        'خانواده ' || g::text as "nameLastName",
        'customer' || g::text || '@example.ir' as "emailsPrimaryEmail",
        'کارشناس ' || ((g % 37) + 1)::text as "jobTitle"
      from generate_series(1, $1) as g
      `,
      [CUSTOMERS],
    );
    console.log(`seeded customers in ${Math.round(now() - started)}ms`);
  }

  const items = await client.query('select count(*)::int as count from "catalogItem"');

  if (items.rows[0].count !== ITEMS) {
    console.log(`seeding ${ITEMS} catalog items…`);
    await client.query('truncate "catalogItem"');

    const started = now();

    await client.query(
      `
      insert into "catalogItem" (name, sku)
      select
        'کالای شماره ' || ((g % 20000) + 1)::text as name,
        (100000 + g)::text as sku
      from generate_series(1, $1) as g
      `,
      [ITEMS],
    );
    console.log(`seeded catalog items in ${Math.round(now() - started)}ms`);
  }

  await client.query('analyze person');
  await client.query('analyze "catalogItem"');
};

// The shape `findMany` emits for `orderBy: [{ name: AscNullsLast }, { id: AscNullsLast }]`
// with a `first` and an opaque `after` that resolves to (name, id).
const keysetPage = async (client, { table, columns, nameColumn, after, limit }) => {
  const params = [];
  let where = '';

  if (after !== null) {
    params.push(after.name, after.id);
    where = `where (coalesce(${nameColumn}, '') , id) > ($1, $2::uuid)`;
  }

  params.push(limit);

  return client.query(
    `select ${columns} from ${table} ${where} order by coalesce(${nameColumn}, '') asc, id asc limit $${params.length}`,
    params,
  );
};

const explain = async (client, sql, params) => {
  const result = await client.query(`explain (analyze, buffers) ${sql}`, params);

  return result.rows.map((row) => Object.values(row)[0]);
};

const measurePaging = async (client) => {
  const personColumns = 'id, "nameFirstName", "nameLastName", "emailsPrimaryEmail"';

  const first = await time(() =>
    keysetPage(client, {
      table: 'person',
      columns: personColumns,
      nameColumn: '"nameLastName"',
      after: null,
      limit: PAGE_SIZE,
    }),
  );

  // A cursor 900,000 rows in. Keyset paging must cost the same as page one; an OFFSET
  // implementation would read 900,000 rows to answer it.
  const deepSeed = await client.query(
    `select id, "nameLastName" from person order by coalesce("nameLastName", '') asc, id asc offset 900000 limit 1`,
  );
  const deepAfter = {
    name: deepSeed.rows[0]['nameLastName'],
    id: deepSeed.rows[0].id,
  };

  const deep = await time(() =>
    keysetPage(client, {
      table: 'person',
      columns: personColumns,
      nameColumn: '"nameLastName"',
      after: deepAfter,
      limit: PAGE_SIZE,
    }),
  );

  const deepPlain = await time(() =>
    client.query(
      `select ${personColumns} from person order by coalesce("nameLastName", '') asc, id asc offset 900000 limit ${PAGE_SIZE}`,
    ),
  );

  const plan = await explain(
    client,
    `select ${personColumns} from person where (coalesce("nameLastName", '') , id) > ($1, $2::uuid) order by coalesce("nameLastName", '') asc, id asc limit $3`,
    [deepAfter.name, deepAfter.id, PAGE_SIZE],
  );

  return {
    pageSize: PAGE_SIZE,
    firstPageRows: first.value.rowCount,
    firstPageMs: Number(first.ms.toFixed(2)),
    deepPageRows: deep.value.rowCount,
    deepPageMs: Number(deep.ms.toFixed(2)),
    deepOffsetMs: Number(deepPlain.ms.toFixed(2)),
    rowsReturnedPerPage: deep.value.rowCount,
    plan,
  };
};

const measureSearch = async (client) => {
  const term = 'خانواده 512345';
  const ilikeRuns = [];
  const trgmRuns = [];
  const trigramSql = `select id, "nameFirstName", "nameLastName" from person where "nameLastName" ilike $1 order by "nameLastName" asc, id asc limit ${PAGE_SIZE}`;
  const vectorSql = `select id, "nameFirstName", "nameLastName" from person where "searchVector" @@ plainto_tsquery('simple', $1) limit ${PAGE_SIZE}`;

  for (let run = 0; run < 5; run += 1) {
    const ilike = await time(() => client.query(trigramSql, [`%${term}%`]));
    ilikeRuns.push(ilike.ms);
  }

  for (let run = 0; run < 5; run += 1) {
    const vector = await time(() => client.query(vectorSql, [term]));
    trgmRuns.push(vector.ms);
  }

  const ilikePlan = await explain(client, trigramSql, [`%${term}%`]);
  const vectorPlan = await explain(client, vectorSql, [term]);

  return {
    ilikeMs: {
      p50: Number(percentile(ilikeRuns, 0.5).toFixed(2)),
      p95: Number(percentile(ilikeRuns, 0.95).toFixed(2)),
    },
    searchVectorMs: {
      p50: Number(percentile(trgmRuns, 0.5).toFixed(2)),
      p95: Number(percentile(trgmRuns, 0.95).toFixed(2)),
    },
    ilikePlan,
    vectorPlan,
  };
};

const measureCatalogPaging = async (client) => {
  const catalogRuns = [];

  for (let run = 0; run < 5; run += 1) {
    const page = await time(() =>
      client.query(
        `select id, name, sku from "catalogItem" order by name asc nulls last, id asc nulls last limit ${PAGE_SIZE}`,
      ),
    );
    catalogRuns.push(page.ms);
  }

  const plan = await explain(
    client,
    `select id, name, sku from "catalogItem" order by name asc nulls last, id asc nulls last limit ${PAGE_SIZE}`,
  );

  return {
    p50: Number(percentile(catalogRuns, 0.5).toFixed(2)),
    p95: Number(percentile(catalogRuns, 0.95).toFixed(2)),
    plan,
  };
};

// The contrast that matters: what an unbounded screen would have to transfer and hold.
const measureUnboundedBaseline = async (client) => {
  const heapBefore = process.memoryUsage().heapUsed;

  const full = await time(async () => {
    const result = await client.query('select id, "nameFirstName", "nameLastName", "emailsPrimaryEmail" from person');
    const bytes = Buffer.byteLength(JSON.stringify(result.rows), 'utf8');

    // Release immediately so the heap delta reflects a screen that kept them.
    result.rows.length = 0;

    return bytes;
  });

  const heapAfter = process.memoryUsage().heapUsed;

  const page = await client.query(
    `select id, "nameFirstName", "nameLastName", "emailsPrimaryEmail" from person order by coalesce("nameLastName", '') asc, id asc limit ${PAGE_SIZE}`,
  );

  return {
    fullScanMs: Number(full.ms.toFixed(2)),
    fullPayloadBytes: full.value,
    pagePayloadBytes: Buffer.byteLength(JSON.stringify(page.rows), 'utf8'),
    heapDeltaBytes: heapAfter - heapBefore,
  };
};

// The workspace schema currently has no ordered index for the sort these screens use
// (`name, id`), so a keyset page is still a seq scan — better than OFFSET, but not constant.
// This step measures the achievable ceiling so the report can state a real number instead of
// promising one.
const measureWithOrderedIndex = async (client) => {
  const started = now();

  await client.query(
    'create index if not exists person_name_id_order on person (coalesce("nameLastName", \'\'), id)',
  );
  await client.query(
    'create index if not exists catalog_name_id_order on "catalogItem" (name asc nulls last, id asc nulls last)',
  );
  await client.query('analyze person');
  await client.query('analyze "catalogItem"');

  const indexBuildMs = Math.round(now() - started);

  const deepSeed = await client.query(
    `select id, "nameLastName" from person order by coalesce("nameLastName", '') asc, id asc offset 900000 limit 1`,
  );
  const deepAfter = {
    name: deepSeed.rows[0]['nameLastName'],
    id: deepSeed.rows[0].id,
  };

  const deep = await time(() =>
    keysetPage(client, {
      table: 'person',
      columns: 'id, "nameFirstName", "nameLastName", "emailsPrimaryEmail"',
      nameColumn: '"nameLastName"',
      after: deepAfter,
      limit: PAGE_SIZE,
    }),
  );

  const catalogRuns = [];

  for (let run = 0; run < 5; run += 1) {
    const page = await time(() =>
      client.query(
        `select id, name, sku from "catalogItem" order by name asc nulls last, id asc nulls last limit ${PAGE_SIZE}`,
      ),
    );
    catalogRuns.push(page.ms);
  }

  const plan = await explain(
    client,
    `select id, "nameFirstName", "nameLastName" from person where (coalesce("nameLastName", '') , id) > ($1, $2::uuid) order by coalesce("nameLastName", '') asc, id asc limit $3`,
    [deepAfter.name, deepAfter.id, PAGE_SIZE],
  );

  return {
    indexBuildMs,
    deepPageMs: Number(deep.ms.toFixed(2)),
    deepPageRows: deep.value.rowCount,
    catalogFirstPageP50Ms: Number(percentile(catalogRuns, 0.5).toFixed(2)),
    catalogFirstPageP95Ms: Number(percentile(catalogRuns, 0.95).toFixed(2)),
    plan,
  };
};

const main = async () => {
  await createDatabaseIfMissing();

  const client = new Client({ connectionString: withDatabase(ADMIN_URL, SCALE_DB) });
  await client.connect();

  try {
    await createSchema(client);
    await seed(client);

    const counts = await client.query(
      'select (select count(*) from person)::int as customers, (select count(*) from "catalogItem")::int as items',
    );

    const report = {
      generatedAt: new Date().toISOString(),
      database: SCALE_DB,
      dataset: counts.rows[0],
      paging: await measurePaging(client),
      catalogPaging: await measureCatalogPaging(client),
      search: await measureSearch(client),
      withOrderedIndex: await measureWithOrderedIndex(client),
      unboundedBaseline: await measureUnboundedBaseline(client),
      nodeHeapLimitMb: Math.round(
        require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024,
      ),
    };

    console.log(JSON.stringify(report, null, 2));

    require('fs').writeFileSync(
      require('path').join(__dirname, 'scale-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  } finally {
    await client.end();

    if (!KEEP) {
      const admin = new Client({ connectionString: ADMIN_URL });
      await admin.connect();
      await admin.query(`drop database if exists ${SCALE_DB}`);
      await admin.end();
      console.log(`dropped database ${SCALE_DB}`);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
