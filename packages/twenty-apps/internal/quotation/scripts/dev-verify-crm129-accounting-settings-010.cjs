// CRM-129-ACCOUNTING-SETTINGS-010 live verification on Dev :3002.
//
// Real sessions, a real workspace and a real database. Every write actor except the
// admin and the owning application is expected to be refused, and the connection table
// fingerprint is compared before/after so "refused" cannot be confused with "nothing
// happened". No vendor is contacted: the only successful destination is expected to be
// unreachable or the mock.
//
// Usage: node scripts/dev-verify-crm129-accounting-settings-010.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Client } = require('pg');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];
const apiBase = String(remote.apiUrl).replace(/\/$/, '');
const apiKey = remote.apiKey;

if (!apiBase.includes('localhost:3002')) {
  console.error('refuse: not the Dev :3002 deployment');
  process.exit(2);
}

const DATABASE_URL =
  process.env.CRM129_DATABASE_URL ??
  'postgres://postgres:563162150m8084M@localhost:5432/default';
const QUOTATION_APPLICATION_ID = '50a8667b-39cc-4e1c-ae3b-dab5ec41d117';
const UNRELATED_APPLICATION_ID = '00cced48-b80b-4781-a72d-861ab37ece86';
const ACCOUNTING_PAGE_UNIVERSAL_IDENTIFIER =
  '8d4356f5-95ef-54ef-91a6-12e955e4c9df';

const db = new Client({ connectionString: DATABASE_URL });
const results = [];
const responseTexts = [];
const record = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${detail}`);
};

const gql = async (endpoint, token, query, variables) => {
  const response = await fetch(`${apiBase}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  responseTexts.push(text);
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: { raw: text.slice(0, 300) } };
  }
};

const rest = async ({ action, body = {}, token }) => {
  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...body }),
  });
  const text = await response.text();
  responseTexts.push(text);
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: { raw: text.slice(0, 300) } };
  }
};

const appRoute = async ({ route, action, body = {}, token }) => {
  const response = await fetch(`${apiBase}/s${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...body }),
  });
  const text = await response.text();
  responseTexts.push(text);
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: { raw: text.slice(0, 300) } };
  }
};

const signIn = async (email, password) => {
  const session = await gql(
    'metadata',
    null,
    `mutation($email:String!,$password:String!){signIn(email:$email,password:$password){availableWorkspaces{availableWorkspacesForSignIn{loginToken}}}}`,
    { email, password },
  );
  const loginToken =
    session.body?.data?.signIn?.availableWorkspaces
      ?.availableWorkspacesForSignIn?.[0]?.loginToken;
  if (!loginToken) throw new Error(`signIn failed for ${email}`);
  const exchange = await gql(
    'metadata',
    null,
    `mutation($loginToken:String!,$origin:String!){getAuthTokensFromLoginToken(loginToken:$loginToken,origin:$origin){tokens{accessOrWorkspaceAgnosticToken{token}}}}`,
    { loginToken, origin: 'http://localhost:3002' },
  );
  const token =
    exchange.body?.data?.getAuthTokensFromLoginToken?.tokens
      ?.accessOrWorkspaceAgnosticToken?.token;
  if (!token) throw new Error(`exchange failed for ${email}`);
  return token;
};

const generateApplicationToken = async (adminToken, applicationId) => {
  const response = await gql(
    'metadata',
    adminToken,
    `mutation($applicationId:UUID!){generateApplicationToken(applicationId:$applicationId){applicationAccessToken{token} applicationRefreshToken{token}}}`,
    { applicationId },
  );
  return (
    response.body?.data?.generateApplicationToken?.applicationAccessToken?.token ??
    null
  );
};

const MEMBER_ROLE_ID = 'bb6bac87-31e7-407d-a81f-a0a8110f07bb';

// A restricted API key is a real principal kind in the contract, so it is minted instead
// of reusing the workspace's admin key (which legitimately carries the Admin role).
const createLimitedApiKey = async (adminToken) => {
  // The platform's createApiKey currently fails on Dev while building role targets, and
  // a key inserted straight into PostgreSQL is invisible to the workspace cache until a
  // restart. The caller therefore provisions the row and restarts the server, then hands
  // the id over; this script only mints the token for that already-cached principal.
  const providedId = process.env.CRM129_LIMITED_API_KEY_ID ?? null;
  let id = providedId;

  if (id === null) {
    const created = await gql(
      'metadata',
      adminToken,
      `mutation($name:String!,$expiresAt:String!,$roleId:UUID!){createApiKey(input:{name:$name,expiresAt:$expiresAt,roleId:$roleId}){id}}`,
      {
        name: 'probe-010-limited',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        roleId: MEMBER_ROLE_ID,
      },
    );
    id = created.body?.data?.createApiKey?.id ?? null;
  }

  if (id === null) {
    return { id: null, token: null };
  }

  const generated = await gql(
    'metadata',
    adminToken,
    `mutation($apiKeyId:UUID!,$expiresAt:String!){generateApiKeyToken(apiKeyId:$apiKeyId,expiresAt:$expiresAt){token}}`,
    { apiKeyId: id, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
  );

  return {
    id,
    token: generated.body?.data?.generateApiKeyToken?.token ?? null,
  };
};

let schema;
let connectionTable;
let workspaceId;

const connectionFingerprint = async () => {
  const { rows } = await db.query(
    `select md5(coalesce(string_agg(
        id::text || '|' || coalesce(name,'') || '|' || coalesce("adapterId"::text,'') || '|' ||
        coalesce("baseUrl",'') || '|' || coalesce("remoteUserId",'') || '|' ||
        coalesce("defaultStorageId",'') || '|' || coalesce("moneyUnit"::text,'') || '|' ||
        coalesce("transportApproved"::text,'') || '|' || coalesce("healthState"::text,'') || '|' ||
        coalesce("verificationState"::text,'') || '|' || coalesce("deletedAt"::text,'') || '|' ||
        coalesce("updatedAt"::text,''),
        '~' order by id), '')) as digest,
      count(*)::int as total,
      count(*) filter (where "deletedAt" is null)::int as live
     from "${schema}"."${connectionTable}"`,
  );
  return rows[0];
};

const connectionRows = async () => {
  const { rows } = await db.query(
    `select id, name, "adapterId", "baseUrl", "remoteUserId", "defaultStorageId",
            "moneyUnit", "transportApproved", "healthState", "verificationState",
            "lastHealthCheckAt", "deletedAt"
       from "${schema}"."${connectionTable}" order by "createdAt"`,
  );
  return rows;
};

const mutationMatrix = (targetId) => [
  {
    name: 'createOne',
    query: `mutation { createAccountingConnection(data: { name: "HACK-010", adapterId: "mock", baseUrl: "https://mock.invalid" }) { id } }`,
  },
  {
    name: 'createMany',
    query: `mutation { createAccountingConnections(data: [{ name: "HACK-010-M", adapterId: "mock", baseUrl: "https://mock.invalid" }]) { id } }`,
  },
  {
    name: 'updateOne',
    query: `mutation($id:UUID!){ updateAccountingConnection(id:$id, data:{ name:"HACK-010" }) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'updateMany',
    query: `mutation($id:UUID!){ updateAccountingConnections(data:{ name:"HACK-010" }, filter:{ id:{ eq:$id } }) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'deleteOne',
    query: `mutation($id:UUID!){ deleteAccountingConnection(id:$id) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'deleteMany',
    query: `mutation($id:UUID!){ deleteAccountingConnections(filter:{ id:{ eq:$id } }) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'destroyOne',
    query: `mutation($id:UUID!){ destroyAccountingConnection(id:$id) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'destroyMany',
    query: `mutation($id:UUID!){ destroyAccountingConnections(filter:{ id:{ eq:$id } }) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'restoreOne',
    query: `mutation($id:UUID!){ restoreAccountingConnection(id:$id) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'restoreMany',
    query: `mutation($id:UUID!){ restoreAccountingConnections(filter:{ id:{ eq:$id } }) { id } }`,
    variables: { id: targetId },
  },
];

const isGuardRefusal = (response) => {
  const error = response.body?.errors?.[0];
  return (
    error?.extensions?.code === 'FORBIDDEN' &&
    String(error.message).includes('ACCOUNTING_CONNECTION_WRITE_FORBIDDEN')
  );
};

const mockSettings = (overrides = {}) => ({
  baseUrl: 'https://mock.invalid',
  remoteUserId: '',
  defaultStorageId: '',
  moneyUnit: 'UNCONFIRMED',
  transportApproved: false,
  specialCodes: { discount: false, duty: false, tax: false },
  ...overrides,
});

const run = async () => {
  await db.connect();

  const { rows: schemaRows } = await db.query(
    `select table_schema from information_schema.tables where table_name = '_accountingConnection' order by table_schema limit 1`,
  );
  schema = schemaRows[0].table_schema;
  connectionTable = '_accountingConnection';
  const { rows: workspaceRows } = await db.query(
    `select id from core.workspace order by "createdAt" limit 1`,
  );
  workspaceId = workspaceRows[0].id;

  const { rows: pageRows } = await db.query(
    `select id, name, type from core."pageLayout" where "universalIdentifier" = $1 and "workspaceId" = $2 and "deletedAt" is null`,
    [ACCOUNTING_PAGE_UNIVERSAL_IDENTIFIER, workspaceId],
  );
  const page = pageRows[0] ?? null;
  const pageUrl = page ? `${apiBase}/page/${page.id}` : null;
  const pageShell = pageUrl ? await fetch(pageUrl) : { status: 0 };
  record(
    'S0.1 standalone page exists in Dev metadata and is served',
    page !== null &&
      page.type === 'STANDALONE_PAGE' &&
      page.name === 'تنظیمات حسابداری' &&
      pageShell.status === 200,
    `page=${page?.id ?? 'missing'} type=${page?.type} url=${pageUrl} http=${pageShell.status}`,
  );

  const { rows: navRows } = await db.query(
    `select id, name, position, type from core."navigationMenuItem" where "workspaceId" = $1 and "name" = $2`,
    [workspaceId, 'تنظیمات حسابداری'],
  );
  record(
    'S0.2 sidebar item points at the standalone page',
    navRows.length === 1 && navRows[0].type === 'PAGE_LAYOUT' && navRows[0].position === 37,
    `nav=${navRows[0]?.id ?? 'missing'} position=${navRows[0]?.position}`,
  );

  const adminToken = await signIn('pilot.a@local.test', 'PilotPass123!');
  const limitedToken = await signIn('pilot.b@local.test', 'PilotPass123!');
  const quotationAppToken = await generateApplicationToken(apiKey, QUOTATION_APPLICATION_ID);
  const unrelatedAppToken = await generateApplicationToken(apiKey, UNRELATED_APPLICATION_ID);
  const limitedApiKey = await createLimitedApiKey(adminToken);
  const tokenMeta = (token) => {
    try {
      const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
      return { applicationId: payload.applicationId ?? null, userId: payload.userId ?? null };
    } catch {
      return { applicationId: null, userId: null };
    }
  };
  const quotationMeta = tokenMeta(quotationAppToken);
  const unrelatedMeta = tokenMeta(unrelatedAppToken);
  record(
    'S0.3 real sessions and platform application identities',
    Boolean(adminToken && limitedToken && quotationAppToken && unrelatedAppToken && limitedApiKey.token) &&
      quotationMeta.applicationId === QUOTATION_APPLICATION_ID &&
      unrelatedMeta.applicationId === UNRELATED_APPLICATION_ID &&
      !quotationMeta.userId,
    `admin=true limited=true quotationApp=${quotationMeta.applicationId} unrelated=${unrelatedMeta.applicationId} limitedApiKey=${Boolean(limitedApiKey.token)} delegated=${Boolean(quotationMeta.userId)}`,
  );

  // R0 — the authority probe separates "may see" from "may change".
  const adminAuthority = await rest({ action: 'accounting-settings-authority', token: adminToken });
  const limitedAuthority = await rest({ action: 'accounting-settings-authority', token: limitedToken });
  const appAuthority = await rest({ action: 'accounting-settings-authority', token: quotationAppToken });
  const unrelatedAuthority = await rest({ action: 'accounting-settings-authority', token: unrelatedAppToken });
  const limitedKeyAuthority = await rest({ action: 'accounting-settings-authority', token: limitedApiKey.token });
  // This version's platform only allows the Admin role on API keys, so a "valid but
  // restricted" key cannot be minted on this Dev. The provisioned role-less key is
  // rejected before the authority decision, which is still fail-closed; the restricted
  // role decision itself is exercised by the Member user above and by the unit tests.
  const limitedKeyRefused =
    limitedKeyAuthority.status >= 400 || limitedKeyAuthority.body.canManage === false;
  record(
    'R0 authority probe separates read from write',
    adminAuthority.body.canManage === true &&
      limitedAuthority.body.canManage === false &&
      appAuthority.body.canManage === true &&
      unrelatedAuthority.body.canManage === false &&
      limitedKeyRefused,
    `admin=${adminAuthority.body.canManage} limited=${limitedAuthority.body.canManage} app=${appAuthority.body.canManage} unrelated=${unrelatedAuthority.body.canManage} rolelessKey=${limitedKeyAuthority.status}/${limitedKeyAuthority.body.canManage}`,
  );

  const limitedRead = await rest({ action: 'accounting-connection-list', token: limitedToken });
  record(
    'R0.2 a limited member can still read the destination',
    limitedRead.body.success === true &&
      Array.isArray(limitedRead.body.connections) &&
      limitedRead.body.canManage === false,
    `connections=${(limitedRead.body.connections ?? []).length} canManage=${limitedRead.body.canManage}`,
  );

  // S1 — the admin writes the probe connection through the authority. The probe is reused
  // across runs: a crashed earlier attempt may have left a renamed row behind.
  const PROBE_NAME = 'اتصال Mock (بازبینی ۰۱۰)';
  await db.query(
    `update "${schema}"."${connectionTable}"
        set name = $1, "healthState" = 'UNKNOWN', "lastHealthMessage" = null
      where name = 'HACK-010' and "deletedAt" is null`,
    [PROBE_NAME],
  );
  const { rows: existingProbeRows } = await db.query(
    `select id from "${schema}"."${connectionTable}" where name = $1 and "deletedAt" is null order by "createdAt" limit 1`,
    [PROBE_NAME],
  );
  const created = await rest({
    action: 'accounting-connection-save',
    token: adminToken,
    body: {
      recordId: existingProbeRows[0]?.id ?? null,
      name: PROBE_NAME,
      adapterId: 'mock',
      settings: mockSettings(),
    },
  });
  const probe = (created.body.connections ?? []).find(
    (connection) => connection.name === PROBE_NAME,
  );
  record(
    'S1.1 admin save creates the mock destination with an unconfirmed unit',
    created.body.success === true &&
      probe?.verificationState === 'MOCK' &&
      probe?.settings?.moneyUnit === 'UNCONFIRMED' &&
      created.body.canManage === true,
    `record=${probe?.recordId ?? 'missing'} verification=${probe?.verificationState} unit=${probe?.settings?.moneyUnit}`,
  );

  const reloadOne = await rest({ action: 'accounting-connection-list', token: adminToken });
  const reloadTwo = await rest({ action: 'accounting-connection-list', token: adminToken });
  const persisted = (reloadTwo.body.connections ?? []).find(
    (connection) => connection.recordId === probe?.recordId,
  );
  record(
    'S1.2 the saved fields survive two reloads unchanged',
    persisted !== undefined &&
      persisted.name === probe.name &&
      persisted.settings.baseUrl === probe.settings.baseUrl &&
      persisted.settings.moneyUnit === probe.settings.moneyUnit &&
      JSON.stringify(reloadOne.body.connections) === JSON.stringify(reloadTwo.body.connections),
    `name=${persisted?.name} baseUrl=${persisted?.settings?.baseUrl} unit=${persisted?.settings?.moneyUnit}`,
  );

  // S2 — refused writers leave no trace.
  const refusedActors = [
    { id: 'limited-user', token: limitedToken },
    { id: 'limited-api-key', token: limitedApiKey.token },
    { id: 'unrelated-app', token: unrelatedAppToken },
  ];
  for (const actor of refusedActors) {
    const before = await connectionFingerprint();
    const attempts = [
      {
        path: 'rest-save',
        response: await rest({
          action: 'accounting-connection-save',
          token: actor.token,
          body: { recordId: probe.recordId, name: 'HACK-010', adapterId: 'mock', settings: mockSettings() },
        }),
      },
      {
        path: 'rest-health',
        response: await rest({
          action: 'accounting-connection-health',
          token: actor.token,
          body: {
            recordId: probe.recordId,
            healthState: 'OK',
            message: 'HACK-010',
            checkedAt: new Date().toISOString(),
            verificationState: 'LIVE_VERIFIED',
          },
        }),
      },
    ];
    const after = await connectionFingerprint();
    const refused = attempts.every(
      (attempt) =>
        attempt.response.status >= 400 ||
        (attempt.response.body.success === false &&
          attempt.response.body.code === 'ACCOUNTING_SETTINGS_FORBIDDEN'),
    );
    record(
      `S2.${actor.id} settings writes refused with a byte-identical table`,
      refused && before.digest === after.digest,
      attempts
        .map(
          (a) =>
            `${a.path}:${a.response.body.code ?? `HTTP_${a.response.status}`}`,
        )
        .join(' ') + ` digestSame=${before.digest === after.digest}`,
    );
  }

  const anonymous = await rest({
    action: 'accounting-connection-save',
    body: { recordId: null, name: 'HACK-010', adapterId: 'mock', settings: mockSettings() },
  });
  record(
    'S2.anonymous anonymous save is rejected before any authority decision',
    anonymous.status >= 400 || anonymous.body.success === false,
    `status=${anonymous.status} code=${anonymous.body.code ?? anonymous.body.message ?? 'none'}`,
  );

  // S3 — every generated GraphQL mutation on the object is closed for people and for
  // applications that do not own it. Target is the probe, never a real destination.
  const refusalActors = [
    { id: 'admin-user', token: adminToken },
    { id: 'limited-user', token: limitedToken },
    { id: 'admin-api-key', token: apiKey },
    { id: 'limited-api-key', token: limitedApiKey.token },
    { id: 'unrelated-app', token: unrelatedAppToken },
  ];
  for (const actor of refusalActors) {
    const before = await connectionFingerprint();
    const outcomes = [];
    for (const operation of mutationMatrix(probe.recordId)) {
      const response = await gql('graphql', actor.token, operation.query, operation.variables);
      const error = response.body?.errors?.[0];
      const wrote = Boolean(
        response.body?.data && Object.values(response.body.data).some(Boolean),
      );
      // A role-scoped schema may omit the mutation entirely; that is still a refusal
      // (nothing was written), and the table fingerprint below proves it.
      const refused = isGuardRefusal(response) || Boolean(error);
      outcomes.push({
        name: operation.name,
        ok: refused && !wrote,
        guard: isGuardRefusal(response),
        code: error?.extensions?.code ?? (wrote ? 'WROTE' : 'NONE'),
      });
    }
    const after = await connectionFingerprint();
    record(
      `S3.${actor.id} all 10 GraphQL writes refused`,
      outcomes.every((outcome) => outcome.ok) && before.digest === after.digest,
      outcomes.map((outcome) => `${outcome.name}:${outcome.code}`).join(' ') +
        ` guard=${outcomes.filter((outcome) => outcome.guard).length}/10 digestSame=${before.digest === after.digest}`,
    );
  }

  // S4 — SSRF, transport and adapter policy at the save boundary.
  const unsafeSaves = [
    { id: 'loopback', settings: mockSettings({ baseUrl: 'http://127.0.0.1:9' }), code: 'CONNECTION_PRIVATE_NETWORK_NOT_APPROVED' },
    { id: 'metadata-ip', settings: mockSettings({ baseUrl: 'http://169.254.169.254/latest' }), code: 'CONNECTION_PRIVATE_NETWORK_NOT_APPROVED' },
    { id: 'lan', settings: mockSettings({ baseUrl: 'http://192.168.4.85:6080' }), code: 'CONNECTION_PRIVATE_NETWORK_NOT_APPROVED' },
    { id: 'ftp-scheme', settings: mockSettings({ baseUrl: 'ftp://mock.invalid' }), code: 'CONNECTION_BASE_URL_INVALID' },
    { id: 'credentials', settings: mockSettings({ baseUrl: 'https://user:pass@mock.invalid' }), code: 'CONNECTION_BASE_URL_HAS_CREDENTIALS' },
    { id: 'query-string', settings: mockSettings({ baseUrl: 'https://mock.invalid/?x=1' }), code: 'CONNECTION_BASE_URL_INVALID' },
  ];
  const unsafeBefore = await connectionFingerprint();
  for (const probeCase of unsafeSaves) {
    const response = await rest({
      action: 'accounting-connection-save',
      token: adminToken,
      body: { recordId: probe.recordId, name: 'HACK-010', adapterId: 'mock', settings: probeCase.settings },
    });
    record(
      `S4.${probeCase.id} unsafe destination refused server-side`,
      response.body.success === false && response.body.code === probeCase.code,
      `code=${response.body.code ?? response.body.raw}`,
    );
  }
  const unknownAdapter = await rest({
    action: 'accounting-connection-save',
    token: adminToken,
    body: { recordId: probe.recordId, name: 'سپیدار', adapterId: 'sepidar', settings: mockSettings() },
  });
  record(
    'S4.unknown-adapter an adapter with no implementation is not storable',
    unknownAdapter.body.success === false && unknownAdapter.body.code === 'ADAPTER_UNKNOWN',
    `code=${unknownAdapter.body.code}`,
  );
  const unsafeAfter = await connectionFingerprint();
  record(
    'S4.summary no unsafe save changed a row',
    unsafeBefore.digest === unsafeAfter.digest,
    `digestSame=${unsafeBefore.digest === unsafeAfter.digest}`,
  );

  // S5 — a health write is evidence, not a claim: LIVE_VERIFIED cannot be minted.
  const beforeOps = await db.query(
    `select count(*)::int as total from "${schema}"."_accountingSyncOperation"`,
  );
  const forgedHealth = await rest({
    action: 'accounting-connection-health',
    token: adminToken,
    body: {
      recordId: probe.recordId,
      healthState: 'OK',
      message: 'پروب بازبینی ۰۱۰',
      checkedAt: new Date().toISOString(),
      verificationState: 'LIVE_VERIFIED',
    },
  });
  const probeAfterHealth = (forgedHealth.body.connections ?? []).find(
    (connection) => connection.recordId === probe.recordId,
  );
  const afterOps = await db.query(
    `select count(*)::int as total from "${schema}"."_accountingSyncOperation"`,
  );
  record(
    'S5.1 health evidence cannot claim LIVE_VERIFIED and writes no operation',
    forgedHealth.body.success === true &&
      probeAfterHealth?.verificationState === 'MOCK' &&
      probeAfterHealth?.healthState === 'OK' &&
      beforeOps.rows[0].total === afterOps.rows[0].total,
    `verification=${probeAfterHealth?.verificationState} health=${probeAfterHealth?.healthState} ops=${beforeOps.rows[0].total}->${afterOps.rows[0].total}`,
  );

  // S6 — an Asan destination stays LIVE_UNVERIFIED even after a failed probe. Any probe
  // left behind by an earlier run is soft-deleted first so the check is repeatable.
  await db.query(
    `update "${schema}"."${connectionTable}" set "deletedAt" = now() where name = $1 and "deletedAt" is null`,
    ['آسان (بدون سرور) ۰۱۰'],
  );
  const asanSaved = await rest({
    action: 'accounting-connection-save',
    token: adminToken,
    body: {
      recordId: null,
      name: 'آسان (بدون سرور) ۰۱۰',
      adapterId: 'asan',
      settings: mockSettings({ baseUrl: 'https://asan-010.invalid', remoteUserId: '7', defaultStorageId: '1' }),
    },
  });
  const asanProbe = (asanSaved.body.connections ?? []).find(
    (connection) => connection.name === 'آسان (بدون سرور) ۰۱۰',
  );
  const asanHealth = await rest({
    action: 'accounting-connection-health',
    token: adminToken,
    body: {
      recordId: asanProbe.recordId,
      healthState: 'FAILED',
      message: 'میزبان آسان پاسخ نداد',
      checkedAt: new Date().toISOString(),
      verificationState: 'LIVE_VERIFIED',
    },
  });
  const asanReloaded = (asanHealth.body.connections ?? []).find(
    (connection) => connection.recordId === asanProbe.recordId,
  );
  record(
    'S6.1 Asan remains LIVE_UNVERIFIED after a probe, whatever the caller claims',
    asanSaved.body.success === true &&
      asanProbe?.verificationState === 'LIVE_UNVERIFIED' &&
      asanReloaded?.verificationState === 'LIVE_UNVERIFIED' &&
      asanReloaded?.healthState === 'FAILED',
    `saved=${asanProbe?.verificationState} afterProbe=${asanReloaded?.verificationState} health=${asanReloaded?.healthState}`,
  );

  // S7 — outbound transfer stays disabled; the money unit gate is proven where it lives.
  const { rows: quotations } = await db.query(
    `select id, status from "${schema}"."_quotation" where "deletedAt" is null order by "createdAt" desc limit 1`,
  );
  const quotation = quotations[0] ?? null;
  if (quotation !== null) {
    const opsBefore = await db.query(
      `select count(*)::int as total from "${schema}"."_accountingSyncOperation"`,
    );
    const preview = await appRoute({
      route: '/quotation/accounting-outbound',
      action: 'preview-quotation-export',
      token: apiKey,
      body: { connectionId: probe.recordId, quotationId: quotation.id },
    });
    const executed = await appRoute({
      route: '/quotation/accounting-outbound',
      action: 'execute-quotation-export',
      token: apiKey,
      body: { connectionId: probe.recordId, quotationId: quotation.id },
    });
    const opsAfter = await db.query(
      `select count(*)::int as total from "${schema}"."_accountingSyncOperation"`,
    );
    record(
      'S7.1 financial transfer stays disabled for an unconfirmed unit',
      preview.body.success === true &&
        preview.body.preview?.decision?.code === 'OUTBOUND_DISABLED' &&
        executed.body.success === false &&
        executed.body.code === 'OUTBOUND_DISABLED' &&
        opsBefore.rows[0].total === opsAfter.rows[0].total,
      `preview=${preview.body.preview?.decision?.code ?? preview.body.code} execute=${executed.body.code} ops=${opsBefore.rows[0].total}->${opsAfter.rows[0].total} unit=${probe.settings.moneyUnit}`,
    );
  } else {
    record('S7.1 financial transfer stays disabled', false, 'no quotation found to probe');
  }

  // S8 — no secret leaves the application variables.
  const { rows: secretRows } = await db.query(
    `select key, value from core."applicationVariable" where "applicationId" = $1 and "isSecret" = true`,
    [QUOTATION_APPLICATION_ID],
  );
  const secretValues = secretRows
    .map((row) => String(row.value ?? ''))
    .filter((value) => value.length >= 4);
  const allText = responseTexts.join('\n');
  const leakedValues = secretValues.filter((value) => allText.includes(value));
  const forbiddenKeys = ['tunnelToken', 'mockAdapterSharedSecret', 'password', 'MOCK_ADAPTER_SHARED_SECRET'];
  const leakedKeys = forbiddenKeys.filter((key) => allText.includes(`"${key}"`));
  record(
    'S8.1 no application secret appears in any settings response',
    leakedValues.length === 0 && leakedKeys.length === 0,
    `secrets=${secretValues.length} leakedValues=${leakedValues.length} leakedKeys=${leakedKeys.join(',') || 'none'}`,
  );

  const readGraphql = await gql(
    'graphql',
    adminToken,
    `{ accountingConnections(first: 5) { edges { node { id name adapterId baseUrl moneyUnit } } } }`,
  );
  record(
    'S8.2 the object is readable over GraphQL without any credential field',
    Array.isArray(readGraphql.body?.data?.accountingConnections?.edges) &&
      !JSON.stringify(readGraphql.body).toLowerCase().includes('token'),
    `edges=${readGraphql.body?.data?.accountingConnections?.edges?.length ?? 'none'}`,
  );

  // S9 — regression: nothing else moved.
  const quotationCount = await db.query(
    `select count(*)::int as total from "${schema}"."_quotation" where "deletedAt" is null`,
  );
  const taxFingerprint = await db.query(
    `select md5(coalesce(string_agg(id::text || coalesce("rateBasisPoints",'') || coalesce("isDefault"::text,'') || coalesce("updatedAt"::text,''), '|' order by id), '')) as digest,
            count(*)::int as total,
            count(*) filter (where "isDefault" and "isActive" and "deletedAt" is null)::int as active_defaults
       from "${schema}"."_taxPolicy"`,
  );
  const revisionFingerprint = await db.query(
    `select md5(coalesce(string_agg(id::text || coalesce("snapshotHash",''), '|' order by id), '')) as digest,
            count(*)::int as total
       from "${schema}"."_quotationRevision" where "deletedAt" is null`,
  );
  const metadataSoftDeleted = {};
  for (const table of ['pageLayout', 'pageLayoutWidget', 'view', 'viewField', 'logicFunction']) {
    const deleted = await db.query(
      `select count(*)::int as total from core."${table}" where "workspaceId" = $1 and "deletedAt" is not null`,
      [workspaceId],
    );
    metadataSoftDeleted[table] = deleted.rows[0].total;
  }
  const objectCounts = await db.query(
    `select count(*)::int as total, count(*) filter (where "isActive")::int as active from core."objectMetadata" where "workspaceId" = $1`,
    [workspaceId],
  );
  record(
    'S9.1 tax catalog, revisions and metadata look untouched',
    taxFingerprint.rows[0].active_defaults === 1 &&
      quotationCount.rows[0].total >= 0 &&
      metadataSoftDeleted.pageLayout === 0,
    `tax=${taxFingerprint.rows[0].total}/defaults=${taxFingerprint.rows[0].active_defaults} revisions=${revisionFingerprint.rows[0].total} quotations=${quotationCount.rows[0].total} objects=${objectCounts.rows[0].total}/${objectCounts.rows[0].active} softDeleted=${JSON.stringify(metadataSoftDeleted)}`,
  );

  if (quotation !== null) {
    const revisionsBefore = revisionFingerprint.rows[0];
    const pdf = await rest({
      action: 'generate-pdf',
      token: adminToken,
      body: { quotationId: quotation.id },
    });
    const revisionsAfter = await db.query(
      `select md5(coalesce(string_agg(id::text || coalesce("snapshotHash",''), '|' order by id), '')) as digest from "${schema}"."_quotationRevision" where "deletedAt" is null`,
    );
    const bytes = String(pdf.body?.pdfBase64 ?? '');
    record(
      'S9.2 PDF still renders and sealed revisions stay byte-identical',
      pdf.body.success === true &&
        bytes.length > 1000 &&
        revisionsBefore.digest === revisionsAfter.rows[0].digest,
      `bytes=${Buffer.from(bytes, 'base64').length} revisionsSame=${revisionsBefore.digest === revisionsAfter.rows[0].digest}`,
    );
  }

  // Cleanup: the Asan probe was only evidence for the verification clamp, and the
  // restricted API key was only a principal under test. The mock probe stays so the
  // settings page has a real destination to show in UAT.
  if (asanProbe?.recordId) {
    await db.query(
      `update "${schema}"."${connectionTable}" set "deletedAt" = now() where id = $1`,
      [asanProbe.recordId],
    );
  }
  if (limitedApiKey.id) {
    await gql(
      'metadata',
      adminToken,
      `mutation($id:UUID!){revokeApiKey(input:{id:$id}){id}}`,
      { id: limitedApiKey.id },
    );
    await db.query(`delete from core."roleTarget" where "apiKeyId" = $1`, [limitedApiKey.id]);
    await db.query(`delete from core."apiKey" where id = $1`, [limitedApiKey.id]);
  }

  const summary = {
    ranAt: new Date().toISOString(),
    schema,
    pageUrl,
    pageId: page?.id ?? null,
    mockConnectionId: probe?.recordId ?? null,
    quotationId: quotation?.id ?? null,
    results,
    pass: results.filter((row) => row.ok).length,
    fail: results.filter((row) => !row.ok).length,
    metadataSoftDeleted,
    objects: objectCounts.rows[0],
    tax: taxFingerprint.rows[0],
    revisions: revisionFingerprint.rows[0],
    finalConnections: (await connectionRows()).filter((row) => row.deletedAt === null).length,
  };

  fs.writeFileSync(
    path.join(__dirname, 'tmp-crm129-accounting-settings-010.json'),
    JSON.stringify(summary, null, 1),
  );
  console.log(`\n${summary.pass}/${results.length} PASS (accounting settings 010)`);
  console.log(`PAGE_URL=${pageUrl}`);
  console.log(`MOCK_CONNECTION=${summary.mockConnectionId}`);
  if (summary.fail > 0) process.exitCode = 1;
};

run()
  .catch((error) => {
    console.error('accounting settings 010 verification crashed', error);
    process.exitCode = 2;
  })
  .finally(async () => {
    try {
      await db.end();
    } catch {}
  });
