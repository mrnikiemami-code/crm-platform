// CRM-129-007: tax policies are workspace data, a quotation is priced from the policy
// row it names (never from a hardcoded rate), an issued document keeps the rate and
// amounts it was sealed with, and an accounting export refuses an unmapped tax policy.
//
// Usage: node scripts/dev-verify-crm129-tax-007.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];

if (!remote?.apiUrl || String(remote.apiUrl).includes('6080')) {
  console.error('refuse: missing or intranet remote');
  process.exit(2);
}

const apiBase = remote.apiUrl.replace(/\/$/, '');
const token = remote.apiKey;

const results = [];
const record = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${detail}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const gql = async (query) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${apiBase}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });
    const payload = await response.json();
    const rateLimited = Array.isArray(payload.errors)
      ? payload.errors.some((error) => error?.extensions?.code === 'RATE_LIMITED')
      : false;

    if (!rateLimited) {
      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        console.error('GraphQL errors', JSON.stringify(payload.errors).slice(0, 400));
      }

      return payload;
    }

    await sleep(900);
  }

  throw new Error('GraphQL rate limited after retries');
};

const postApp = async (route, body) => {
  const response = await fetch(`${apiBase}/s${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();

  try {
    return text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return { success: false, raw: text.slice(0, 300) };
  }
};

const taxPolicies = (body) => postApp('/quotation/tax-policies', body);

const callAction = async (body) => {
  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();

  try {
    return text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return { success: false, raw: text.slice(0, 300) };
  }
};

const policyByCode = (payload, code) =>
  (payload.policies ?? []).find((policy) => policy.code === code) ?? null;

const readQuotation = async (quotationId) => {
  const payload = await gql(`{
    quotation(filter: { id: { eq: "${quotationId}" } }) {
      id
      status
      version
      quotationNumber
      taxPolicy
      taxRateBasisPoints
      grossExact
      netExact
      taxExact
      totalExact
      currencyCode
    }
  }`);

  return payload.data?.quotation ?? null;
};

const readRevisions = async (quotationId) => {
  const payload = await gql(`{
    quotationRevisions(filter: { quotationId: { eq: "${quotationId}" } }) {
      edges {
        node {
          id
          version
          status
          snapshotHash
          totalExact
          snapshotJson
        }
      }
    }
  }`);

  return payload.data?.quotationRevisions?.edges?.map((edge) => edge.node) ?? [];
};

const LINE = (index, overrides = {}) => ({
  clientLineId: `tax007-${index}`,
  catalogItemId: null,
  kind: index === 2 ? 'PRODUCT' : 'SERVICE',
  name: `ردیف مالیات 007 ${index}`,
  description: '',
  unit: index === 2 ? 'عدد' : 'ساعت',
  quantityText: index === 1 ? '2' : index === 2 ? '1.5' : '1',
  unitPriceText: index === 1 ? '1000000' : index === 2 ? '400000' : '100000',
  moneyUnit: 'RIAL',
  discountKind: 'NONE',
  discountPercentText: '',
  discountAmountText: '',
  ...overrides,
});

const saveDraft = async ({
  personId,
  name,
  taxPolicy,
  lines,
  quotationId = null,
  expectedVersion = null,
}) =>
  postApp('/quotation/save-draft', {
    quotationId,
    expectedVersion,
    status: 'DRAFT',
    customerType: 'PERSON',
    personId,
    companyId: null,
    name,
    paymentTerms: 'نقد',
    taxPolicy,
    displayMoneyUnit: 'IRR',
    documentDiscountKind: 'NONE',
    documentDiscountPercentText: '',
    documentDiscountAmountText: '',
    lines,
  });

// The lifecycle has no DRAFT -> READY_TO_SEND edge: approval is a real step, so a
// script that jumps straight there is refused. Walk the legal chain instead of
// weakening the product's transition table for a test.
const TRANSITION_PATH = {
  DRAFT: {
    PENDING_INTERNAL_APPROVAL: ['PENDING_INTERNAL_APPROVAL'],
    READY_TO_SEND: ['PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND'],
    SENT: ['PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND', 'SENT'],
  },
  PENDING_INTERNAL_APPROVAL: {
    READY_TO_SEND: ['READY_TO_SEND'],
    SENT: ['READY_TO_SEND', 'SENT'],
  },
  READY_TO_SEND: {
    SENT: ['SENT'],
  },
};

const advance = async (quotationId, toStatus) => {
  const lifecycle = await callAction({ action: 'get-lifecycle', quotationId });

  if (lifecycle.success !== true) {
    throw new Error(`lifecycle failed: ${JSON.stringify(lifecycle).slice(0, 300)}`);
  }

  const steps = TRANSITION_PATH[lifecycle.lifecycle.status]?.[toStatus] ?? [toStatus];
  let current = lifecycle.lifecycle;
  let last = null;

  for (const step of steps) {
    last = await callAction({
      action: 'transition',
      quotationId,
      toStatus: step,
      version: current.version,
    });

    if (last.success !== true) {
      return last;
    }

    const refreshed = await callAction({ action: 'get-lifecycle', quotationId });

    if (refreshed.success !== true) {
      throw new Error(`lifecycle failed: ${JSON.stringify(refreshed).slice(0, 300)}`);
    }

    current = refreshed.lifecycle;
  }

  return last;
};

const main = async () => {
  const stamp = Date.now();
  const people = await gql('{ people(first: 1) { edges { node { id } } } }');
  const personId = people.data?.people?.edges?.[0]?.node?.id;

  if (!personId) {
    throw new Error('need one person');
  }

  // T1: the workspace starts from the 9% policy already in force, seeded as a row.
  const listed = await taxPolicies({ action: 'list' });
  const baseline = policyByCode(listed, 'IR_VAT_9');
  const defaults = (listed.policies ?? []).filter((policy) => policy.isDefault);

  record(
    'T1 baseline 9% policy exists and is the single default',
    listed.success === true &&
      baseline !== null &&
      baseline.rateBasisPoints === '900' &&
      baseline.isActive === true &&
      defaults.length === 1 &&
      defaults[0].code === 'IR_VAT_9',
    `policies=${(listed.policies ?? []).length} default=${defaults.map((row) => row.code).join(',')} rate=${baseline?.rateBasisPoints}`,
  );

  // T2: an administrator defines a 10% policy and makes it the default.
  const savedTen = await taxPolicies({
    action: 'save',
    recordId: policyByCode(listed, 'TAX_1000')?.recordId ?? null,
    name: 'مالیات ۱۰٪ 007',
    ratePercentText: '10',
    isActive: true,
    isDefault: true,
    isExempt: false,
  });
  const ten = policyByCode(savedTen, 'TAX_1000');
  const afterTenDefaults = (savedTen.policies ?? []).filter((row) => row.isDefault);

  record(
    'T2 create a 10% default policy',
    savedTen.success === true &&
      ten !== null &&
      ten.rateBasisPoints === '1000' &&
      ten.isDefault === true &&
      afterTenDefaults.length === 1 &&
      afterTenDefaults[0].code === 'TAX_1000',
    `code=${ten?.code} rate=${ten?.rateBasisPoints} default=${afterTenDefaults.map((row) => row.code).join(',')}`,
  );

  // T3: a Persian decimal rate is read as 10.5%, not as text or a float.
  const savedHalf = await taxPolicies({
    action: 'save',
    recordId: policyByCode(listed, 'TAX_1050')?.recordId ?? null,
    name: 'مالیات ۱۰٫۵٪ 007',
    ratePercentText: '۱۰٫۵',
    isActive: true,
    isDefault: false,
    isExempt: false,
  });
  const half = policyByCode(savedHalf, 'TAX_1050');

  record(
    'T3 Persian decimal rate ۱۰٫۵ stored as 1050 basis points',
    savedHalf.success === true && half !== null && half.rateBasisPoints === '1050',
    `code=${half?.code} rate=${half?.rateBasisPoints}`,
  );

  // T4: an exemption is a policy with a zero rate, not a flag on a taxed policy.
  const savedExempt = await taxPolicies({
    action: 'save',
    recordId: policyByCode(listed, 'TAX_0')?.recordId ?? null,
    name: 'معاف از مالیات 007',
    ratePercentText: '0',
    isActive: true,
    isDefault: false,
    isExempt: true,
  });
  const exempt = policyByCode(savedExempt, 'TAX_0');

  record(
    'T4 zero-rate exempt policy is accepted',
    savedExempt.success === true &&
      exempt !== null &&
      exempt.rateBasisPoints === '0' &&
      exempt.isExempt === true,
    `code=${exempt?.code} rate=${exempt?.rateBasisPoints} exempt=${exempt?.isExempt}`,
  );

  // T5: invalid and contradictory policies are refused and write nothing.
  const invalidRate = await taxPolicies({
    action: 'save',
    recordId: null,
    name: 'نرخ بی‌اعتبار 007',
    ratePercentText: '10.555',
    isActive: true,
    isDefault: false,
    isExempt: false,
  });
  const invalidExemption = await taxPolicies({
    action: 'save',
    recordId: null,
    name: 'معافیت متناقض 007',
    ratePercentText: '9',
    isActive: true,
    isDefault: false,
    isExempt: true,
  });
  const afterInvalid = await taxPolicies({ action: 'list' });
  const countBeforeInvalid = (savedExempt.policies ?? []).length;

  record(
    'T5 invalid rate and contradictory exemption are refused without writing',
    invalidRate.success === false &&
      ['TAX_RATE_INVALID', 'TAX_RATE_TOO_FINE'].includes(invalidRate.code) &&
      invalidExemption.success === false &&
      invalidExemption.code === 'TAX_POLICY_EXEMPTION_MISMATCH' &&
      (afterInvalid.policies ?? []).length === countBeforeInvalid,
    `invalidRate=${invalidRate.code} exemption=${invalidExemption.code} policies=${countBeforeInvalid}->${(afterInvalid.policies ?? []).length}`,
  );

  // T6: a multi-line draft is priced from the 10% row, not from a baked-in 9%.
  const draftName = `CRM129-tax007-${stamp}`;
  const tenDraft = await saveDraft({
    personId,
    name: draftName,
    taxPolicy: 'TAX_1000',
    lines: [LINE(1), LINE(2)],
  });

  record(
    'T6 save draft with the configured 10% policy',
    tenDraft.success === true && typeof tenDraft.quotationId === 'string',
    `quotation=${tenDraft.quotationId} message=${tenDraft.message ?? tenDraft.code}`,
  );

  const quotationId = tenDraft.quotationId;
  const storedTen = await readQuotation(quotationId);

  // 2 × 1,000,000 + 1.5 × 400,000 = 2,600,000 net; 10% = 260,000; total 2,860,000.
  record(
    'T7 form, stored header agree on the 10% calculation',
    storedTen?.taxPolicy === 'TAX_1000' &&
      storedTen?.taxRateBasisPoints === '1000' &&
      storedTen?.netExact === '2600000.000000' &&
      storedTen?.taxExact === '260000.000000' &&
      storedTen?.totalExact === '2860000.000000',
    `policy=${storedTen?.taxPolicy} rate=${storedTen?.taxRateBasisPoints} net=${storedTen?.netExact} tax=${storedTen?.taxExact} total=${storedTen?.totalExact}`,
  );

  // T8: reopening keeps the selected policy; switching it recalculates exactly.
  const switched = await saveDraft({
    personId,
    name: draftName,
    taxPolicy: 'TAX_1050',
    lines: [LINE(1), LINE(2)],
    quotationId,
    expectedVersion: storedTen?.version ?? 1,
  });
  const storedHalf = await readQuotation(quotationId);

  record(
    'T8 reopen + switch to 10.5% recalculates to 273,000 / 2,873,000',
    switched.success === true &&
      storedHalf?.taxPolicy === 'TAX_1050' &&
      storedHalf?.taxRateBasisPoints === '1050' &&
      storedHalf?.taxExact === '273000.000000' &&
      storedHalf?.totalExact === '2873000.000000',
    `policy=${storedHalf?.taxPolicy} rate=${storedHalf?.taxRateBasisPoints} tax=${storedHalf?.taxExact} total=${storedHalf?.totalExact}`,
  );

  // T9: a stale version is a conflict, not an overwrite.
  const stale = await saveDraft({
    personId,
    name: draftName,
    taxPolicy: 'TAX_1000',
    lines: [LINE(1), LINE(2)],
    quotationId,
    expectedVersion: 1,
  });

  record(
    'T9 stale expectedVersion is refused with a version conflict',
    stale.success === false && stale.code === 'QUOTATION_VERSION_CONFLICT',
    `code=${stale.code}`,
  );

  // T10: a deactivated or unknown policy is refused at save time.
  const halfRow = policyByCode(savedHalf, 'TAX_1050');
  const deactivated = await taxPolicies({
    action: 'deactivate',
    recordId: halfRow?.recordId,
  });
  const inactiveDraft = await saveDraft({
    personId,
    name: `${draftName}-inactive`,
    taxPolicy: 'TAX_1050',
    lines: [LINE(1)],
  });
  const unknownDraft = await saveDraft({
    personId,
    name: `${draftName}-unknown`,
    taxPolicy: 'TAX_9999',
    lines: [LINE(1)],
  });

  record(
    'T10 inactive and unknown policies are refused',
    deactivated.success === true &&
      inactiveDraft.success === false &&
      inactiveDraft.code === 'TAX_POLICY_INACTIVE' &&
      unknownDraft.success === false &&
      unknownDraft.code === 'TAX_POLICY_UNKNOWN',
    `deactivate=${deactivated.success} inactive=${inactiveDraft.code} unknown=${unknownDraft.code}`,
  );

  // T11: an issued 9% document is sealed with its rate and amounts.
  const issuedDraft = await saveDraft({
    personId,
    name: `${draftName}-issued`,
    taxPolicy: 'IR_VAT_9',
    lines: [LINE(3)],
  });

  if (issuedDraft.success !== true) {
    throw new Error(`issued draft failed: ${JSON.stringify(issuedDraft).slice(0, 300)}`);
  }

  const issuedId = issuedDraft.quotationId;
  const transition = await advance(issuedId, 'READY_TO_SEND');
  const issued = await readQuotation(issuedId);
  const issuedRevisions = await readRevisions(issuedId);
  const issuedRevision = issuedRevisions[0] ?? null;

  record(
    'T11 issued 9% document seals its own rate and amounts',
    transition.success === true &&
      issued?.status === 'READY_TO_SEND' &&
      issued?.taxRateBasisPoints === '900' &&
      issued?.netExact === '100000.000000' &&
      issued?.taxExact === '9000.000000' &&
      issued?.totalExact === '109000.000000' &&
      issuedRevision?.status === 'ISSUED',
    `status=${issued?.status} rate=${issued?.taxRateBasisPoints} tax=${issued?.taxExact} hash=${String(issuedRevision?.snapshotHash).slice(0, 12)}…`,
  );

  // The snapshot column comes back as parsed JSON, not as the sealed string, so it
  // is re-serialized here before looking for the fields a reader relies on.
  const issuedSnapshotText =
    typeof issuedRevision?.snapshotJson === 'string'
      ? issuedRevision.snapshotJson
      : JSON.stringify(issuedRevision?.snapshotJson ?? {});

  record(
    'T12 sealed snapshot records the rate alongside the policy code',
    issuedSnapshotText.includes('"taxRateBasisPoints":"900"') === true &&
      issuedSnapshotText.includes('"taxPolicy":"IR_VAT_9"') === true,
    `snapshotBytes=${issuedSnapshotText.length}`,
  );

  // T13: changing the default policy rate cannot rewrite an issued document.
  const tenRow = policyByCode(savedTen, 'TAX_1000');
  const changedRate = await taxPolicies({
    action: 'save',
    recordId: tenRow?.recordId,
    name: 'مالیات ۱۰٪ 007',
    ratePercentText: '12',
    isActive: true,
    isDefault: true,
    isExempt: false,
  });
  const issuedAfter = await readQuotation(issuedId);
  const revisionsAfter = await readRevisions(issuedId);
  const newTen = policyByCode(changedRate, 'TAX_1000');

  record(
    'T13 changing the default rate leaves the issued document untouched',
    changedRate.success === true &&
      newTen?.rateBasisPoints === '1200' &&
      newTen?.isDefault === true &&
      issuedAfter?.taxRateBasisPoints === '900' &&
      issuedAfter?.taxExact === '9000.000000' &&
      issuedAfter?.totalExact === '109000.000000' &&
      revisionsAfter[0]?.snapshotHash === issuedRevision?.snapshotHash,
    `policyRate=${newTen?.rateBasisPoints} issuedRate=${issuedAfter?.taxRateBasisPoints} issuedTax=${issuedAfter?.taxExact} hashStable=${revisionsAfter[0]?.snapshotHash === issuedRevision?.snapshotHash}`,
  );

  // T14: a new draft follows the new rate, proving the rate is read from the row.
  const atTwelve = await saveDraft({
    personId,
    name: `${draftName}-twelve`,
    taxPolicy: 'TAX_1000',
    lines: [LINE(3)],
  });
  const storedTwelve = atTwelve.success === true ? await readQuotation(atTwelve.quotationId) : null;

  record(
    'T14 a new draft picks up the edited 12% rate',
    storedTwelve?.taxRateBasisPoints === '1200' &&
      storedTwelve?.taxExact === '12000.000000' &&
      storedTwelve?.totalExact === '112000.000000',
    `rate=${storedTwelve?.taxRateBasisPoints} tax=${storedTwelve?.taxExact} total=${storedTwelve?.totalExact}`,
  );

  // T15: invalid lines are refused whole; the stored document does not move.
  const beforeInvalid = await readQuotation(atTwelve.quotationId);
  const badLines = await saveDraft({
    personId,
    name: `${draftName}-twelve`,
    taxPolicy: 'TAX_1000',
    lines: [{ ...LINE(1), name: '   ' }],
    quotationId: atTwelve.quotationId,
    expectedVersion: beforeInvalid?.version ?? 1,
  });
  const afterRollback = await readQuotation(atTwelve.quotationId);

  record(
    'T15 an invalid line rolls the save back and keeps the stored totals',
    badLines.success === false &&
      badLines.code === 'LINE_NAME_MISSING' &&
      afterRollback?.version === beforeInvalid?.version &&
      afterRollback?.taxExact === beforeInvalid?.taxExact &&
      afterRollback?.totalExact === beforeInvalid?.totalExact,
    `code=${badLines.code} version=${afterRollback?.version} tax=${afterRollback?.taxExact}`,
  );

  // T16: the PDF renders for the taxed document (rate formatting is unit-tested).
  const pdf = await callAction({ action: 'generate-pdf', quotationId });

  if (pdf.success === true && typeof pdf.pdfBase64 === 'string') {
    fs.writeFileSync(
      path.join(__dirname, 'tmp-crm129-tax-007.pdf'),
      Buffer.from(pdf.pdfBase64, 'base64'),
    );
  }

  record(
    'T16 PDF renders for a taxed quotation',
    pdf.success === true &&
      typeof pdf.pdfBase64 === 'string' &&
      pdf.pdfBase64.length > 1000 &&
      typeof pdf.fileName === 'string' &&
      pdf.fileName.endsWith('.pdf'),
    `fileName=${pdf.fileName} bytes=${Math.round(String(pdf.pdfBase64 ?? '').length * 0.75)}`,
  );

  // T17: restore the workspace's starting policy: the built-in 9% stays the default.
  const baselineRow = policyByCode(await taxPolicies({ action: 'list' }), 'IR_VAT_9');
  const restored = await taxPolicies({
    action: 'set-default',
    recordId: baselineRow?.recordId,
  });
  const restoredDefaults = (restored.policies ?? []).filter((row) => row.isDefault);

  record(
    'T17 default policy restored to the baseline 9%',
    restored.success === true &&
      restoredDefaults.length === 1 &&
      restoredDefaults[0].code === 'IR_VAT_9',
    `default=${restoredDefaults.map((row) => row.code).join(',')}`,
  );

  const graded = results.filter((row) => row.ok !== null);
  const passed = graded.filter((row) => row.ok).length;

  console.log(`\nTOTAL ${passed}/${graded.length} PASS`);
  console.log(`QUOTATION_ID=${quotationId} ISSUED_ID=${issuedId}`);

  fs.writeFileSync(
    path.join(__dirname, 'tmp-crm129-tax-007-verify.json'),
    JSON.stringify({ results, quotationId, issuedId }, null, 2),
  );

  process.exit(passed === graded.length ? 0 : 1);
};

main().catch((error) => {
  console.error('FATAL', error);
  process.exit(1);
});
