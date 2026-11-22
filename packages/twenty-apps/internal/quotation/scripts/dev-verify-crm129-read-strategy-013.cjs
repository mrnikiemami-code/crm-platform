// CRM-129-ACCOUNTING-BUSINESS-UX-SCALING-013 (read-strategy correction) live verification.
//
// Proves the paged endpoints the screens actually call:
//   - every response is one bounded page, whatever pageSize the caller sends;
//   - an unpaged destination (Asan's shape, served here by the mock) reports
//     readStrategy=REMOTE_UNPAGED + vendorPagination=NONE + an honest sync status;
//   - a cursor walks forward without repeating or skipping rows, and a refresh re-reads;
//   - search runs inside the bounded set, so no screen ever receives the whole catalog.
//
// No vendor request is made (mock adapter only) and no screenshot is taken.
//
// Usage: node scripts/dev-verify-crm129-read-strategy-013.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Client } = require('pg');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];
const apiBase = String(remote.apiUrl).replace(/\/$/, '');
const adminToken = remote.apiKey;

if (!apiBase.includes('localhost:3002')) {
  console.error('refuse: not the Dev :3002 deployment');
  process.exit(2);
}

const DATABASE_URL =
  process.env.CRM129_DATABASE_URL ??
  'postgres://postgres:563162150m8084M@localhost:5432/default';

const db = new Client({ connectionString: DATABASE_URL });
const results = [];
const record = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${detail}`);
};

const post = async ({ route, body, token, base = apiBase }) => {
  const response = await fetch(`${base}${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: { raw: text.slice(0, 300) } };
  }
};

const appRoute = (route, body) =>
  post({ route: `/s${route}`, body, token: adminToken });

const importAction = (body) =>
  appRoute('/quotation/accounting-import', body);

(async () => {
  await db.connect();

  const { rows: workspaces } = await db.query(
    `select "databaseSchema" from core."workspace" order by "createdAt" limit 1`,
  );
  const schema = workspaces[0]?.databaseSchema;

  if (!schema) {
    throw new Error('workspace schema not found');
  }

  const count = async (table) =>
    (await db.query(`select count(*)::int as n from "${schema}"."${table}"`))
      .rows[0].n;

  const operationsBefore = await count('_accountingSyncOperation');

  const list = await appRoute('/quotation/accounting-connection', {
    action: 'list',
  });
  const connections = await db.query(
    `select id, "adapterId" from "${schema}"."_accountingConnection" where "deletedAt" is null`,
  );
  const mockConnectionId = connections.rows.find(
    (row) => row.adapterId === 'mock',
  )?.id;

  record(
    'R0 the settings payload is readable and names the mock connection',
    list.body?.success === true && typeof mockConnectionId === 'string',
    `connections=${connections.rowCount} mock=${mockConnectionId ?? 'none'}`,
  );

  if (mockConnectionId === undefined) {
    record('R0.1 a mock connection exists for previews', false, 'no mock connection');
  } else {
    const first = await importAction({
      action: 'preview-items-page',
      connectionId: mockConnectionId,
      pageSize: 10,
      cursor: null,
      search: '',
      // An explicit refresh makes this assertion deterministic: without it, a snapshot a
      // previous run stored (correctly) gets reused.
      refresh: true,
    });
    const page = first.body?.page;
    const firstCodes = (page?.rows ?? []).map((row) => row.externalItemId);

    record(
      'R1 an unpaged destination declares REMOTE_UNPAGED and cannot page itself',
      first.body?.success === true &&
        page?.snapshot?.readStrategy === 'REMOTE_UNPAGED' &&
        page?.snapshot?.vendorPagination === 'NONE',
      `strategy=${page?.snapshot?.readStrategy} vendorPagination=${page?.snapshot?.vendorPagination}`,
    );

    record(
      'R2 the response is one bounded page with an honest total and cursor',
      (page?.rows ?? []).length === 10 &&
        typeof page?.nextCursor === 'string' &&
        page?.hasNextPage === true &&
        page?.totalKnown === 33 &&
        page?.snapshot?.syncStatus === 'COMPLETE',
      `rows=${(page?.rows ?? []).length} total=${page?.totalKnown} sync=${page?.snapshot?.syncStatus}`,
    );

    record(
      'R3 the first read is fresh, not a reused snapshot',
      page?.snapshot?.reused === false && page?.snapshot?.ageMs < 5_000,
      `reused=${page?.snapshot?.reused} ageMs=${page?.snapshot?.ageMs}`,
    );

    const second = await importAction({
      action: 'preview-items-page',
      connectionId: mockConnectionId,
      pageSize: 10,
      cursor: page?.nextCursor ?? null,
      search: '',
    });
    const secondPage = second.body?.page;
    const secondCodes = (secondPage?.rows ?? []).map((row) => row.externalItemId);
    const overlap = secondCodes.filter((code) => firstCodes.includes(code));

    record(
      'R4 the cursor continues without repeating a row',
      second.body?.success === true &&
        secondCodes.length > 0 &&
        overlap.length === 0,
      `page2=${secondCodes.length} overlap=${overlap.length}`,
    );

    record(
      'R5 the second page reuses the snapshot instead of re-reading the destination',
      secondPage?.snapshot?.reused === true &&
        secondPage?.snapshot?.snapshotId === page?.snapshot?.snapshotId,
      `reused=${secondPage?.snapshot?.reused} snapshot=${secondPage?.snapshot?.snapshotId === page?.snapshot?.snapshotId}`,
    );

    const huge = await importAction({
      action: 'preview-items-page',
      connectionId: mockConnectionId,
      pageSize: 1_000_000,
      cursor: null,
      search: '',
    });

    record(
      'R6 a one-million page request is clamped, never honoured',
      huge.body?.success === true && (huge.body?.page?.rows ?? []).length <= 100,
      `rows=${(huge.body?.page?.rows ?? []).length} pageSize=${huge.body?.page?.pageSize}`,
    );

    const searched = await importAction({
      action: 'preview-items-page',
      connectionId: mockConnectionId,
      pageSize: 5,
      cursor: null,
      search: 'کالای',
    });

    record(
      'R7 search is applied before paging and stays within the page ceiling',
      searched.body?.success === true &&
        (searched.body?.page?.rows ?? []).length <= 5 &&
        (searched.body?.page?.rows ?? []).every((row) =>
          row.name.includes('کالای'),
        ),
      `rows=${(searched.body?.page?.rows ?? []).length} total=${searched.body?.page?.totalKnown}`,
    );

    const refreshed = await importAction({
      action: 'preview-items-page',
      connectionId: mockConnectionId,
      pageSize: 10,
      cursor: null,
      search: '',
      refresh: true,
    });

    record(
      'R8 an explicit refresh reads the destination again and gets a new snapshot',
      refreshed.body?.success === true &&
        refreshed.body?.page?.snapshot?.reused === false &&
        refreshed.body?.page?.snapshot?.snapshotId !== page?.snapshot?.snapshotId,
      `reused=${refreshed.body?.page?.snapshot?.reused}`,
    );

    const parties = await importAction({
      action: 'preview-parties-page',
      connectionId: mockConnectionId,
      pageSize: 5,
      cursor: null,
      search: '',
    });
    const partiesHuge = await importAction({
      action: 'preview-parties-page',
      connectionId: mockConnectionId,
      pageSize: 1_000_000,
      cursor: null,
      search: '',
    });

    record(
      'R9 customers follow the same contract as products',
      parties.body?.success === true &&
        (parties.body?.page?.rows ?? []).length === 5 &&
        parties.body?.page?.snapshot?.readStrategy === 'REMOTE_UNPAGED' &&
        parties.body?.page?.snapshot?.syncStatus === 'COMPLETE',
      `rows=${(parties.body?.page?.rows ?? []).length} total=${parties.body?.page?.totalKnown}`,
    );

    record(
      'R10 a one-million customer page request is clamped too',
      partiesHuge.body?.success === true &&
        (partiesHuge.body?.page?.rows ?? []).length <= 100,
      `rows=${(partiesHuge.body?.page?.rows ?? []).length}`,
    );
  }

  const operationsAfter = await count('_accountingSyncOperation');

  record(
    'R11 previews created no accounting operation and sent nothing',
    operationsBefore === operationsAfter,
    `operations=${operationsBefore}->${operationsAfter}`,
  );

  const passed = results.filter((row) => row.ok).length;

  console.log(
    `\n${passed}/${results.length} PASS (read strategy 013)`,
  );

  await db.end();

  process.exit(passed === results.length ? 0 : 1);
})().catch(async (error) => {
  console.error('FAILED', error);
  await db.end().catch(() => {});
  process.exit(1);
});
