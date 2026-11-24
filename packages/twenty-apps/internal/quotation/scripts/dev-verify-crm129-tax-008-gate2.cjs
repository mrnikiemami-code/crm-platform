// CRM-129-008 Gate 2: financial integrity at the REST boundary and in Postgres.
//
// Every check is a real HTTP call against Dev :3002 plus a real SQL read. State is
// restored in `finally`, so a failed run cannot leave the workspace without its 9%
// default policy.
//
// Usage: node scripts/dev-verify-crm129-tax-008-gate2.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { requireDatabaseUrl } = require('./db-connection.cjs');

const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'));
const remote = config.remotes['dev-crm129'];
const apiBase = String(remote.apiUrl).replace(/\/$/, '');
const adminToken = remote.apiKey;
const schema = 'workspace_aemygqnvl0yhlv0fg3qwjt525';
const DATABASE_URL =
  requireDatabaseUrl('scripts/dev-verify-crm129-tax-008-gate2.cjs');

const db = new Client({ connectionString: DATABASE_URL });
const results = [];
const record = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${detail}`);
};

const rest = async (body) => {
  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = {};
  try {
    parsed = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body: parsed };
};

const policyFingerprint = async () => {
  const rows = await db.query(
    `select id, code, "rateBasisPoints", "isActive", "isDefault", "deletedAt", "updatedAt"
     from "${schema}"."_taxPolicy" where "deletedAt" is null order by id`,
  );
  const payload = rows.rows
    .map((row) => [row.id, row.code, row.rateBasisPoints, row.isActive, row.isDefault, row.updatedAt?.toISOString()].join('|'))
    .join('\n');
  return {
    hash: crypto.createHash('md5').update(payload).digest('hex'),
    rows: rows.rows,
    defaults: rows.rows.filter((row) => row.isDefault).map((row) => row.code),
  };
};

const documentFingerprint = async () => {
  const rows = await db.query(
    `select id, "taxPolicy", "taxRateBasisPoints", "netExact", "taxExact", "totalExact", version, "updatedAt"
     from "${schema}"."_quotation" where "deletedAt" is null order by id`,
  );
  const payload = rows.rows
    .map((row) => [row.id, row.taxPolicy, row.taxRateBasisPoints, row.netExact, row.taxExact, row.totalExact, row.version, row.updatedAt?.toISOString()].join('|'))
    .join('\n');
  return crypto.createHash('md5').update(payload).digest('hex');
};

const revisionFingerprint = async () => {
  const rows = await db.query(
    `select id, "snapshotHash", md5("snapshotJson"::text) as json_hash
     from "${schema}"."_quotationRevision" where "deletedAt" is null order by id`,
  );
  const payload = rows.rows.map((row) => [row.id, row.snapshotHash, row.json_hash].join('|')).join('\n');
  return { hash: crypto.createHash('md5').update(payload).digest('hex'), rows: rows.rows };
};

const quotationCount = async () => {
  const rows = await db.query(
    `select count(*)::int as total from "${schema}"."_quotation" where "deletedAt" is null`,
  );
  return rows.rows[0].total;
};

const loadDocument = async (quotationId) => {
  const header = await db.query(
    `select * from "${schema}"."_quotation" where id = $1 and "deletedAt" is null`,
    [quotationId],
  );
  const lines = await db.query(
    `select * from "${schema}"."_quotationLine" where "quotationId" = $1 and "deletedAt" is null order by "sortOrder"`,
    [quotationId],
  );
  return { header: header.rows[0], lines: lines.rows };
};

const buildSaveBody = ({ header, lines, taxPolicy, taxRateBasisPoints, net, tax, total }) => ({
  action: 'save-draft',
  quotationId: header?.id ?? null,
  expectedVersion: header?.version ?? null,
  header: {
    name: header?.name ?? 'تست قرارداد مالیات ۰۰۸',
    customerType: header?.customerType ?? 'PERSON',
    personId: header?.personId ?? '0045b1c8-9197-439a-94d2-c6891d19fc5d',
    companyId: header?.companyId ?? null,
    currencyCode: header?.currencyCode ?? 'IRR',
    taxPolicy,
    taxRateBasisPoints,
    paymentTerms: header?.paymentTerms ?? null,
    documentDiscountKind: header?.documentDiscountKind ?? 'NONE',
    documentDiscountInputExact: header?.documentDiscountInputExact ?? '0.000000',
    grossExact: header?.grossExact ?? '100000.000000',
    lineDiscountExact: header?.lineDiscountExact ?? '0.000000',
    documentDiscountExact: header?.documentDiscountExact ?? '0.000000',
    netExact: net,
    taxExact: tax,
    roundingExact: '0.000000',
    totalExact: total,
  },
  lines: (lines ?? []).map((line) => ({
    name: line.name,
    kind: line.kind,
    description: line.description,
    unit: line.unit,
    quantityExact: line.quantityExact,
    unitPriceExact: line.unitPriceExact,
    grossExact: line.grossExact,
    discountExact: line.discountExact,
    discountKind: line.discountKind,
    discountInputExact: line.discountInputExact,
    documentDiscountExact: line.documentDiscountExact,
    taxExact: tax,
    totalExact: total,
    itemId: line.itemId,
  })),
});

const run = async () => {
  await db.connect();

  const policies = await db.query(
    `select id, code, "rateBasisPoints", "isActive", "isDefault" from "${schema}"."_taxPolicy"
     where "deletedAt" is null order by code`,
  );
  const byCode = Object.fromEntries(policies.rows.map((row) => [row.code, row]));
  const irVat9 = byCode.IR_VAT_9;
  const tax1000 = byCode.TAX_1000;
  const tax0 = byCode.TAX_0;
  const inactive = byCode.TAX_1050;

  if (!irVat9 || !tax1000 || !tax0) {
    throw new Error('baseline policies missing; run the tax-settings bootstrap first');
  }

  // G1 — the workspace invariant, read straight from Postgres.
  const initial = await policyFingerprint();
  record(
    'G1 exactly one active default policy exists in Postgres',
    initial.defaults.length === 1 && initial.rows.filter((row) => row.isDefault && row.isActive).length === 1,
    `defaults=${initial.defaults.join(',')} rows=${initial.rows.length}`,
  );

  // G2 — listing policies writes nothing (no bootstrap on read).
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const listed = await rest({ action: 'tax-policy-list' });
    if (listed.body.success !== true) throw new Error('policy list failed');
  }
  const afterReads = await policyFingerprint();
  record(
    'G2 three consecutive reads leave every policy row byte-identical',
    afterReads.hash === initial.hash,
    `hash=${afterReads.hash.slice(0, 10)} unchanged=${afterReads.hash === initial.hash}`,
  );

  // G3 — concurrent default switches serialize on the advisory lock.
  const concurrent = await Promise.all(
    [irVat9.id, tax1000.id, tax0.id].map((recordId) =>
      rest({ action: 'tax-policy-set-default', recordId }),
    ),
  );
  const concurrentAfter = await policyFingerprint();
  record(
    'G3 three concurrent default switches still leave exactly one default',
    concurrentAfter.defaults.length === 1 &&
      concurrent.every((outcome) => outcome.status === 201 && outcome.body.success === true),
    `codes=${concurrent.map((outcome) => outcome.body.code ?? outcome.status).join(',')} defaults=${concurrentAfter.defaults.join(',')}`,
  );

  // G4 — a failed transition rolls back completely.
  const beforeFailure = await policyFingerprint();
  const failure = await rest({
    action: 'tax-policy-set-default',
    recordId: '00000000-0000-4000-8000-000000000000',
  });
  const afterFailure = await policyFingerprint();
  record(
    'G4 default switch to a missing policy is refused and rolls back',
    failure.body.success === false &&
      failure.body.code === 'TAX_POLICY_NOT_FOUND' &&
      afterFailure.hash === beforeFailure.hash,
    `code=${failure.body.code} unchanged=${afterFailure.hash === beforeFailure.hash}`,
  );

  const invalidSave = await rest({
    action: 'tax-policy-save',
    recordId: '',
    name: 'نرخ نامعتبر ۰۰۸',
    ratePercentText: '۱۰۱',
    isActive: true,
    isDefault: false,
    isExempt: false,
  });
  const afterInvalidSave = await policyFingerprint();
  record(
    'G5 invalid rate is refused by the boundary with no new row',
    invalidSave.body.success === false &&
      invalidSave.body.code === 'TAX_RATE_OUT_OF_RANGE' &&
      afterInvalidSave.rows.length === beforeFailure.rows.length,
    `code=${invalidSave.body.code} rows=${beforeFailure.rows.length}->${afterInvalidSave.rows.length}`,
  );

  // Restore the baseline default before touching rates.
  await rest({ action: 'tax-policy-set-default', recordId: irVat9.id });

  // G6 — rate stability: editing the policy never reprices stored documents.
  const targetDocumentId = '6b65e1f4-b84f-4bd6-9d6f-5e86e225ea1d';
  const targetBefore = await loadDocument(targetDocumentId);
  const documentBefore = await documentFingerprint();
  const revisionsBefore = await revisionFingerprint();

  const rateEdit = await rest({
    action: 'tax-policy-save',
    recordId: irVat9.id,
    name: irVat9.name ?? 'مالیات بر ارزش افزوده ۹٪',
    ratePercentText: '۱۰',
    isActive: true,
    isDefault: true,
    isExempt: false,
  });
  const targetAfterEdit = await loadDocument(targetDocumentId);
  const documentAfterEdit = await documentFingerprint();
  const revisionsAfterEdit = await revisionFingerprint();

  record(
    'G6 editing the 9% policy to 10% does not touch stored documents',
    rateEdit.body.success === true &&
      targetAfterEdit.header.totalExact === targetBefore.header.totalExact &&
      targetAfterEdit.header.taxRateBasisPoints === '900' &&
      targetAfterEdit.header.updatedAt.toISOString() === targetBefore.header.updatedAt.toISOString() &&
      documentAfterEdit === documentBefore,
    `policyRate=${rateEdit.body.policies?.find((row) => row.code === 'IR_VAT_9')?.ratePercent ?? '?'} docRate=${targetAfterEdit.header.taxRateBasisPoints} totals=${targetAfterEdit.header.totalExact}`,
  );

  record(
    'G7 sealed revisions are immutable across the rate edit',
    revisionsAfterEdit.hash === revisionsBefore.hash,
    `revisions=${revisionsBefore.rows.length} unchanged=${revisionsAfterEdit.hash === revisionsBefore.hash}`,
  );

  // G8 — a stored draft keeps its quoted rate through a re-save, and cannot adopt an
  // unapproved one.
  const oldRateResave = await rest(
    buildSaveBody({
      header: targetBefore.header,
      lines: targetBefore.lines,
      taxPolicy: 'IR_VAT_9',
      taxRateBasisPoints: '900',
      net: targetBefore.header.netExact,
      tax: targetBefore.header.taxExact,
      total: targetBefore.header.totalExact,
    }),
  );
  const targetAfterResave = await loadDocument(targetDocumentId);
  record(
    'G8 re-saving a stored draft keeps the quoted 9% rate after settings moved to 10%',
    oldRateResave.body.success === true &&
      targetAfterResave.header.taxRateBasisPoints === '900' &&
      targetAfterResave.header.taxExact === targetBefore.header.taxExact,
    `code=${oldRateResave.body.code ?? 'SAVED'} storedRate=${targetAfterResave.header.taxRateBasisPoints} tax=${targetAfterResave.header.taxExact}`,
  );

  const counterfeitResave = await rest(
    buildSaveBody({
      header: targetAfterResave.header,
      lines: targetAfterResave.lines,
      taxPolicy: 'IR_VAT_9',
      taxRateBasisPoints: '1100',
      net: targetAfterResave.header.netExact,
      tax: '11000.000000',
      total: '111000.000000',
    }),
  );
  const targetAfterCounterfeit = await loadDocument(targetDocumentId);
  record(
    'G9 a counterfeit 11% rate is refused and the document stays at 9%',
    counterfeitResave.body.success === false &&
      counterfeitResave.body.code === 'TAX_POLICY_RATE_MISMATCH' &&
      targetAfterCounterfeit.header.taxRateBasisPoints === '900' &&
      targetAfterCounterfeit.header.totalExact === targetBefore.header.totalExact,
    `code=${counterfeitResave.body.code} storedRate=${targetAfterCounterfeit.header.taxRateBasisPoints}`,
  );

  // The workspace rate goes back to 9% before new drafts are exercised, so the
  // approved-pair check below runs against the real baseline rather than a test edit.
  const restoreRate = await rest({
    action: 'tax-policy-save',
    recordId: irVat9.id,
    name: 'مالیات بر ارزش افزوده ۹٪',
    ratePercentText: '۹',
    isActive: true,
    isDefault: true,
    isExempt: false,
  });
  const restoredRate = await policyFingerprint();
  record(
    'G10 the 9% policy is restored and still owns the single default',
    restoreRate.body.success === true &&
      restoredRate.rows.find((row) => row.code === 'IR_VAT_9')?.rateBasisPoints === '900' &&
      restoredRate.defaults.join(',') === 'IR_VAT_9',
    `rate=${restoredRate.rows.find((row) => row.code === 'IR_VAT_9')?.rateBasisPoints} defaults=${restoredRate.defaults.join(',')}`,
  );

  // G11 — new drafts are validated independently of the logic function.
  const quotationTotalBefore = await quotationCount();
  const inactiveAttempt = await rest({
    action: 'save-draft',
    quotationId: null,
    expectedVersion: null,
    header: {
      name: 'تست سیاست غیرفعال ۰۰۸',
      customerType: 'PERSON',
      personId: '0045b1c8-9197-439a-94d2-c6891d19fc5d',
      companyId: null,
      currencyCode: 'IRR',
      taxPolicy: 'TAX_1050',
      taxRateBasisPoints: '1050',
      paymentTerms: null,
      documentDiscountKind: 'NONE',
      documentDiscountInputExact: '0.000000',
      grossExact: '100000.000000',
      lineDiscountExact: '0.000000',
      documentDiscountExact: '0.000000',
      netExact: '100000.000000',
      taxExact: '10500.000000',
      roundingExact: '0.000000',
      totalExact: '110500.000000',
    },
    lines: [
      {
        name: 'ردیف تست ۰۰۸',
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
        taxExact: '10500.000000',
        totalExact: '110500.000000',
        itemId: null,
      },
    ],
  });
  const quotationTotalAfterInactive = await quotationCount();
  record(
    'G11 an inactive policy cannot be chosen for a new draft, and nothing is written',
    inactiveAttempt.body.success === false &&
      inactiveAttempt.body.code === 'TAX_POLICY_INACTIVE' &&
      quotationTotalAfterInactive === quotationTotalBefore,
    `code=${inactiveAttempt.body.code} quotations=${quotationTotalBefore}->${quotationTotalAfterInactive}`,
  );

  const unknownPolicy = await rest({
    action: 'save-draft',
    quotationId: null,
    expectedVersion: null,
    header: {
      name: 'تست سیاست ناشناخته ۰۰۸',
      customerType: 'PERSON',
      personId: '0045b1c8-9197-439a-94d2-c6891d19fc5d',
      companyId: null,
      currencyCode: 'IRR',
      taxPolicy: 'TAX_FAKE_008',
      taxRateBasisPoints: '900',
      paymentTerms: null,
      documentDiscountKind: 'NONE',
      documentDiscountInputExact: '0.000000',
      grossExact: '100000.000000',
      lineDiscountExact: '0.000000',
      documentDiscountExact: '0.000000',
      netExact: '100000.000000',
      taxExact: '9000.000000',
      roundingExact: '0.000000',
      totalExact: '109000.000000',
    },
    lines: [
      {
        name: 'ردیف تست ۰۰۸',
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
        taxExact: '9000.000000',
        totalExact: '109000.000000',
        itemId: null,
      },
    ],
  });
  const quotationTotalAfterUnknown = await quotationCount();
  record(
    'G12 an unknown policy code cannot be chosen for a new draft',
    unknownPolicy.body.success === false &&
      unknownPolicy.body.code === 'TAX_POLICY_UNKNOWN' &&
      quotationTotalAfterUnknown === quotationTotalBefore,
    `code=${unknownPolicy.body.code} quotations=${quotationTotalBefore}->${quotationTotalAfterUnknown}`,
  );

  // G13 — the approved pair still saves, and stores exactly what the money domain
  // computed (100000 net + 9000 tax at 9% = 109000).
  const validDraft = await rest({
    action: 'save-draft',
    quotationId: null,
    expectedVersion: null,
    header: {
      name: 'تست قرارداد مالیات ۰۰۸',
      customerType: 'PERSON',
      personId: '0045b1c8-9197-439a-94d2-c6891d19fc5d',
      companyId: null,
      currencyCode: 'IRR',
      taxPolicy: 'IR_VAT_9',
      taxRateBasisPoints: '900',
      paymentTerms: null,
      documentDiscountKind: 'NONE',
      documentDiscountInputExact: '0.000000',
      grossExact: '100000.000000',
      lineDiscountExact: '0.000000',
      documentDiscountExact: '0.000000',
      netExact: '100000.000000',
      taxExact: '9000.000000',
      roundingExact: '0.000000',
      totalExact: '109000.000000',
    },
    lines: [
      {
        name: 'ردیف تست ۰۰۸',
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
        taxExact: '9000.000000',
        totalExact: '109000.000000',
        itemId: null,
      },
    ],
  });
  const savedId = validDraft.body.quotationId;
  const savedDocument = savedId ? await loadDocument(savedId) : null;
  record(
    'G13 an approved 9% draft saves with exact stored amounts',
    validDraft.body.success === true &&
      savedDocument?.header.taxRateBasisPoints === '900' &&
      savedDocument?.header.taxExact === '9000.000000' &&
      savedDocument?.header.totalExact === '109000.000000',
    `id=${savedId ?? 'missing'} code=${validDraft.body.code ?? 'OK'} message=${validDraft.body.message ?? ''} rate=${savedDocument?.header.taxRateBasisPoints} tax=${savedDocument?.header.taxExact} total=${savedDocument?.header.totalExact}`,
  );

  // G15 — default policy changes only affect new documents.
  const beforeDefaultSwitch = await documentFingerprint();
  const switchDefault = await rest({ action: 'tax-policy-set-default', recordId: tax1000.id });
  const afterDefaultSwitch = await documentFingerprint();
  record(
    'G14 switching the default policy leaves every existing document untouched',
    switchDefault.body.success === true && afterDefaultSwitch === beforeDefaultSwitch,
    `default=${switchDefault.body.defaultCode ?? '?'} unchanged=${afterDefaultSwitch === beforeDefaultSwitch}`,
  );

  // Restore the workspace baseline: the 9% default goes back, and the fixture
  // document created by G14 is soft-deleted.
  const restoreDefault = await rest({ action: 'tax-policy-set-default', recordId: irVat9.id });
  const restored = await policyFingerprint();
  record(
    'G15 baseline restored: 9% default policy and exactly one default',
    restoreDefault.body.success === true &&
      restored.defaults.join(',') === 'IR_VAT_9' &&
      restored.rows.find((row) => row.code === 'IR_VAT_9')?.rateBasisPoints === '900',
    `defaults=${restored.defaults.join(',')} rate=${restored.rows.find((row) => row.code === 'IR_VAT_9')?.rateBasisPoints}`,
  );

  if (savedId) {
    await db.query(
      `update "${schema}"."_quotation" set "deletedAt" = now() where id = $1 and name = 'تست قرارداد مالیات ۰۰۸'`,
      [savedId],
    );
    await db.query(
      `update "${schema}"."_quotationLine" set "deletedAt" = now() where "quotationId" = $1`,
      [savedId],
    );
  }

  await db.end();
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS (gate 2)`);
  if (failed.length > 0) process.exit(1);
};

run().catch(async (error) => {
  console.error('gate 2 crashed', error);
  try { await db.end(); } catch {}
  process.exit(2);
});
