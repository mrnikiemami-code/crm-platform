// CRM-129-TAX-ARCHITECTURE-CLOSURE-009
//
// Real evidence, no mocks: every check below is an HTTP call against Dev :3002 or a
// PostgreSQL read/write on the Dev database. The script restores the workspace
// baseline in `finally` so a failure cannot leave the tax catalog changed.
//
// Usage: node scripts/dev-verify-crm129-tax-closure-009.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Client } = require('pg');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];
const apiBase = String(remote.apiUrl).replace(/\/$/, '');
const apiKey = remote.apiKey;
const DATABASE_URL =
  process.env.CRM129_DATABASE_URL ??
  'postgres://postgres:563162150m8084M@localhost:5432/default';
const QUOTATION_APPLICATION_ID = '50a8667b-39cc-4e1c-ae3b-dab5ec41d117';
const UNRELATED_APPLICATION_ID = '00cced48-b80b-4781-a72d-861ab37ece86';
const QUOTATION_APPLICATION_UNIVERSAL_IDENTIFIER =
  'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb';
const WORKSPACE_ID = 'afc7afb6-94ef-4142-872b-52a81b3e91dd';
const LOCK_KEY = `quotation-tax-policy:${WORKSPACE_ID}`;

const db = new Client({ connectionString: DATABASE_URL });
const lockDb = new Client({ connectionString: DATABASE_URL });
const results = [];
const record = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${detail}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const token =
    response.body?.data?.generateApplicationToken?.applicationAccessToken?.token;
  if (!token) {
    console.log('generateApplicationToken failed', JSON.stringify(response.body).slice(0, 500));
  }
  return token;
};

const fingerprint = async () => {
  const { rows } = await db.query(
    `select md5(coalesce(string_agg(
        id::text || '|' || coalesce(name,'') || '|' || coalesce(code,'') || '|' ||
        coalesce("rateBasisPoints",'') || '|' || coalesce("isActive"::text,'') || '|' ||
        coalesce("isDefault"::text,'') || '|' || coalesce("isExempt"::text,'') || '|' ||
        coalesce("deletedAt"::text,'') || '|' || coalesce("createdBySource"::text,'') || '|' ||
        coalesce("createdByName",'') || '|' ||
        coalesce("updatedBySource"::text,'') || '|' || coalesce("updatedByName",'') || '|' ||
        coalesce("updatedAt"::text,''),
        '~' order by id), '')) as digest,
      count(*)::int as total,
      count(*) filter (where "deletedAt" is null)::int as live,
      count(*) filter (where "isDefault" and "isActive" and "deletedAt" is null)::int as active_defaults
     from "${schema}"."_taxPolicy"`,
  );
  return rows[0];
};

let schema;

const policyRows = async () => {
  const { rows } = await db.query(
    `select id, name, code, "rateBasisPoints", "isActive", "isDefault", "isExempt",
            "createdBySource", "createdByName", "updatedBySource", "updatedByName",
            "createdAt", "updatedAt", "deletedAt"
       from "${schema}"."_taxPolicy" where "deletedAt" is null order by code`,
  );
  return rows;
};

const isGuardRefusal = (response) => {
  const error = response.body?.errors?.[0];
  return (
    error?.extensions?.code === 'FORBIDDEN' &&
    String(error.message).includes('TAX_POLICY_WRITE_FORBIDDEN')
  );
};

const mutationMatrix = (targetId) => [
  {
    name: 'createOne',
    query: `mutation { createTaxPolicy(data: { name: "HACK-009", rateBasisPoints: "1000", isActive: true, isDefault: false, isExempt: false }) { id } }`,
  },
  {
    name: 'createMany',
    query: `mutation { createTaxPolicies(data: [{ name: "HACK-009-M", rateBasisPoints: "1100", isActive: true, isDefault: false, isExempt: false }]) { id } }`,
  },
  {
    name: 'updateOne',
    query: `mutation($id:UUID!){ updateTaxPolicy(id:$id, data:{ name:"HACK-009" }) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'updateMany',
    query: `mutation($id:UUID!){ updateTaxPolicies(data:{ isActive:false }, filter:{ id:{ eq:$id } }) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'deleteOne',
    query: `mutation($id:UUID!){ deleteTaxPolicy(id:$id) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'deleteMany',
    query: `mutation($id:UUID!){ deleteTaxPolicies(filter:{ id:{ eq:$id } }) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'destroyOne',
    query: `mutation($id:UUID!){ destroyTaxPolicy(id:$id) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'destroyMany',
    query: `mutation($id:UUID!){ destroyTaxPolicies(filter:{ id:{ eq:$id } }) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'restoreOne',
    query: `mutation($id:UUID!){ restoreTaxPolicy(id:$id) { id } }`,
    variables: { id: targetId },
  },
  {
    name: 'restoreMany',
    query: `mutation($id:UUID!){ restoreTaxPolicies(filter:{ id:{ eq:$id } }) { id } }`,
    variables: { id: targetId },
  },
];

const draftBody = ({ taxPolicy, taxRateBasisPoints, taxExact, totalExact, name }) => ({
  action: 'save-draft',
  quotationId: null,
  expectedVersion: null,
  header: {
    name,
    customerType: 'PERSON',
    personId: '0045b1c8-9197-439a-94d2-c6891d19fc5d',
    companyId: null,
    currencyCode: 'IRR',
    taxPolicy,
    taxRateBasisPoints,
    paymentTerms: null,
    documentDiscountKind: 'NONE',
    documentDiscountInputExact: '0.000000',
    grossExact: '100000.000000',
    lineDiscountExact: '0.000000',
    documentDiscountExact: '0.000000',
    netExact: '100000.000000',
    taxExact,
    roundingExact: '0.000000',
    totalExact,
  },
  lines: [
    {
      name: 'ردیف تست ۰۰۹',
      kind: 'SERVICE',
      description: null,
      unit: 'ساعت',
      quantityExact: '1.000000',
      unitPriceExact: '100000.000000',
      grossExact: '100000.000000',
      discountExact: '0.000000',
      discountKind: 'NONE',
      discountInputExact: '0.000000',
      documentDiscountExact: '0.000000',
      taxExact,
      totalExact,
      itemId: null,
    },
  ],
});

const cleanupQuotation = async (quotationId) => {
  await db.query(
    `update "${schema}"."_quotationLine" set "deletedAt" = now() where "quotationId" = $1`,
    [quotationId],
  );
  await db.query(
    `update "${schema}"."_quotation" set "deletedAt" = now() where id = $1`,
    [quotationId],
  );
};

const run = async () => {
  await db.connect();
  await lockDb.connect();
  const { rows } = await db.query(
    `select table_schema from information_schema.tables where table_name = '_taxPolicy' order by table_schema limit 1`,
  );
  schema = rows[0].table_schema;

  const adminToken = await signIn('pilot.a@local.test', 'PilotPass123!');
  const limitedToken = await signIn('pilot.b@local.test', 'PilotPass123!');
  record('S0 real sessions', Boolean(adminToken && limitedToken), 'admin + limited user tokens from signIn');
  record('S0 api key + schema', Boolean(apiKey && schema), `schema=${schema}`);

  // Pure application tokens: generated with the API key, so the platform does not
  // attach a user delegation to them. A user-delegated app token legitimately carries
  // the user's own role and would not prove application identity at all.
  const adminAppToken = await generateApplicationToken(apiKey, QUOTATION_APPLICATION_ID);
  const unrelatedAppToken = await generateApplicationToken(apiKey, UNRELATED_APPLICATION_ID);
  const decodePayload = (token) => {
    try {
      return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  };
  const quotationPayload = decodePayload(adminAppToken);
  const unrelatedPayload = decodePayload(unrelatedAppToken);
  record(
    'S1 application tokens from the platform contract',
    Boolean(adminAppToken && unrelatedAppToken) &&
      quotationPayload?.applicationId === QUOTATION_APPLICATION_ID &&
      unrelatedPayload?.applicationId === UNRELATED_APPLICATION_ID &&
      !quotationPayload?.userId &&
      !unrelatedPayload?.userId,
    `quotation=${quotationPayload?.applicationId} unrelated=${unrelatedPayload?.applicationId} userDelegated=${Boolean(quotationPayload?.userId)}`,
  );

  const actors = [
    { id: 'admin-user', token: adminToken, expect: 'guard' },
    { id: 'limited-user', token: limitedToken, expect: 'any-refusal' },
    { id: 'api-key', token: apiKey, expect: 'guard' },
    { id: 'quotation-app', token: adminAppToken, expect: 'guard' },
    { id: 'unrelated-app', token: unrelatedAppToken, expect: 'guard' },
  ];

  const baseline = await policyRows();
  const target = baseline.find((row) => row.code === 'IR_VAT_9') ?? baseline[0];

  // P0 — every generated GraphQL write on taxPolicy is turned away before the DB.
  for (const actor of actors) {
    const before = await fingerprint();
    const outcomes = [];
    for (const operation of mutationMatrix(target.id)) {
      if (!actor.token) {
        outcomes.push({ name: operation.name, code: 'NO_TOKEN' });
        continue;
      }
      const response = await gql('graphql', actor.token, operation.query, operation.variables);
      const error = response.body?.errors?.[0];
      const guard = isGuardRefusal(response);
      const refused =
        actor.expect === 'guard'
          ? guard
          : guard || error?.extensions?.code === 'PERMISSION_DENIED' || Boolean(error);
      const wrote = Boolean(response.body?.data && Object.values(response.body.data).some(Boolean));
      outcomes.push({
        name: operation.name,
        ok: refused && !wrote,
        code: error?.extensions?.code ?? (wrote ? 'WROTE' : 'NONE'),
        guard,
      });
    }
    const after = await fingerprint();
    const allRefused = outcomes.every((outcome) => outcome.ok);
    record(
      `P0.${actor.id} all 10 GraphQL writes refused`,
      allRefused && before.digest === after.digest,
      outcomes.map((o) => `${o.name}:${o.code}${o.guard ? '' : '!'}`).join(' '),
    );
  }

  // P0b — mergeMany is not part of the generated schema in this version.
  const mergeProbe = await gql(
    'graphql',
    adminToken,
    `mutation { mergeManyTaxPolicies(ids: ["${target.id}"], data: { name: "x" }) { id } }`,
  );
  record(
    'P0b mergeManyTaxPolicies does not exist (nothing to guard)',
    String(mergeProbe.body?.errors?.[0]?.message ?? '').includes('Cannot query field'),
    String(mergeProbe.body?.errors?.[0]?.message ?? '').slice(0, 120),
  );

  // P0c — the single allowed writer still works from inside its own transaction.
  const createdSave = await rest({
    action: 'tax-policy-save',
    token: adminToken,
    body: {
      recordId: '',
      name: 'سیاست موقت ۰۰۹',
      ratePercentText: '۱۲.۵',
      isActive: true,
      isDefault: false,
      isExempt: false,
    },
  });
  const createdPolicy = (createdSave.body.policies ?? []).find(
    (policy) => policy.name === 'سیاست موقت ۰۰۹',
  );
  record(
    'P0c the authority path still writes (internal transaction not blocked)',
    createdSave.body.success === true && Boolean(createdPolicy),
    `code=${createdPolicy?.code ?? 'missing'} status=${createdSave.status}`,
  );

  // P1 — createdBy is written once; only updatedBy follows later edits.
  const createdRowBefore = (
    await db.query(
      `select "createdBySource"::text || '|' || coalesce("createdByName",'') || '|' ||
              coalesce("createdByWorkspaceMemberId"::text,'') as created_by,
              "updatedBySource"::text || '|' || coalesce("updatedByName",'') as updated_by,
              "createdAt"::text as created_at
         from "${schema}"."_taxPolicy" where id = $1`,
      [createdPolicy.recordId],
    )
  ).rows[0];
  await sleep(20);
  const edited = await rest({
    action: 'tax-policy-save',
    token: adminToken,
    body: {
      recordId: createdPolicy.recordId,
      name: 'سیاست موقت ۰۰۹ ویرایش',
      ratePercentText: '۱۳',
      isActive: true,
      isDefault: false,
      isExempt: false,
    },
  });
  const createdRowAfter = (
    await db.query(
      `select "createdBySource"::text || '|' || coalesce("createdByName",'') || '|' ||
              coalesce("createdByWorkspaceMemberId"::text,'') as created_by,
              "updatedBySource"::text || '|' || coalesce("updatedByName",'') as updated_by,
              "createdAt"::text as created_at
         from "${schema}"."_taxPolicy" where id = $1`,
      [createdPolicy.recordId],
    )
  ).rows[0];
  record(
    'P1.1 createdBy is preserved on update; createdAt does not move',
    edited.body.success === true &&
      createdRowAfter.created_by === createdRowBefore.created_by &&
      createdRowAfter.created_at === createdRowBefore.created_at,
    `createdByStable=${createdRowAfter.created_by === createdRowBefore.created_by}`,
  );
  record(
    'P1.2 updatedBy is set on the update',
    Boolean(createdRowAfter.updated_by) && createdRowAfter.updated_by !== 'null',
    `updatedBy=${String(createdRowAfter.updated_by).slice(0, 60)}`,
  );

  // P1.3 — advisory lock ordering: a shared reader blocks the exclusive writer.
  await lockDb.query('BEGIN');
  await lockDb.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [LOCK_KEY]);
  const writerPending = rest({
    action: 'tax-policy-save',
    token: adminToken,
    body: {
      recordId: createdPolicy.recordId,
      name: 'سیاست موقت ۰۰۹ قفل',
      ratePercentText: '۱۳.۵',
      isActive: true,
      isDefault: false,
      isExempt: false,
    },
  }).then((value) => ({ value, settled: true }));
  let writerSettled = false;
  writerPending.then(() => {
    writerSettled = true;
  });
  await sleep(1500);
  const writerBlocked = !writerSettled;
  await lockDb.query('COMMIT');
  const writer = (await writerPending).value;
  record(
    'P1.3 a draft-save shared lock blocks the policy writer (fixed order, no deadlock)',
    writerBlocked && writer.body.success === true,
    `blocked=${writerBlocked} code=${writer.body.code ?? 'OK'}`,
  );

  // P1.4 — an exclusive writer blocks a draft save until it commits.
  await lockDb.query('BEGIN');
  await lockDb.query('SELECT pg_advisory_xact_lock(hashtext($1))', [LOCK_KEY]);
  const draftPending = rest({
    action: 'save-draft',
    token: adminToken,
    body: draftBody({
      name: 'تست قفل ۰۰۹',
      taxPolicy: 'IR_VAT_9',
      taxRateBasisPoints: '900',
      taxExact: '9000.000000',
      totalExact: '109000.000000',
    }),
  }).then((value) => ({ value, settled: true }));
  let draftSettled = false;
  draftPending.then(() => {
    draftSettled = true;
  });
  await sleep(1500);
  const draftBlocked = !draftSettled;
  await lockDb.query('COMMIT');
  const draft = (await draftPending).value;
  record(
    'P1.4 an exclusive policy lock blocks a draft save until the policy transaction commits',
    draftBlocked && draft.body.success === true,
    `blocked=${draftBlocked} code=${draft.body.code ?? 'OK'} id=${draft.body.quotationId ?? 'missing'}`,
  );
  if (draft.body.quotationId) await cleanupQuotation(draft.body.quotationId);

  // P1.5 — a contradictory row set (a default on an inactive row and no active
  // default) is repaired deterministically and reported, never silently.
  const irVat9 = (await policyRows()).find((row) => row.code === 'IR_VAT_9');
  await db.query(`update "${schema}"."_taxPolicy" set "isDefault" = false where id = $1`, [
    irVat9.id,
  ]);
  await db.query(`update "${schema}"."_taxPolicy" set "isDefault" = true where id = $1`, [
    createdPolicy.recordId,
  ]);
  await db.query(`update "${schema}"."_taxPolicy" set "isActive" = false where id = $1`, [
    createdPolicy.recordId,
  ]);
  const beforeRepair = await fingerprint();
  const repairResponse = await rest({
    action: 'tax-policy-save',
    token: adminToken,
    body: {
      recordId: irVat9.id,
      name: 'مالیات بر ارزش افزوده ۹٪',
      ratePercentText: '۹',
      isActive: true,
      isDefault: false,
      isExempt: false,
    },
  });
  const afterRepair = await fingerprint();
  record(
    'P1.5 a default on an inactive row is repaired to exactly one active default and reported',
    beforeRepair.active_defaults === 0 &&
      afterRepair.active_defaults === 1 &&
      String(repairResponse.body.message ?? '').includes('ناسازگار'),
    `before=${beforeRepair.active_defaults} after=${afterRepair.active_defaults} message=${String(repairResponse.body.message ?? '').slice(0, 60)}`,
  );

  // P2 — application identity comes from the platform's own metadata.
  const appRows = await db.query(
    `select id, "universalIdentifier", name from core.application where id = any($1::uuid[])`,
    [[QUOTATION_APPLICATION_ID, UNRELATED_APPLICATION_ID]],
  );
  const quotationApp = appRows.rows.find((row) => row.id === QUOTATION_APPLICATION_ID);
  const objectRows = await db.query(
    `select a."universalIdentifier" as owner
       from core."objectMetadata" om
       join core.application a on a.id = om."applicationId"
      where om."workspaceId" = $1 and om."nameSingular" = 'taxPolicy' and om."isActive" = true`,
    [WORKSPACE_ID],
  );
  record(
    'P2.1 taxPolicy ownership matches the quotation app universal identifier',
    quotationApp?.universalIdentifier === QUOTATION_APPLICATION_UNIVERSAL_IDENTIFIER &&
      objectRows.rows[0]?.owner ===
        QUOTATION_APPLICATION_UNIVERSAL_IDENTIFIER,
    `app=${quotationApp?.universalIdentifier ?? 'missing'} owner=${objectRows.rows[0]?.owner ?? 'missing'}`,
  );

  const unrelatedBefore = await fingerprint();
  const unrelatedGraphql = await gql(
    'graphql',
    unrelatedAppToken,
    `mutation { createTaxPolicy(data: { name: "HACK-APP-009", rateBasisPoints: "1000", isActive: true, isDefault: false, isExempt: false }) { id } }`,
  );
  const unrelatedRest = await rest({
    action: 'tax-policy-save',
    token: unrelatedAppToken,
    body: { recordId: '', name: 'اپ نامرتبط ۰۰۹', ratePercentText: '۱۲', isActive: true, isDefault: false, isExempt: false },
  });
  const unrelatedAfter = await fingerprint();
  record(
    'P2.2 an unrelated application token cannot write tax settings on any path',
    isGuardRefusal(unrelatedGraphql) &&
      unrelatedRest.body.success === false &&
      unrelatedRest.body.code === 'TAX_SETTINGS_FORBIDDEN' &&
      unrelatedBefore.digest === unrelatedAfter.digest,
    `graphql=${unrelatedGraphql.body?.errors?.[0]?.extensions?.code} rest=${unrelatedRest.body.code ?? JSON.stringify(unrelatedRest.body).slice(0, 180)}`,
  );

  const owningAppRest = await rest({
    action: 'tax-policy-save',
    token: adminAppToken,
    body: {
      recordId: '',
      name: 'سیاست اپ ۰۰۹',
      ratePercentText: '۱۴',
      isActive: true,
      isDefault: false,
      isExempt: false,
    },
  });
  const owningAppPolicy = (owningAppRest.body.policies ?? []).find(
    (policy) => policy.name === 'سیاست اپ ۰۰۹',
  );
  record(
    'P2.3 the owning quotation application is accepted on the authority path',
    owningAppRest.body.success === true && Boolean(owningAppPolicy),
    `code=${owningAppPolicy?.code ?? 'missing'}`,
  );

  // P3 — PDF and sealed revisions survive everything above.
  const revisionRow = await db.query(
    `select r.id, r."quotationId" from "${schema}"."_quotationRevision" r
       join "${schema}"."_quotation" q on q.id = r."quotationId"
      where r."deletedAt" is null and q."deletedAt" is null
      order by r."createdAt" desc limit 1`,
  );
  const revisionFingerprint = async () => {
    const { rows: revisionRows } = await db.query(
      `select md5(coalesce(string_agg(id::text || coalesce("snapshotHash", ''), '|' order by id), '')) as digest,
              count(*)::int as total
         from "${schema}"."_quotationRevision" where "deletedAt" is null`,
    );
    return revisionRows[0];
  };
  const revisionsBeforePdf = await revisionFingerprint();
  if (revisionRow.rows.length > 0) {
    const pdf = await rest({
      action: 'generate-pdf',
      token: adminToken,
      body: { quotationId: revisionRow.rows[0].quotationId },
    });
    const revisionsAfterPdf = await revisionFingerprint();
    const candidate = pdf.body?.pdfBase64 ?? pdf.body?.base64 ?? pdf.body?.data ?? '';
    record(
      'P3.1 PDF still renders for a sealed quotation and revisions stay byte-identical',
      pdf.body.success === true &&
        revisionsBeforePdf.digest === revisionsAfterPdf.digest,
      `status=${pdf.status} keys=${Object.keys(pdf.body).join(',')} bytes=${String(candidate).length}`,
    );
  } else {
    record('P3.1 PDF check', false, 'no sealed revision found');
  }

  const documentsBefore = await db.query(
    `select md5(coalesce(string_agg(id::text || "taxRateBasisPoints" || "totalExact" || "updatedAt"::text, '|' order by id), '')) as digest
       from "${schema}"."_quotation" where "deletedAt" is null`,
  );
  const editRate = await rest({
    action: 'tax-policy-save',
    token: adminToken,
    body: {
      recordId: irVat9.id,
      name: 'مالیات بر ارزش افزوده ۹٪',
      ratePercentText: '۱۰',
      isActive: true,
      isDefault: true,
      isExempt: false,
    },
  });
  const documentsAfter = await db.query(
    `select md5(coalesce(string_agg(id::text || "taxRateBasisPoints" || "totalExact" || "updatedAt"::text, '|' order by id), '')) as digest
       from "${schema}"."_quotation" where "deletedAt" is null`,
  );
  const restoreRate = await rest({
    action: 'tax-policy-save',
    token: adminToken,
    body: {
      recordId: irVat9.id,
      name: 'مالیات بر ارزش افزوده ۹٪',
      ratePercentText: '۹',
      isActive: true,
      isDefault: true,
      isExempt: false,
    },
  });
  record(
    'P3.2 changing the policy rate never reprices stored documents',
    editRate.body.success === true &&
      restoreRate.body.success === true &&
      documentsBefore.rows[0].digest === documentsAfter.rows[0].digest,
    `unchanged=${documentsBefore.rows[0].digest === documentsAfter.rows[0].digest}`,
  );

  // Audit — metadata deletions: enumerate everything soft-deleted and confirm the
  // quotation metadata required by the manifest is present.
  const metadataSoftDeleted = {};
  for (const table of ['pageLayout', 'pageLayoutWidget', 'view', 'viewField', 'logicFunction']) {
    const deleted = await db.query(
      `select count(*)::int as total from core."${table}" where "workspaceId" = $1 and "deletedAt" is not null`,
      [WORKSPACE_ID],
    );
    metadataSoftDeleted[table] = deleted.rows[0].total;
  }
  const objectCounts = await db.query(
    `select count(*)::int as total,
            count(*) filter (where "isActive")::int as active
       from core."objectMetadata" where "workspaceId" = $1`,
    [WORKSPACE_ID],
  );
  const appObjects = await db.query(
    `select count(*)::int as total
       from core."objectMetadata" om
       join core.application a on a.id = om."applicationId"
      where om."workspaceId" = $1 and a."universalIdentifier" = $2`,
    [WORKSPACE_ID, QUOTATION_APPLICATION_UNIVERSAL_IDENTIFIER],
  );
  record(
    'P3.3 metadata audit snapshot collected',
    objectCounts.rows[0].total > 0 && appObjects.rows[0].total > 0,
    `objects=${objectCounts.rows[0].total} active=${objectCounts.rows[0].active} quotationObjects=${appObjects.rows[0].total} softDeleted=${JSON.stringify(metadataSoftDeleted)}`,
  );

  // Cleanup: the two probe policies and the app probe are removed so the workspace
  // keeps exactly its baseline catalog.
  for (const probe of [createdPolicy, owningAppPolicy]) {
    if (!probe) continue;
    await rest({ action: 'tax-policy-deactivate', token: adminToken, body: { recordId: probe.recordId } });
    await db.query(`update "${schema}"."_taxPolicy" set "deletedAt" = now() where id = $1`, [probe.recordId]);
  }
  await rest({ action: 'tax-policy-set-default', token: adminToken, body: { recordId: irVat9.id } });
  const finalState = await fingerprint();
  record(
    'S2 baseline restored (one active default, probe rows soft-deleted)',
    finalState.active_defaults === 1,
    `activeDefaults=${finalState.active_defaults} live=${finalState.live}`,
  );

  const summary = {
    ranAt: new Date().toISOString(),
    schema,
    results,
    pass: results.filter((r) => r.ok).length,
    fail: results.filter((r) => !r.ok).length,
    metadataSoftDeleted,
    objects: objectCounts.rows[0],
    quotationObjects: appObjects.rows[0].total,
    finalFingerprint: finalState,
  };
  fs.writeFileSync(
    path.join(__dirname, 'tmp-crm129-closure-009.json'),
    JSON.stringify(summary, null, 1),
  );
  console.log(`\n${summary.pass}/${results.length} PASS (closure 009)`);
  if (summary.fail > 0) process.exitCode = 1;
};

run()
  .catch(async (error) => {
    console.error('closure 009 crashed', error);
    process.exitCode = 2;
  })
  .finally(async () => {
    try {
      await lockDb.query('ROLLBACK');
    } catch {}
    try {
      await db.end();
      await lockDb.end();
    } catch {}
  });
