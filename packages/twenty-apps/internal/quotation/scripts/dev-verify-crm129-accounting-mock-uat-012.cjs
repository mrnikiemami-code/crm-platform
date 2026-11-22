// CRM-129-ACCOUNTING-MOCK-UAT-012 live verification on Dev :3002.
//
// Proves the manual-UAT surfaces can be exercised with the mock destination alone: repeatable
// catalog/party fixtures, the standalone settings payload, and the document preview built from
// the sealed revision — with the real financial switches still off and zero sync operations
// created. No vendor request is sent by any assertion; the only adapter used is the mock one.
//
// Usage: node scripts/dev-verify-crm129-accounting-mock-uat-012.cjs
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
const EXPECTED_APP_VERSION = '0.1.24';
const ACCOUNTING_PAGE_UNIVERSAL_IDENTIFIER =
  '8d4356f5-95ef-54ef-91a6-12e955e4c9df';

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

const rest = (body) => post({ route: '/rest/quotation/actions', body, token: adminToken });
const appRoute = (route, body) =>
  post({ route: `/s${route}`, body, token: adminToken });
const gql = async (query) =>
  post({
    route: '/graphql',
    body: { query },
    token: adminToken,
  });

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

  const before = {
    connections: await count('_accountingConnection'),
    quotations: await count('_quotation'),
    revisions: await count('_quotationRevision'),
    operations: await count('_accountingSyncOperation'),
    itemLinks: await count('_accountingItemLink'),
    partyLinks: await count('_accountingPartyLink'),
  };

  // S1.1 — the deployed application is the one under test.
  const { rows: appRows } = await db.query(
    `select id, version from core."application" where name = $1`,
    ['پیش‌فاکتور'],
  );
  record(
    'S1.1 deployed quotation app is the version under test',
    appRows.length === 1 && appRows[0].version === EXPECTED_APP_VERSION,
    `version=${appRows[0]?.version ?? 'missing'} expected=${EXPECTED_APP_VERSION}`,
  );

  // S1.2 — the standalone settings page and sidebar entry exist in live metadata.
  const { rows: pageRows } = await db.query(
    `select id from core."pageLayout" where "universalIdentifier" = $1`,
    [ACCOUNTING_PAGE_UNIVERSAL_IDENTIFIER],
  );
  const { rows: navRows } = await db.query(
    `select id from core."navigationMenuItem"
      where "pageLayoutId" = $1`,
    [pageRows[0]?.id ?? '00000000-0000-0000-0000-000000000000'],
  );
  record(
    'S1.2 accounting settings page and sidebar item are live',
    pageRows.length === 1 && navRows.length === 1,
    `page=${pageRows[0]?.id ?? 'missing'} navItems=${navRows.length}`,
  );

  // S1.3 — the connection inventory covers more than one adapter and more than one health
  // state, so the "switch connection" part of the form has something real to switch between.
  const { rows: connectionStates } = await db.query(
    `select "adapterId", "healthState", count(*)::int as n
       from "${schema}"."_accountingConnection"
      where "deletedAt" is null group by 1,2`,
  );
  const adapters = new Set(connectionStates.map((row) => row.adapterId));
  const healthStates = new Set(connectionStates.map((row) => row.healthState));
  record(
    'S1.3 at least three connections with varied adapters and health states',
    connectionStates.reduce((sum, row) => sum + row.n, 0) >= 3 &&
      adapters.size >= 2 &&
      healthStates.size >= 2,
    `adapters=${[...adapters].join('|')} health=${[...healthStates].join('|')}`,
  );

  const list = await rest({ action: 'accounting-connection-list' });
  const connections = list.body?.connections ?? [];
  const mockConnection =
    connections.find((row) => row.adapterId === 'mock' && row.healthState === 'OK') ??
    connections.find((row) => row.adapterId === 'mock') ??
    null;

  const appListResponse = await appRoute('/quotation/accounting-connection', {
    action: 'list',
  });
  const appList = appListResponse.body ?? {};
  record(
    'S2.1 settings payload exposes adapters, authority and both send switches',
    appList.success === true &&
      appList.canManage === true &&
      Array.isArray(appList.adapters) &&
      appList.adapters.some((row) => row.id === 'mock') &&
      appList.adapters.some((row) => row.id === 'asan') &&
      appList.flags?.outboundEnabled === false &&
      appList.flags?.documentExportEnabled === false &&
      typeof appList.credentials?.tunnelTokenConfigured === 'boolean',
    `adapters=${(appList.adapters ?? []).map((row) => row.id).join('|')} canManage=${appList.canManage} flags=${JSON.stringify(appList.flags)}`,
  );

  const settingsText = JSON.stringify(appList);
  record(
    'S2.2 no secret value or secret field is returned by the settings route',
    !/MOCK_ADAPTER_SHARED_SECRET|ASAN_TUNNEL_TOKEN|tunnelToken"|mockAdapterSharedSecret/.test(
      settingsText,
    ),
    'secret keys/values absent from payload',
  );

  if (mockConnection === null) {
    record('S1.4 mock connection is available for previews', false, 'no mock connection');
  } else {
    const items = await appRoute('/quotation/accounting-import', {
      action: 'preview-items',
      connectionId: mockConnection.recordId,
    });
    const rows = items.body?.preview?.rows ?? [];
    const warnings = new Set(rows.flatMap((row) => row.warnings ?? []));
    record(
      'S1.4 mock catalog preview returns at least 30 items',
      items.body?.success === true && rows.length >= 30,
      `rows=${rows.length}`,
    );
    record(
      'S1.5 duplicate remote code is refused in the preview',
      rows.some((row) => row.decision === 'DUPLICATE_REMOTE_CODE'),
      `duplicateRows=${rows.filter((row) => row.decision === 'DUPLICATE_REMOTE_CODE').length}`,
    );
    record(
      'S1.6 invalid id, inactive item and missing price are each explained',
      warnings.has('REMOTE_ID_NOT_NUMERIC') &&
        warnings.has('REMOTE_ITEM_INACTIVE') &&
        warnings.has('REMOTE_PRICE_MISSING'),
      `warnings=${[...warnings].join('|')}`,
    );
    record(
      'S1.7 duplicate names are visible without being treated as identity',
      warnings.has('DUPLICATE_REMOTE_NAME'),
      'DUPLICATE_REMOTE_NAME present',
    );

    const parties = await appRoute('/quotation/accounting-import', {
      action: 'preview-parties',
      connectionId: mockConnection.recordId,
    });
    const partyRows = parties.body?.preview?.rows ?? [];
    const partyWarnings = new Set(partyRows.flatMap((row) => row.warnings ?? []));
    record(
      'S3.1 mock party preview returns at least 20 customers',
      parties.body?.success === true && partyRows.length >= 20,
      `rows=${partyRows.length}`,
    );
    record(
      'S3.2 duplicate vendor id is refused instead of silently linked',
      partyRows.some((row) => row.decision === 'DUPLICATE_REMOTE_CODE'),
      'DUPLICATE_REMOTE_CODE present',
    );
    record(
      'S3.3 duplicate national code and missing candidates are explained',
      partyWarnings.has('DUPLICATE_REMOTE_NATIONAL_CODE') &&
        partyWarnings.has('NO_CRM_CANDIDATE'),
      `warnings=${[...partyWarnings].join('|')}`,
    );
    record(
      'S3.4 unambiguous customers still wait for an explicit CRM record',
      partyRows.some((row) => row.decision === 'NEEDS_CRM_RECORD'),
      `needsCrm=${partyRows.filter((row) => row.decision === 'NEEDS_CRM_RECORD').length}`,
    );

    // S4 — document preview at the quotation level, built from the sealed revision.
    const { rows: quotations } = await db.query(
      `select id, status from "${schema}"."_quotation"
        where "deletedAt" is null and status = 'CUSTOMER_ACCEPTED'
        order by "createdAt" desc limit 1`,
    );
    const quotation = quotations[0] ?? null;

    if (quotation === null) {
      record('S4.1 document preview on a sealed quotation', false, 'no accepted quotation');
    } else {
      const preview = await appRoute('/quotation/accounting-outbound', {
        action: 'preview-quotation-export',
        connectionId: mockConnection.recordId,
        quotationId: quotation.id,
      });
      const documentPreview = preview.body?.preview?.documentPreview ?? null;
      const checks = documentPreview?.checks ?? [];
      record(
        'S4.1 readiness preview returns a check matrix and line mapping',
        preview.body?.success === true &&
          preview.body?.preview?.decision?.code === 'OUTBOUND_DISABLED' &&
          checks.length >= 15 &&
          Array.isArray(documentPreview?.lines) &&
          documentPreview.lines.length ===
            (preview.body?.preview?.lineItemIds ?? []).length,
        `decision=${preview.body?.preview?.decision?.code} checks=${checks.length} lines=${documentPreview?.lines?.length}`,
      );
      record(
        'S4.2 a mock destination document is shown or its refusal is explained',
        documentPreview !== null &&
          (documentPreview.document !== null ||
            typeof documentPreview.documentError?.code === 'string'),
        documentPreview?.document === null
          ? `documentError=${documentPreview?.documentError?.code}`
          : 'document present',
      );
      record(
        'S4.3 outbound and document-export switches stay off',
        preview.body?.flags?.outboundEnabled === false &&
          preview.body?.flags?.documentExportEnabled === false,
        JSON.stringify(preview.body?.flags),
      );
      const executed = await appRoute('/quotation/accounting-outbound', {
        action: 'execute-quotation-export',
        connectionId: mockConnection.recordId,
        quotationId: quotation.id,
      });
      record(
        'S4.4 real document registration is refused',
        executed.body?.success === false && executed.body?.code === 'OUTBOUND_DISABLED',
        `code=${executed.body?.code}`,
      );
    }

    const itemPreview = rows[0] ?? null;
    record(
      'S5.1 item preview rows are previews, not writes',
      itemPreview !== null && itemPreview.existingLinkId === null,
      'no link created by preview',
    );
  }

  // S5.2 — the public GraphQL connection writer stays closed (ACCOUNTING-011 regression).
  const graphqlWrite = await gql(
    'mutation { createAccountingConnection(data: { name: "UAT-012", adapterId: "mock", baseUrl: "https://mock.invalid" }) { id } }',
  );
  record(
    'S5.2 generic GraphQL connection write is still refused',
    graphqlWrite.body?.errors?.length > 0 &&
      /ACCOUNTING_CONNECTION_WRITE_FORBIDDEN|FORBIDDEN|not allowed/i.test(
        JSON.stringify(graphqlWrite.body.errors),
      ),
    `errors=${graphqlWrite.body?.errors?.length ?? 0}`,
  );

  // S5.3 — anonymous callers cannot read or preview.
  const anonymous = await post({
    route: '/rest/quotation/actions',
    body: { action: 'accounting-connection-list' },
  });
  record(
    'S5.3 anonymous settings read is refused',
    [401, 403].includes(anonymous.status),
    `status=${anonymous.status}`,
  );

  // S5.4 — every preview above left the database untouched.
  const after = {
    connections: await count('_accountingConnection'),
    quotations: await count('_quotation'),
    revisions: await count('_quotationRevision'),
    operations: await count('_accountingSyncOperation'),
    itemLinks: await count('_accountingItemLink'),
    partyLinks: await count('_accountingPartyLink'),
  };
  record(
    'S5.4 previews created no accounting operation, link or quotation',
    JSON.stringify(before) === JSON.stringify(after),
    `${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
  );

  // S1.8 — the tax catalogue still offers the UAT rates that exist as workspace policies.
  const { rows: rates } = await db.query(
    `select distinct "rateBasisPoints" from "${schema}"."_taxPolicy" order by 1`,
  );
  const rateValues = rates.map((row) => Number(row.rateBasisPoints) / 100);
  record(
    'S1.8 workspace tax policies cover 0, 9 and 10.5 percent',
    [0, 9, 10.5].every((rate) => rateValues.includes(rate)),
    `rates=${rateValues.join(',')}`,
  );

  const failed = results.filter((row) => !row.ok);
  const summary = {
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
  fs.writeFileSync(
    path.join(__dirname, 'tmp-crm129-mock-uat-012.json'),
    JSON.stringify(summary, null, 2),
  );
  console.log(`TOTAL ${summary.passed}/${summary.total} PASS`);
  await db.end();

  if (failed.length > 0) {
    process.exit(1);
  }
})().catch(async (error) => {
  console.error('verification crashed:', error);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});
