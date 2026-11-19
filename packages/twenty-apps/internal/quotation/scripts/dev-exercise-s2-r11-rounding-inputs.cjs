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

const gql = async (query) => {
  const response = await fetch(`${apiBase}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  return response.json();
};

const post = async (route, body) => {
  const response = await fetch(`${apiBase}/s${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    data = { success: false, raw: text };
  }
  return { httpStatus: response.status, data };
};

const action = async (body) => {
  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    data = { success: false, raw: text };
  }
  return { httpStatus: response.status, data };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const main = async () => {
  const personId = (await gql(`{ people(first: 1) { edges { node { id } } } }`))
    .data.people.edges[0].node.id;
  const stamp = Date.now();

  // 100003 toman @ qty 1, VAT 9%:
  // net=1000030 IRR, tax=90002.7 IRR, raw=1090032.7 → floor 1090032 IRR
  // display toman payable = 109003.2
  const draft = await post('/quotation/save-draft', {
    status: 'DRAFT',
    customerType: 'PERSON',
    personId,
    companyId: null,
    name: `S2R11-round-${stamp}`,
    paymentTerms: 'نقد',
    taxPolicy: 'IR_VAT_9',
    displayMoneyUnit: 'TOMAN',
    documentDiscountKind: 'NONE',
    documentDiscountPercentText: '',
    documentDiscountAmountText: '',
    lines: [
      {
        clientLineId: 'l1',
        catalogItemId: null,
        kind: 'PRODUCT',
        name: 'R11-floor-sample',
        description: null,
        unit: 'عدد',
        quantityText: '۱',
        unitPriceText: '۱۰۰٬۰۰۳',
        moneyUnit: 'TOMAN',
        discountKind: 'NONE',
        discountPercentText: '',
        discountAmountText: '',
      },
    ],
  });

  assert(draft.data?.success === true, `save failed: ${JSON.stringify(draft.data)}`);
  assert(draft.data.persisted === true, 'not persisted');

  const displayTotal = draft.data.plan?.displayTotal;
  const totalsExact = draft.data.plan?.totalsExact;
  assert(typeof displayTotal === 'string', 'displayTotal missing');
  assert(displayTotal.includes('۱۰۹٬۰۰۳٫۲'), `unexpected displayTotal: ${displayTotal}`);
  assert(totalsExact?.totalExact === '1090032.000000', `totalExact ${totalsExact?.totalExact}`);
  assert(totalsExact?.taxExact === '90002.700000', `taxExact ${totalsExact?.taxExact}`);
  assert(totalsExact?.roundingExact === '-0.700000', `roundingExact ${totalsExact?.roundingExact}`);
  assert(totalsExact?.netExact === '1000030.000000', `netExact ${totalsExact?.netExact}`);

  const quotationId = draft.data.quotationId;
  const stored = await gql(`{
    quotation(filter: { id: { eq: "${quotationId}" } }) {
      id netExact taxExact roundingExact totalExact version status
    }
  }`);
  const row = stored.data?.quotation;
  assert(row?.totalExact === '1090032.000000', 'stored total mismatch');
  assert(row?.roundingExact === '-0.700000', 'stored rounding mismatch');
  assert(row?.taxExact === '90002.700000', 'stored tax must stay unrounded');

  const pdf = await action({ action: 'generate-pdf', quotationId });
  assert(pdf.data?.success === true, `pdf failed: ${JSON.stringify(pdf.data)}`);
  const pdfBuffer = Buffer.from(pdf.data.pdfBase64, 'base64');
  assert(pdfBuffer.slice(0, 4).toString() === '%PDF', 'not pdf');

  let version = row.version;
  let status = row.status;
  for (const toStatus of [
    'PENDING_INTERNAL_APPROVAL',
    'READY_TO_SEND',
    'SENT',
  ]) {
    const step = await action({
      action: 'transition',
      quotationId,
      toStatus,
      version,
    });
    assert(step.data?.success === true, `${toStatus} failed: ${JSON.stringify(step.data)}`);
    version = step.data.version;
    status = step.data.status;
  }

  assert(status === 'SENT', `expected SENT got ${status}`);

  console.log(
    JSON.stringify(
      {
        marker: 'S2_R11_ROUNDING_INPUTS_PASS',
        quotationId,
        displayTotal,
        totalsExact,
        stored: {
          netExact: row.netExact,
          taxExact: row.taxExact,
          roundingExact: row.roundingExact,
          totalExact: row.totalExact,
        },
        pdfBytes: pdfBuffer.length,
        status,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error('S2_R11_ROUNDING_INPUTS_FAIL', error);
  process.exit(1);
});
