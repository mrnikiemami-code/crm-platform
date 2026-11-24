const { Client } = require('pg');
const { randomUUID } = require('node:crypto');
const { requireDatabaseUrl } = require('./db-connection.cjs');

const WORKSPACE_SCHEMA = 'workspace_aemygqnvl0yhlv0fg3qwjt525';
const WORKSPACE_ID = process.env.WORKSPACE_ID;
const API = 'http://localhost:3002';
const results = [];

const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`);
};

// The workspace an access token belongs to. The server keys its tax-policy advisory lock
// on exactly this value, so anything else (a config file that happens to lack the field,
// an env var pointing at another workspace) silently tests a lock no server takes.
const workspaceIdOfToken = (token) => {
  const payload = typeof token === 'string' ? token.split('.')[1] : undefined;

  if (payload === undefined) {
    throw new Error('access token is not a readable JWT; set WORKSPACE_ID explicitly');
  }

  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

  if (typeof claims.workspaceId !== 'string' || claims.workspaceId === '') {
    throw new Error('access token carries no workspaceId claim; set WORKSPACE_ID explicitly');
  }

  return claims.workspaceId;
};

// Waits until PostgreSQL reports a delete queued on this exact advisory key, i.e. until the
// premise "the delete is blocked behind the blocker" is an observed fact. A timeout is
// returned as false and fails the assertion: a queue that never formed is a broken test,
// never something to sleep past.
const waitForQueuedAdvisoryLock = async (db, lockKey, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { rows } = await db.query(
      `select count(*)::int as queued
         from pg_locks
        where locktype = 'advisory'
          and not granted
          and classid::bigint = ((hashtext($1)::bigint >> 32) & 4294967295)
          and objid::bigint = (hashtext($1)::bigint & 4294967295)`,
      [lockKey],
    );

    if (rows[0].queued > 0) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return false;
};

const gql = async (endpoint, token, query, variables) => {
  const response = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
};

const signIn = async (email, password) => {
  const signed = await gql(
    'metadata',
    null,
    `mutation($email:String!,$password:String!){signIn(email:$email,password:$password){availableWorkspaces{availableWorkspacesForSignIn{loginToken}}}}`,
    { email, password },
  );
  const loginToken =
    signed.data?.signIn?.availableWorkspaces?.availableWorkspacesForSignIn?.[0]
      ?.loginToken;
  if (!loginToken) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(signed).slice(0, 300)}`);
  const exchanged = await gql(
    'metadata',
    null,
    `mutation($loginToken:String!,$origin:String!){getAuthTokensFromLoginToken(loginToken:$loginToken,origin:$origin){tokens{accessOrWorkspaceAgnosticToken{token}}}}`,
    { loginToken, origin: 'http://localhost:3002' },
  );
  return exchanged.data?.getAuthTokensFromLoginToken?.tokens
    ?.accessOrWorkspaceAgnosticToken?.token;
};

const api = async (token, body) => {
  const response = await fetch(`${API}/rest/quotation/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
};

const policyRows = async (db) =>
  (
    await db.query(
      `select id, code, name, "rateBasisPoints", "dutyRateBasisPoints", "isActive", "isDefault", "isExempt" from "${WORKSPACE_SCHEMA}"."_taxPolicy" where "deletedAt" is null order by "createdAt"`,
    )
  ).rows;

const defaultViolations = async (db) => {
  const live = await policyRows(db);
  const activeDefaults = live.filter((r) => r.isActive && r.isDefault).length;
  const inactiveDefaults = live.filter((r) => !r.isActive && r.isDefault).length;
  return { activeDefaults, inactiveDefaults, live };
};

const quotationDigest = async (db) =>
  (
    await db.query(
      `select md5(coalesce(string_agg(id::text || '|' || coalesce("taxPolicy",'') || '|' || coalesce("taxRateBasisPoints",'') || '|' || coalesce("dutyRateBasisPoints",'') || '|' || coalesce("totalExact",''), ',' order by id),'')) as digest from "${WORKSPACE_SCHEMA}"."_quotation" where "deletedAt" is null`,
    )
  ).rows[0].digest;

const revisionDigest = async (db) =>
  (
    await db.query(
      `select md5(coalesce(string_agg(id::text || '|' || "snapshotHash" || '|' || "snapshotJson"::text, ',' order by id),'')) as digest from "${WORKSPACE_SCHEMA}"."_quotationRevision" where "deletedAt" is null`,
    )
  ).rows[0].digest;

(async () => {
  const watchdog = setTimeout(() => {
    console.error('TIMEOUT: no progress in 150s');
    process.exit(3);
  }, 150000);
  watchdog.unref();
  const db = new Client({ connectionString: requireDatabaseUrl('scripts/dev-verify-crm129-tax-uat-015.cjs') });
  await db.connect();

  const token = await signIn('pilot.a@local.test', 'PilotPass123!');
  const memberToken = await signIn('pilot.b@local.test', 'PilotPass123!');

  // The schema this script reads and the workspace the token writes as must be the same
  // workspace, or every lock and every count below would describe a different tenant.
  const workspaceId = WORKSPACE_ID ?? workspaceIdOfToken(token);
  const ownedSchema = (
    await db.query('select "databaseSchema" from core.workspace where id = $1', [workspaceId])
  ).rows[0]?.databaseSchema;

  if (ownedSchema !== WORKSPACE_SCHEMA) {
    throw new Error(
      `workspace identity mismatch: token workspace "${workspaceId}" owns schema "${ownedSchema}", this script inspects "${WORKSPACE_SCHEMA}"`,
    );
  }

  const lockKey = `quotation-tax-policy:${workspaceId}`;
  const personId = (
    await db.query(
      `select id from "${WORKSPACE_SCHEMA}".person where "deletedAt" is null order by id limit 1`,
    )
  ).rows[0]?.id;

  if (personId === undefined) {
    throw new Error('no person exists in this workspace to attach a test quotation to');
  }

  // A draft that prices 100,000 at the race policy's own declared rate: 1% tax, no duty.
  const raceDraftBody = (name, taxPolicy, taxRateBasisPoints, dutyRateBasisPoints) => ({
    action: 'save-draft',
    quotationId: null,
    expectedVersion: null,
    header: {
      name,
      customerType: 'PERSON',
      personId,
      companyId: null,
      currencyCode: 'IRR',
      taxPolicy,
      taxRateBasisPoints,
      dutyRateBasisPoints,
      paymentTerms: null,
      documentDiscountKind: 'NONE',
      documentDiscountInputExact: '0.000000',
      grossExact: '100000.000000',
      lineDiscountExact: '0.000000',
      documentDiscountExact: '0.000000',
      netExact: '100000.000000',
      taxExact: '1000.000000',
      dutyExact: '0.000000',
      roundingExact: '0.000000',
      totalExact: '101000.000000',
    },
    lines: [
      {
        name: 'ردیف رقابت ۰۱۵',
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
        taxExact: '1000.000000',
        totalExact: '101000.000000',
        itemId: null,
      },
    ],
  });

  const removeQuotation = async (quotationId) => {
    await db.query(
      `delete from "${WORKSPACE_SCHEMA}"."_quotationLine" where "quotationId" = $1`,
      [quotationId],
    );
    await db.query(`delete from "${WORKSPACE_SCHEMA}"."_quotation" where id = $1`, [quotationId]);
  };

  const before = { quotations: await quotationDigest(db), revisions: await revisionDigest(db) };

  // 1. The invariant read straight from the database.
  let state = await defaultViolations(db);
  check(
    'S5-1 exactly one active default, zero inactive defaults',
    state.activeDefaults === 1 && state.inactiveDefaults === 0,
    `active=${state.activeDefaults} inactive=${state.inactiveDefaults} total=${state.live.length}`,
  );

  const defaultRow = state.live.find((r) => r.isDefault);
  const usedRow = state.live.find((r) => r.code === 'TAX_1050');
  const otherRow = state.live.find((r) => r.code === 'IR_VAT_9');

  // 2. Move the default and re-read the database.
  const moved = await api(token, { action: 'tax-policy-set-default', recordId: otherRow.id });
  state = await defaultViolations(db);
  check(
    'S5-2 moving the default leaves exactly one default in the database',
    moved.success === true &&
      state.activeDefaults === 1 &&
      state.live.find((r) => r.isDefault)?.code === otherRow.code,
    `api=${moved.success} dbDefault=${state.live.find((r) => r.isDefault)?.code}`,
  );

  // 4/5. Create 5.5% + 2.1%, verify the total, then a fresh read.
  const created = await api(token, {
    action: 'tax-policy-save',
    recordId: null,
    name: 'آزمون ۰۱۵ — ۵٫۵ + ۲٫۱',
    ratePercentText: '۵٫۵',
    dutyRatePercentText: '۲٫۱',
    isActive: true,
    isDefault: false,
  });
  const createdRow = (created.policies ?? []).find(
    (p) => p.name === 'آزمون ۰۱۵ — ۵٫۵ + ۲٫۱',
  );
  const createdDb = (await policyRows(db)).find((r) => r.name === 'آزمون ۰۱۵ — ۵٫۵ + ۲٫۱');
  check(
    'S5-4/5 a 5.5% + 2.1% policy saves as 7.6% and survives a fresh read',
    created.success === true &&
      createdRow?.totalRatePercent === '7.6' &&
      createdDb?.rateBasisPoints === '550' &&
      createdDb?.dutyRateBasisPoints === '210',
    `apiTotal=${createdRow?.totalRatePercent} db=${createdDb?.rateBasisPoints}/${createdDb?.dutyRateBasisPoints}`,
  );
  const refreshed = await api(token, { action: 'tax-policy-list' });
  check(
    'S5-5 the saved policy is still there after reloading the list',
    (refreshed.policies ?? []).some((p) => p.recordId === createdRow?.recordId),
    `defaultCode=${refreshed.defaultCode}`,
  );
  check(
    'S5-3 the list carries one default and a new draft starts from it',
    (refreshed.policies ?? []).filter((p) => p.isDefault).length === 1 &&
      refreshed.policies.filter((p) => p.isDefault)[0].recordId === otherRow.id,
    `defaultCode=${refreshed.defaultCode} flagged=${(refreshed.policies ?? []).filter((p) => p.isDefault).map((p) => p.code).join(',')}`,
  );

  // 7. Zero policy is an exemption derived from the rates.
  const zero = await api(token, {
    action: 'tax-policy-save',
    recordId: null,
    name: 'آزمون ۰۱۵ — صفر',
    ratePercentText: '۰',
    dutyRatePercentText: '۰',
    isActive: true,
    isDefault: false,
  });
  const zeroRow = (zero.policies ?? []).find((p) => p.name === 'آزمون ۰۱۵ — صفر');
  const legacyZero = (await policyRows(db)).find((r) => r.code === 'TAX_0');
  check(
    'S5-7 a 0%/0% policy is exempt by arithmetic and the legacy zero policy is unchanged',
    zeroRow?.isExempt === true &&
      zeroRow?.totalRatePercent === '0' &&
      legacyZero?.rateBasisPoints === '0' &&
      legacyZero?.dutyRateBasisPoints === '0',
    `isExempt=${zeroRow?.isExempt} legacy=${legacyZero?.rateBasisPoints}/${legacyZero?.dutyRateBasisPoints}`,
  );

  // 8. Delete an unused policy.
  const deletedZero = await api(token, { action: 'tax-policy-delete', recordId: zeroRow.recordId });
  const zeroAfter = (await policyRows(db)).find((r) => r.id === zeroRow.recordId);
  check(
    'S5-8 an unused policy is deleted and leaves the catalog',
    deletedZero.success === true && zeroAfter === undefined,
    `message=${deletedZero.message ?? deletedZero.code}`,
  );

  // 9. Used policy refuses deletion with its real count.
  const deleteUsed = await api(token, { action: 'tax-policy-delete', recordId: usedRow.id });
  const usedAfter = (await policyRows(db)).find((r) => r.id === usedRow.id);
  check(
    'S5-9 a used policy refuses deletion and stays in the database',
    deleteUsed.success === false &&
      deleteUsed.code === 'TAX_POLICY_IN_USE' &&
      usedAfter !== undefined,
    `code=${deleteUsed.code} message=${deleteUsed.message}`,
  );

  // 10. Used, non-default policy can be deactivated and reactivated.
  const deactivated = await api(token, { action: 'tax-policy-deactivate', recordId: usedRow.id });
  const usedInactive = (await policyRows(db)).find((r) => r.id === usedRow.id);
  const reactivated = await api(token, {
    action: 'tax-policy-save',
    recordId: usedRow.id,
    name: usedRow.name,
    ratePercentText: String(Number(usedRow.rateBasisPoints) / 100),
    dutyRatePercentText: String(Number(usedRow.dutyRateBasisPoints) / 100),
    isActive: true,
  });
  const usedActive = (await policyRows(db)).find((r) => r.id === usedRow.id);
  check(
    'S5-10 a used, non-default policy deactivates and reactivates without touching its documents',
    deactivated.success === true && usedInactive?.isActive === false && reactivated.success === true && usedActive?.isActive === true,
    `deactivate=${deactivated.success} dbInactive=${usedInactive?.isActive === false} reactivate=${reactivated.success}`,
  );

  // 11. The last active policy is the default, so deactivating it is refused; deleting
  // it is refused for the same reason before any row is touched.
  const defaultNow = (await policyRows(db)).find((r) => r.isDefault);
  const deactivateDefault = await api(token, { action: 'tax-policy-deactivate', recordId: defaultNow.id });
  check(
    'S5-11 deactivating the default/last active policy is refused',
    deactivateDefault.success === false &&
      ['TAX_POLICY_IS_DEFAULT', 'TAX_POLICY_LAST_ACTIVE'].includes(deactivateDefault.code),
    `code=${deactivateDefault.code}`,
  );
  const deleteDefault = await api(token, { action: 'tax-policy-delete', recordId: defaultNow.id });
  check(
    'S5-11b deleting the default policy is refused before another default is chosen',
    deleteDefault.success === false && deleteDefault.code === 'TAX_POLICY_IS_DEFAULT',
    `code=${deleteDefault.code}`,
  );

  // 13. Historical documents keep their own policy and rate.
  const after = { quotations: await quotationDigest(db), revisions: await revisionDigest(db) };
  check(
    'S5-13 no live quotation and no snapshot changed during the settings mutations',
    before.quotations === after.quotations && before.revisions === after.revisions,
    `quotationDigest=${after.quotations.slice(0, 12)} revisionDigest=${after.revisions.slice(0, 12)}`,
  );

  // 14. Two concurrent default moves must still leave exactly one default.
  const [c1, c2] = await Promise.all([
    api(token, { action: 'tax-policy-set-default', recordId: usedRow.id }),
    api(token, { action: 'tax-policy-set-default', recordId: otherRow.id }),
  ]);
  state = await defaultViolations(db);
  check(
    'S5-14 two simultaneous default requests leave exactly one default',
    state.activeDefaults === 1 && state.inactiveDefaults === 0,
    `active=${state.activeDefaults} defaults=${state.live.filter((r) => r.isDefault).map((r) => r.code).join(',')} api=${c1.success}/${c2.success}`,
  );

  // 15a. A member without settings authority cannot delete.
  const memberDelete = await api(memberToken, { action: 'tax-policy-delete', recordId: usedRow.id });
  check(
    'S5-15a a caller without settings authority cannot delete',
    memberDelete.success === false && memberDelete.code === 'TAX_SETTINGS_FORBIDDEN',
    `code=${memberDelete.code}`,
  );

  // 15b. An unknown record id is a refusal, not a delete of something else.
  const forged = await api(token, { action: 'tax-policy-delete', recordId: randomUUID() });
  check(
    'S5-15b a forged record id is refused',
    forged.success === false && forged.code === 'TAX_POLICY_NOT_FOUND',
    `code=${forged.code}`,
  );

  // 15c. The delete/insert interleaving, proven rather than timed.
  //
  // A real draft save is one short transaction, so it cannot be paused mid-flight. The
  // interleaving is therefore produced at the database level, on the very same shared
  // advisory lock a draft save takes as its first statement: a writer owns a transaction,
  // has already taken that lock, and writes the quotation that names the policy. The
  // delete is then issued, and the writer commits only once PostgreSQL reports the delete
  // queued behind it — so the document is committed before the delete can count usage.
  //
  // Four orders are covered, and each one is asserted:
  //   a) document first, then delete        -> the real save accepts, the delete refuses
  //   b) document commits while the delete waits -> the delete refuses and keeps the policy
  //   c) document rolled back / removed     -> the same delete is then allowed
  //   d) delete first, then a document      -> the real save refuses the removed code
  const racePolicy = await api(token, {
    action: 'tax-policy-save',
    recordId: null,
    name: 'آزمون ۰۱۵ — رقابت',
    ratePercentText: '1',
    dutyRatePercentText: '0',
    isActive: true,
  });
  const raceRow = (racePolicy.policies ?? []).find((p) => p.name === 'آزمون ۰۱۵ — رقابت');

  if (raceRow === undefined) {
    throw new Error(`race policy was not created: ${racePolicy.code ?? racePolicy.message ?? 'unknown'}`);
  }

  // (a) The real path accepts this policy and these numbers while nothing is blocked. This
  // is what keeps (d) from passing vacuously: the same request is refused only because the
  // policy is gone, not because the body is malformed.
  const earlyDraft = await api(token, raceDraftBody('آزمون ۰۱۵ رقابت — پیش', raceRow.code, '100', '0'));
  const earlyDraftSaved = earlyDraft.success === true && typeof earlyDraft.quotationId === 'string';

  if (earlyDraftSaved) {
    await removeQuotation(earlyDraft.quotationId);
  }

  // (b) A writer that already holds the shared lock, exactly as an in-flight draft save does.
  const racingQuotationId = randomUUID();
  const blocker = new Client({ connectionString: requireDatabaseUrl('scripts/dev-verify-crm129-tax-uat-015.cjs') });
  await blocker.connect();
  await blocker.query('BEGIN');
  await blocker.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [lockKey]);
  const deleteRace = api(token, { action: 'tax-policy-delete', recordId: raceRow.recordId });
  const deleteQueued = await waitForQueuedAdvisoryLock(db, lockKey, 15000);
  await blocker.query(
    `insert into "${WORKSPACE_SCHEMA}"."_quotation"
       (id, name, status, version, "taxPolicy", "taxRateBasisPoints", "dutyRateBasisPoints")
     values ($1, $2, 'DRAFT', 1, $3, $4, $5)`,
    [racingQuotationId, 'آزمون ۰۱۵ رقابت — سند', raceRow.code, '100', '0'],
  );
  await blocker.query('COMMIT');
  await blocker.end();
  const raceResult = await deleteRace;
  const raceStillThere = (await policyRows(db)).find((r) => r.id === raceRow.recordId);

  // (c) The refusal was caused by that document and nothing else.
  await removeQuotation(racingQuotationId);
  const cleanupRace = await api(token, { action: 'tax-policy-delete', recordId: raceRow.recordId });

  // (d) Committed deletion cannot be resurrected by a later document.
  const lateSave = await api(token, raceDraftBody('آزمون ۰۱۵ رقابت — دیر', raceRow.code, '100', '0'));

  if (typeof lateSave.quotationId === 'string') {
    await removeQuotation(lateSave.quotationId);
  }

  check(
    'S5-15c a document committed while the delete waited makes the delete refuse',
    earlyDraftSaved === true &&
      deleteQueued === true &&
      raceResult.success === false &&
      raceResult.code === 'TAX_POLICY_IN_USE' &&
      raceStillThere !== undefined &&
      cleanupRace.success === true &&
      lateSave.success === false &&
      lateSave.code === 'TAX_POLICY_UNKNOWN',
    `earlyDraft=${earlyDraftSaved} queued=${deleteQueued} code=${raceResult.code} kept=${raceStillThere !== undefined} afterRemoval=${cleanupRace.success} late=${lateSave.code ?? lateSave.success}`,
  );

  const cleanupFive = await api(token, { action: 'tax-policy-delete', recordId: createdRow.recordId });
  const restored = await api(token, { action: 'tax-policy-set-default', recordId: defaultRow.id });
  const finalState = await defaultViolations(db);
  const leftovers = finalState.live.filter((r) => r.name.startsWith('آزمون ۰۱۵'));
  check(
    'cleanup: test policies removed and the original default restored',
    cleanupFive.success === true &&
      restored.success === true &&
      finalState.activeDefaults === 1 &&
      leftovers.length === 0,
    `default=${finalState.live.find((r) => r.isDefault)?.code} leftovers=${leftovers.length}`,
  );

  await db.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\nSUMMARY ${results.length - failed.length}/${results.length} passed`);
  process.exitCode = failed.length === 0 ? 0 : 1;
})().catch(async (error) => {
  console.error('FATAL', error);
  process.exit(2);
});
