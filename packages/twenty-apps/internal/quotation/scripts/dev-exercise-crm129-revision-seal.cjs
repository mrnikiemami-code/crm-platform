// CRM-129: issuing a quotation must produce exactly one sealed revision, in the same
// transaction that allocates its number, and moving it further (send, customer decision)
// must never mint a second identity for the same document.
//
// Usage: node scripts/dev-exercise-crm129-revision-seal.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');

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

// Evidence that is worth printing but is not this task's gate. Kept out of the pass/fail
// tally so a known platform gap cannot make an unrelated verification look red.
const recordInfo = (id, detail) => {
  results.push({ id, ok: null, detail });
  console.log(`INFO ${id} :: ${detail}`);
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

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

// Independent verifier: the same canonical form the server hashes, rebuilt here from the
// stored JSON so a hash that does not reproduce is caught by something other than the
// writer's own code.
const canonicalize = (value) => {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
};

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const exactToMicros = (text) => {
  const trimmed = String(text ?? '').trim();
  const negative = trimmed.startsWith('-');
  const [whole, fraction = ''] = (negative ? trimmed.slice(1) : trimmed).split('.');
  const micros =
    BigInt(whole || '0') * BigInt(1000000) +
    BigInt((fraction + '000000').slice(0, 6));

  return negative ? -micros : micros;
};

const createDraft = async ({ personId, stamp, index, lines }) => {
  const draft = await postApp('/quotation/save-draft', {
    status: 'DRAFT',
    customerType: 'PERSON',
    personId,
    companyId: null,
    name: `CRM129-revision-seal-${stamp}-${index}`,
    paymentTerms: 'نقد',
    taxPolicy: 'IR_VAT_9',
    displayMoneyUnit: 'RIAL',
    documentDiscountKind: 'NONE',
    documentDiscountPercentText: '',
    documentDiscountAmountText: '',
    lines,
  });

  assert(
    draft.success === true,
    `save-draft ${index} failed: ${JSON.stringify(draft).slice(0, 400)}`,
  );
  assert(typeof draft.quotationId === 'string', `draft ${index} has no id`);

  return draft.quotationId;
};

const advance = async (quotationId, toStatus) => {
  const lifecycle = await callAction({ action: 'get-lifecycle', quotationId });
  assert(lifecycle.success === true, `lifecycle failed for ${quotationId}`);

  const result = await callAction({
    action: 'transition',
    quotationId,
    toStatus,
    version: lifecycle.lifecycle.version,
  });

  assert(
    result.success === true,
    `transition ${toStatus} failed for ${quotationId}: ${JSON.stringify(result).slice(0, 400)}`,
  );

  return result;
};

const readRevisions = async (quotationId) => {
  const payload = await gql(`{
    quotationRevisions(filter: { quotationId: { eq: "${quotationId}" } }) {
      edges {
        node {
          id
          name
          version
          status
          snapshotHash
          totalExact
          issuedAt
          issuedBy
          snapshotJson
        }
      }
    }
  }`);

  return payload.data?.quotationRevisions?.edges?.map((edge) => edge.node) ?? null;
};

const readQuotation = async (quotationId) => {
  const payload = await gql(`{
    quotation(filter: { id: { eq: "${quotationId}" } }) {
      id
      status
      version
      quotationNumber
      totalExact
      grossExact
      lineDiscountExact
      documentDiscountExact
      netExact
      taxExact
      roundingExact
    }
  }`);

  return payload.data?.quotation ?? null;
};

const mockConnectionId = async () => {
  const listed = await postApp('/quotation/accounting-connection', {
    action: 'list',
  });
  const existing = (listed.connections ?? []).find(
    (connection) => connection.adapterId === 'mock',
  );

  if (existing?.id) {
    return existing.id;
  }

  const saved = await postApp('/quotation/accounting-connection', {
    action: 'save',
    name: 'اتصال ماسک بازبینی نسخه',
    adapterId: 'mock',
    settings: {
      baseUrl: 'https://mock.invalid',
      remoteUserId: '',
      defaultStorageId: '',
      moneyUnit: 'UNCONFIRMED',
      transportApproved: false,
      specialCodes: { discount: false, duty: false, tax: false },
    },
  });

  return saved.connection?.id ?? null;
};

const LINE_TEMPLATE = (index, name) => ({
  clientLineId: `l${index}`,
  catalogItemId: null,
  kind: 'SERVICE',
  name,
  description: '',
  unit: 'عدد',
  quantityText: index === 1 ? '2' : '1',
  unitPriceText: index === 1 ? '1500000' : '250000',
  moneyUnit: 'RIAL',
  discountKind: 'NONE',
  discountPercentText: '',
  discountAmountText: '',
});

const main = async () => {
  const stamp = Date.now();
  const people = await gql('{ people(first: 1) { edges { node { id } } } }');
  const personId = people.data?.people?.edges?.[0]?.node?.id;

  assert(personId, 'need one person');

  const lines = [LINE_TEMPLATE(1, `خدمت منقضی ${stamp}`), LINE_TEMPLATE(2, `خدمت دوم ${stamp}`)];
  const quotationId = await createDraft({ personId, stamp, index: 1, lines });

  // R1: a saved draft is not a document anyone could hold; nothing is sealed yet.
  const draftRevisions = await readRevisions(quotationId);
  record(
    'R1 draft has no revision',
    Array.isArray(draftRevisions) && draftRevisions.length === 0,
    `revisions=${draftRevisions?.length} quotation=${quotationId}`,
  );

  await advance(quotationId, 'PENDING_INTERNAL_APPROVAL');
  const pendingRevisions = await readRevisions(quotationId);
  record(
    'R2 pending approval has no revision',
    Array.isArray(pendingRevisions) && pendingRevisions.length === 0,
    `revisions=${pendingRevisions?.length}`,
  );

  await advance(quotationId, 'READY_TO_SEND');
  const issued = await readQuotation(quotationId);
  const issuedRevisions = await readRevisions(quotationId);
  const revision = issuedRevisions?.[0] ?? null;

  record(
    'R3 approval seals exactly one revision',
    issuedRevisions?.length === 1 &&
      revision?.status === 'ISSUED' &&
      revision?.version === 1,
    `revisions=${issuedRevisions?.length} version=${revision?.version} status=${revision?.status} name=${revision?.name}`,
  );

  const snapshot = revision?.snapshotJson ?? null;
  const canonical = snapshot === null ? '' : canonicalize(snapshot);
  const recomputedHash = canonical === '' ? '' : sha256(canonical);
  record(
    'R4 stored hash reproduces from stored bytes',
    typeof revision?.snapshotHash === 'string' &&
      revision.snapshotHash.length === 64 &&
      recomputedHash === revision.snapshotHash,
    `hash=${revision?.snapshotHash?.slice(0, 12)}… recomputed=${recomputedHash.slice(0, 12)}…`,
  );

  record(
    'R5 snapshot records the issued document',
    snapshot !== null &&
      snapshot.quotationNumber === issued?.quotationNumber &&
      snapshot.currencyCode === 'IRR' &&
      Array.isArray(snapshot.lines) &&
      snapshot.lines.length === lines.length &&
      snapshot.customerRef.length > 0,
    `number=${snapshot?.quotationNumber} lines=${snapshot?.lines?.length} customer=${snapshot?.customerRef}`,
  );

  const totals = snapshot?.totals ?? {};
  const totalMicros = BigInt(totals.totalMicros ?? '0');
  const lineTotals = (snapshot?.lines ?? []).reduce(
    (sum, line) => sum + BigInt(line.totalMicros),
    BigInt(0),
  );
  const lineGross = (snapshot?.lines ?? []).reduce(
    (sum, line) =>
      sum +
      (BigInt(line.quantityScaled) * BigInt(line.unitPriceMicros)) /
        BigInt(1000000),
    BigInt(0),
  );

  record(
    'R6 snapshot totals add up and match the header',
    totals.totalMicros === String(exactToMicros(issued?.totalExact)) &&
      totals.grossMicros === String(exactToMicros(issued?.grossExact)) &&
      totals.taxMicros === String(exactToMicros(issued?.taxExact)) &&
      totalMicros === lineTotals &&
      lineGross === BigInt(totals.grossMicros ?? '0') &&
      revision?.totalExact === totals.totalMicros,
    `total=${revision?.totalExact} header=${exactToMicros(issued?.totalExact)} lineTotals=${lineTotals} lineGross=${lineGross}`,
  );

  // R7: sending is not a new document. The revision count and hash must not move.
  const issuedAtBefore = revision?.issuedAt;
  await advance(quotationId, 'SENT');
  const sentRevisions = await readRevisions(quotationId);
  const sentQuotation = await readQuotation(quotationId);
  record(
    'R7 send does not mint a second revision',
    sentRevisions?.length === 1 &&
      sentRevisions[0]?.id === revision?.id &&
      sentRevisions[0]?.snapshotHash === revision?.snapshotHash &&
      sentRevisions[0]?.issuedAt === issuedAtBefore &&
      sentQuotation?.quotationNumber === issued?.quotationNumber &&
      sentQuotation?.status === 'SENT',
    `revisions=${sentRevisions?.length} hash=${sentRevisions?.[0]?.snapshotHash?.slice(0, 12)}… numberKept=${sentQuotation?.quotationNumber === issued?.quotationNumber}`,
  );

  // R8: the customer decision is the same document too.
  await advance(quotationId, 'CUSTOMER_ACCEPTED');
  const acceptedRevisions = await readRevisions(quotationId);
  record(
    'R8 customer decision keeps the sealed bytes',
    acceptedRevisions?.length === 1 &&
      acceptedRevisions[0]?.snapshotHash === revision?.snapshotHash,
    `revisions=${acceptedRevisions?.length} status=${acceptedRevisions?.[0]?.status}`,
  );

  // R9: the export planner now resolves the sealed revision instead of reporting a gap.
  const connectionId = await mockConnectionId();
  const exportPreview = await postApp('/quotation/accounting-outbound', {
    action: 'preview-quotation-export',
    connectionId,
    quotationId,
  });
  record(
    'R9 export preview resolves the sealed revision',
    exportPreview.success === true &&
      exportPreview.preview?.revisionVersion === 1 &&
      exportPreview.preview?.quotationStatus === 'CUSTOMER_ACCEPTED' &&
      exportPreview.preview?.decision?.kind === 'BLOCKED' &&
      exportPreview.preview?.decision?.code === 'OUTBOUND_DISABLED',
    `revision=${exportPreview.preview?.revisionVersion} decision=${exportPreview.preview?.decision?.code} lines=${exportPreview.preview?.lineItemIds?.length}`,
  );

  // R10: the record is written by issuing the quotation, not by the API. Every public
  // mutation route is refused by the workspace pre-query hooks, so a sealed revision can
  // neither be minted nor rewritten; the attempts below send current values so a hook
  // regression cannot leave the fixture damaged.
  const errorSummary = (response) =>
    (response.errors ?? [])
      .map((error) => `${error?.extensions?.code ?? 'no-code'}:${String(error?.message ?? '')}`)
      .join(' | ');

  const updateRefusal = await gql(`mutation {
    updateQuotationRevision(
      id: "${revision?.id}",
      data: { snapshotHash: "${revision?.snapshotHash}" }
    ) { id snapshotHash }
  }`);
  const updateRefused =
    (Array.isArray(updateRefusal.errors) && updateRefusal.errors.length > 0) &&
    (updateRefusal.data?.updateQuotationRevision ?? null) === null;

  record(
    'R10 sealed revision is not writable through the API',
    updateRefused,
    `refused=${updateRefused} errors=${errorSummary(updateRefusal) || 'none'}`,
  );

  const deleteRefusal = await gql(`mutation {
    deleteQuotationRevision(id: "${revision?.id}") { id }
  }`);
  const deleteRefused =
    (Array.isArray(deleteRefusal.errors) && deleteRefusal.errors.length > 0) &&
    (deleteRefusal.data?.deleteQuotationRevision ?? null) === null;

  record(
    'R10b sealed revision cannot be deleted through the API',
    deleteRefused,
    `refused=${deleteRefused} errors=${errorSummary(deleteRefusal) || 'none'}`,
  );

  const createRefusal = await gql(`mutation {
    createQuotationRevision(data: {
      name: "forged-${revision?.version}",
      version: 99,
      status: "ISSUED",
      snapshotJson: {},
      snapshotHash: "0000000000000000000000000000000000000000000000000000000000000000",
      totalExact: "1.0000",
      issuedAt: "${new Date().toISOString()}"
    }) { id version }
  }`);
  const createRefused =
    (Array.isArray(createRefusal.errors) && createRefusal.errors.length > 0) &&
    (createRefusal.data?.createQuotationRevision ?? null) === null;

  record(
    'R10c sealed revision cannot be minted through the API',
    createRefused,
    `refused=${createRefused} errors=${errorSummary(createRefusal) || 'none'}`,
  );

  const afterTamper = await readRevisions(quotationId);
  record(
    'R11 sealed revision bytes unchanged',
    afterTamper?.length === 1 &&
      afterTamper[0]?.snapshotHash === revision?.snapshotHash,
    `hash=${String(afterTamper?.[0]?.snapshotHash).slice(0, 12)}…`,
  );

  // R12: the PDF is rendered from a person customer, which is the read path that used
  // the flat name columns the ORM does not hydrate.
  const pdf = await callAction({ action: 'generate-pdf', quotationId });
  record(
    'R12 PDF renders for a person customer',
    pdf.success === true &&
      typeof pdf.pdfBase64 === 'string' &&
      pdf.pdfBase64.length > 1000 &&
      typeof pdf.fileName === 'string' &&
      pdf.fileName.endsWith('.pdf'),
    `fileName=${pdf.fileName} bytes=${Math.round(String(pdf.pdfBase64).length * 0.75)}`,
  );

  const graded = results.filter((row) => row.ok !== null);

  console.log(
    `\nTOTAL ${graded.filter((row) => row.ok).length}/${graded.length} PASS`,
  );
  console.log(`QUOTATION_ID=${quotationId} REVISION_ID=${revision?.id}`);

  fs.writeFileSync(
    path.join(__dirname, 'tmp-crm129-revision-seal-verify.json'),
    JSON.stringify({ results, quotationId, revisionId: revision?.id }, null, 2),
  );

  process.exit(graded.every((row) => row.ok === true) ? 0 : 1);
};

main().catch((error) => {
  console.error('FATAL', error);
  process.exit(3);
});
