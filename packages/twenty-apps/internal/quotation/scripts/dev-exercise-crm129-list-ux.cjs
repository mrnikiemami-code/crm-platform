// CRM-129 list UX: proves the quotation list can show a document number, the real
// customer name and a readable rial amount, and that a number is born at issuance.
//
// Creates its own draft through the app's save-draft function (the same path the
// form uses), then walks DRAFT -> PENDING_INTERNAL_APPROVAL -> READY_TO_SEND through
// the lifecycle route. Leaves the issued quotation in place as a visible sample.
//
// Usage: node scripts/dev-exercise-crm129-list-ux.cjs
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
      ? payload.errors.some(
          (error) => error?.extensions?.code === 'RATE_LIMITED',
        )
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
    return { success: false, raw: text };
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
    return { success: false, raw: text };
  }
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const toTomanInput = (exact) => {
  const micros = BigInt(exact.replace('.', ''));
  const toman = micros / 10n;
  const units = toman / 1_000_000n;
  const fraction = (toman % 1_000_000n)
    .toString()
    .padStart(6, '0')
    .replace(/0+$/, '');

  return fraction.length === 0 ? String(units) : `${units}.${fraction}`;
};

const readQuotation = async (quotationId) => {
  const result = await gql(`{
    quotation(filter: { id: { eq: "${quotationId}" } }) {
      id status version quotationNumber quotationNumberLabel customerName totalDisplay totalExact currencyCode
    }
  }`);

  return result.data?.quotation ?? null;
};

const main = async () => {
  const stamp = Date.now();
  const people = await gql(
    `{ people(first: 1) { edges { node { id name { firstName lastName } } } } }`,
  );
  const person = people.data?.people?.edges?.[0]?.node;

  assert(person?.id, 'need one person to address the quotation to');
  const personName = `${person.name?.firstName ?? ''} ${person.name?.lastName ?? ''}`.trim();

  const catalog = await postApp('/quotation/search-catalog-items', {
    search: '',
    pageSize: 20,
  });
  assert(catalog.success === true, `catalog search failed: ${JSON.stringify(catalog)}`);
  const item = (catalog.items ?? []).find(
    (row) =>
      row.priceAvailable === true &&
      typeof row.unitPriceExact === 'string' &&
      row.unitPriceExact.includes('.'),
  );
  assert(item, 'need one priced catalog item');

  const draft = await postApp('/quotation/save-draft', {
    status: 'DRAFT',
    customerType: 'PERSON',
    personId: person.id,
    companyId: null,
    name: `CRM129-list-ux-${stamp}`,
    paymentTerms: 'نقد',
    taxPolicy: 'IR_VAT_9',
    displayMoneyUnit: 'RIAL',
    documentDiscountKind: 'NONE',
    documentDiscountPercentText: '',
    documentDiscountAmountText: '',
    lines: [
      {
        clientLineId: 'l1',
        catalogItemId: item.id,
        kind: item.kind,
        name: item.name,
        description: item.description,
        unit: item.unit,
        quantityText: '1',
        unitPriceText: toTomanInput(item.unitPriceExact),
        moneyUnit: 'TOMAN',
        discountKind: 'AMOUNT',
        discountPercentText: '',
        discountAmountText: '',
      },
    ],
  });

  assert(draft.success === true, `save-draft failed: ${JSON.stringify(draft)}`);
  const quotationId = draft.quotationId;
  assert(typeof quotationId === 'string', 'quotationId missing');

  const asDraft = await readQuotation(quotationId);

  assert(asDraft?.status === 'DRAFT', `expected DRAFT, got ${asDraft?.status}`);
  assert(
    (asDraft.quotationNumber ?? '') === '',
    'a draft must not carry a document number',
  );
  assert(
    asDraft.quotationNumberLabel === 'بدون شماره',
    `draft label wrong: ${asDraft.quotationNumberLabel}`,
  );
  assert(
    asDraft.customerName === personName,
    `customer projection wrong: ${asDraft.customerName} vs ${personName}`,
  );
  assert(
    typeof asDraft.totalDisplay === 'string' &&
      asDraft.totalDisplay.includes('ریال') &&
      /[۰-۹]/.test(asDraft.totalDisplay) &&
      !/\d\.\d{6}/.test(asDraft.totalDisplay),
    `total projection unreadable: ${asDraft.totalDisplay}`,
  );

  const lifecycleBefore = await callAction({
    action: 'get-lifecycle',
    quotationId,
  });
  assert(lifecycleBefore.success === true, 'lifecycle read failed');

  const submitted = await callAction({
    action: 'transition',
    quotationId,
    toStatus: 'PENDING_INTERNAL_APPROVAL',
    version: lifecycleBefore.lifecycle.version,
  });
  assert(submitted.success === true, `submit failed: ${JSON.stringify(submitted)}`);

  const lifecycleApproval = await callAction({
    action: 'get-lifecycle',
    quotationId,
  });
  assert(lifecycleApproval.success === true, 'lifecycle re-read failed');

  const issued = await callAction({
    action: 'transition',
    quotationId,
    toStatus: 'READY_TO_SEND',
    version: lifecycleApproval.lifecycle.version,
  });
  assert(issued.success === true, `approve failed: ${JSON.stringify(issued)}`);

  const asIssued = await readQuotation(quotationId);

  assert(
    asIssued?.status === 'READY_TO_SEND',
    `expected READY_TO_SEND, got ${asIssued?.status}`,
  );
  assert(
    /^QT-140\d-\d{6}$/.test(asIssued.quotationNumber ?? ''),
    `issued number malformed: ${asIssued.quotationNumber}`,
  );
  assert(
    asIssued.quotationNumberLabel ===
      asIssued.quotationNumber.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]),
    `printed number is not the Persian form of ${asIssued.quotationNumber}: ${asIssued.quotationNumberLabel}`,
  );

  const list = await gql(`{
    quotations(first: 60) { edges { node {
      name quotationNumberLabel customerName totalDisplay status
    } } }
  }`);
  const rows = list.data?.quotations?.edges?.map((edge) => edge.node) ?? [];

  const readableRows = rows.filter(
    (row) =>
      typeof row.totalDisplay === 'string' &&
      row.totalDisplay.includes('ریال') &&
      !/\d\.\d{6}/.test(row.totalDisplay),
  );

  assert(
    readableRows.length >= rows.length * 0.9,
    `most rows must show a readable amount: ${readableRows.length}/${rows.length}`,
  );

  console.log(
    JSON.stringify(
      {
        quotationId,
        issuedNumber: asIssued.quotationNumber,
        issuedNumberLabel: asIssued.quotationNumberLabel,
        customerName: asIssued.customerName,
        totalExact: asIssued.totalExact,
        totalDisplay: asIssued.totalDisplay,
        listRows: rows.length,
        readableRows: readableRows.length,
        sample: rows.slice(0, 5),
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(`FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
