// Verifies the unified quotation creation path at the API level:
//   1. the customer picker reads real person/company records,
//   2. a fabricated customer id is refused BEFORE any row is written,
//   3. create-from-list writes exactly one quotation with the chosen relation,
//   4. editing the same id never creates a second row and never forks a version,
//   5. a stale version is refused with the row untouched.
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
const marker = process.argv[2] || `UNI003-${Date.now()}`;
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const gql = async (query) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
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

    await sleep(800);
  }

  throw new Error('GraphQL rate limited after retries');
};

const appRoute = async (route, body) => {
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
    return { success: false, raw: text };
  }
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const linePayload = (overrides = {}) => ({
  clientLineId: `line-${Math.random().toString(16).slice(2)}`,
  catalogItemId: null,
  kind: 'SERVICE',
  name: 'خدمت آزمون UNI003',
  description: null,
  unit: 'ساعت',
  quantityText: '2',
  unitPriceText: '1500',
  moneyUnit: 'TOMAN',
  discountKind: 'NONE',
  discountPercentText: '',
  discountAmountText: '',
  ...overrides,
});

const draftPayload = (overrides = {}) => ({
  name: `${marker}-draft`,
  customerType: 'PERSON',
  personId: null,
  companyId: null,
  paymentTerms: 'نقد',
  taxPolicy: 'IR_VAT_9',
  displayMoneyUnit: 'TOMAN',
  documentDiscountKind: 'NONE',
  documentDiscountPercentText: '',
  documentDiscountAmountText: '',
  lines: [linePayload()],
  ...overrides,
});

const quotationCount = async () => {
  const payload = await gql('{ quotations(first: 1) { totalCount } }');

  return payload.data.quotations.totalCount;
};

const readQuotation = async (id) => {
  const payload = await gql(`{
    quotation(filter: { id: { eq: "${id}" } }) {
      id name status version personId companyId customerName
      grossExact netExact taxExact totalExact
    }
    quotationLines(filter: { quotationId: { eq: "${id}" } }, first: 10) {
      edges { node { id name quantityExact unitPriceExact totalExact } }
    }
  }`);

  return {
    quotation: payload.data?.quotation ?? null,
    lines: payload.data?.quotationLines?.edges?.map((edge) => edge.node) ?? [],
  };
};

const main = async () => {
  const customers = await gql(`{
    people(first: 5) { edges { node { id name { firstName lastName } } } }
    companies(first: 5) { edges { node { id name } } }
  }`);

  const person = customers.data.people.edges
    .map((edge) => edge.node)
    .find((node) => (node.name?.firstName || '').trim() !== '');
  const company = customers.data.companies.edges
    .map((edge) => edge.node)
    .find((node) => (node.name || '').trim() !== '');

  assert(person, 'no person to use as a customer');
  assert(company, 'no company to use as a customer');

  const report = { marker, personId: person.id, companyId: company.id };

  // 1. picker search returns the real record with a readable label
  const searched = await appRoute('/quotation/search-customers', {
    customerType: 'PERSON',
    search: (person.name.firstName || '').trim(),
  });
  assert(searched.success === true, `picker search failed: ${JSON.stringify(searched)}`);
  const hit = (searched.rows || []).find((row) => row.id === person.id);
  assert(hit, 'picker search did not include the person it searched for');
  assert(
    typeof hit.label === 'string' && hit.label.trim() !== '',
    'picker row has no readable label',
  );

  // preselected id hydrates a label without a text search
  const hydrated = await appRoute('/quotation/search-customers', {
    customerType: 'PERSON',
    search: '',
    recordId: person.id,
  });
  assert(hydrated.success === true, 'preselection hydrate failed');
  assert(
    (hydrated.rows || []).length === 1 && hydrated.rows[0].id === person.id,
    `preselection hydrate returned ${JSON.stringify(hydrated.rows)}`,
  );
  report.pickerLabel = hydrated.rows[0].label;

  const countBefore = await quotationCount();

  // 2. fabricated customer is refused before the first write
  const fabricated = await appRoute('/quotation/save-draft', {
    ...draftPayload(),
    personId: FAKE_ID,
  });
  assert(
    fabricated.success === false,
    `fabricated customer accepted: ${JSON.stringify(fabricated)}`,
  );
  assert(
    fabricated.code === 'CUSTOMER_NOT_FOUND',
    `unexpected refusal code: ${fabricated.code}`,
  );
  assert(
    /[\u0600-\u06FF]/.test(fabricated.message ?? ''),
    'fabricated customer refusal is not Persian',
  );
  const countAfterFabricated = await quotationCount();
  assert(
    countAfterFabricated === countBefore,
    `fabricated customer wrote a row: ${countBefore} -> ${countAfterFabricated}`,
  );
  const orphan = await gql(`{
    quotations(filter: { name: { eq: "${marker}-draft" } }, first: 1) { totalCount }
  }`);
  assert(
    orphan.data.quotations.totalCount === 0,
    'fabricated customer left a header row behind',
  );
  report.fabricatedRefusal = { code: fabricated.code, message: fabricated.message };

  // 3. create from the list: one quotation, real relation, one line
  const created = await appRoute('/quotation/save-draft', {
    ...draftPayload(),
    personId: person.id,
    lines: [
      linePayload({ quantityText: '2', unitPriceText: '1500' }),
      linePayload({ name: 'ردیف دوم UNI003', quantityText: '1', unitPriceText: '400' }),
    ],
  });
  assert(created.success === true, `create failed: ${JSON.stringify(created)}`);
  const personQuotationId = created.quotationId;
  const countAfterCreate = await quotationCount();
  assert(
    countAfterCreate === countBefore + 1,
    `create wrote ${countAfterCreate - countBefore} rows`,
  );

  const personRead = await readQuotation(personQuotationId);
  assert(personRead.quotation.status === 'DRAFT', 'created row is not DRAFT');
  assert(personRead.quotation.personId === person.id, 'person relation not stored');
  assert(personRead.quotation.companyId === null, 'company relation set on a person quote');
  assert(personRead.lines.length === 2, `expected 2 lines, got ${personRead.lines.length}`);
  assert(
    Number(personRead.quotation.grossExact) === 34000,
    `gross mismatch: ${personRead.quotation.grossExact}`,
  );
  report.personQuotation = {
    id: personQuotationId,
    version: personRead.quotation.version,
    customerName: personRead.quotation.customerName,
    grossExact: personRead.quotation.grossExact,
    taxExact: personRead.quotation.taxExact,
    totalExact: personRead.quotation.totalExact,
    lineCount: personRead.lines.length,
  };

  // 4. edit the same id: no second row, version moves, totals move
  const edited = await appRoute('/quotation/save-draft', {
    ...draftPayload(),
    quotationId: personQuotationId,
    expectedVersion: personRead.quotation.version,
    personId: person.id,
    lines: [
      linePayload({ quantityText: '3', unitPriceText: '1750', discountKind: 'RATE', discountPercentText: '5' }),
    ],
  });
  assert(edited.success === true, `edit failed: ${JSON.stringify(edited)}`);
  assert(
    edited.quotationId === personQuotationId,
    `edit returned a different id: ${edited.quotationId}`,
  );
  const countAfterEdit = await quotationCount();
  assert(countAfterEdit === countAfterCreate, 'edit created a second quotation');

  const editedRead = await readQuotation(personQuotationId);
  assert(
    Number(editedRead.quotation.version) > Number(personRead.quotation.version),
    'edit did not bump the version',
  );
  assert(editedRead.lines.length === 1, `edit left ${editedRead.lines.length} lines`);
  assert(
    Number(editedRead.quotation.grossExact) === 52500,
    `edited gross mismatch: ${editedRead.quotation.grossExact}`,
  );
  report.personQuotationAfterEdit = {
    id: editedRead.quotation.id,
    version: editedRead.quotation.version,
    grossExact: editedRead.quotation.grossExact,
    netExact: editedRead.quotation.netExact,
    taxExact: editedRead.quotation.taxExact,
    totalExact: editedRead.quotation.totalExact,
    lineCount: editedRead.lines.length,
  };

  // 5. stale version is refused and the row keeps its old content
  const stale = await appRoute('/quotation/save-draft', {
    ...draftPayload(),
    quotationId: personQuotationId,
    expectedVersion: 1,
    personId: person.id,
  });
  assert(stale.success === false, `stale version accepted: ${JSON.stringify(stale)}`);
  assert(stale.code === 'VERSION_CONFLICT', `unexpected stale code: ${stale.code}`);
  assert(/[\u0600-\u06FF]/.test(stale.message ?? ''), 'stale refusal is not Persian');
  const afterStale = await readQuotation(personQuotationId);
  assert(
    afterStale.quotation.version === editedRead.quotation.version &&
      afterStale.quotation.totalExact === editedRead.quotation.totalExact,
    'stale save changed the row',
  );
  report.staleRefusal = { code: stale.code, message: stale.message };

  // 6. create from a company record keeps the company side only
  const companyCreated = await appRoute('/quotation/save-draft', {
    ...draftPayload({ name: `${marker}-company` }),
    customerType: 'COMPANY',
    personId: null,
    companyId: company.id,
    lines: [linePayload({ quantityText: '1', unitPriceText: '9900' })],
  });
  assert(
    companyCreated.success === true,
    `company create failed: ${JSON.stringify(companyCreated)}`,
  );
  const companyRead = await readQuotation(companyCreated.quotationId);
  assert(companyRead.quotation.companyId === company.id, 'company relation not stored');
  assert(companyRead.quotation.personId === null, 'person relation set on a company quote');
  report.companyQuotation = {
    id: companyCreated.quotationId,
    customerName: companyRead.quotation.customerName,
    grossExact: companyRead.quotation.grossExact,
    lineCount: companyRead.lines.length,
  };

  // 7. a person id is not a company id: the relation type is validated
  const crossType = await appRoute('/quotation/save-draft', {
    ...draftPayload({ name: `${marker}-cross` }),
    customerType: 'COMPANY',
    personId: null,
    companyId: person.id,
  });
  assert(
    crossType.success === false && crossType.code === 'CUSTOMER_NOT_FOUND',
    `cross-type customer accepted: ${JSON.stringify(crossType)}`,
  );
  const countAfterCross = await quotationCount();
  assert(
    countAfterCross === countAfterCreate + 1,
    'cross-type customer wrote a row',
  );
  report.crossTypeRefusal = crossType.message;

  console.log(JSON.stringify({ result: 'UNI003_API_PASS', ...report }, null, 2));
};

main().catch((error) => {
  console.error('FAIL', error.message);
  process.exit(1);
});
