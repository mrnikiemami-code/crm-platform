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

    const retryAfterMs = Number(
      payload.errors.find((error) => error?.extensions?.retryAfterMs)
        ?.extensions?.retryAfterMs ?? 1000,
    );
    await sleep(Math.max(retryAfterMs, 700));
  }

  throw new Error('GraphQL rate limited after retries');
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

  // Floor ABOVE .5 rial (half-up would have become 2): 1.900000 → 1.000000
  const floorAbove = await gql(`mutation {
    createQuotation(data: {
      name: "S2R10-floor-above-${stamp}"
      status: DRAFT
      customerType: PERSON
      personId: "${personId}"
      currencyCode: "IRR"
      taxPolicy: "IR_VAT_9"
      paymentTerms: "نقد"
      documentDiscountKind: "NONE"
      documentDiscountInputExact: "0.000000"
      grossExact: "1.900000"
      lineDiscountExact: "0.000000"
      documentDiscountExact: "0.000000"
      netExact: "1.900000"
      taxExact: "0.000000"
      roundingExact: "-0.900000"
      totalExact: "1.000000"
      version: 1
    }) { id totalExact taxExact roundingExact netExact }
  }`);

  if (!floorAbove.data?.createQuotation) {
    throw new Error(`floor-above create failed: ${JSON.stringify(floorAbove)}`);
  }

  const floorRow = floorAbove.data.createQuotation;
  assert(floorRow.totalExact === '1.000000', 'floor above .5 payable');
  assert(floorRow.roundingExact === '-0.900000', 'floor above .5 roundingExact');
  assert(floorRow.taxExact === '0.000000', 'tax remains pure');

  const catalog = await post('/quotation/search-catalog-items', {
    search: '',
    pageSize: 20,
  });
  assert(catalog.data?.success === true, `catalog search failed: ${JSON.stringify(catalog.data)}`);
  const priced = (catalog.data.items ?? []).filter(
    (row) =>
      row.priceAvailable === true &&
      typeof row.unitPriceExact === 'string' &&
      row.unitPriceExact.includes('.'),
  );
  const product = priced.find((row) => row.kind === 'PRODUCT');
  const service = priced.find((row) => row.kind === 'SERVICE');
  assert(product && service, 'need priced product and service');

  const toTomanInput = (exact) => {
    if (typeof exact !== 'string' || !exact.includes('.')) {
      throw new Error(`bad unitPriceExact: ${exact}`);
    }
    const micros = BigInt(exact.replace('.', ''));
    const toman = micros / 10n;
    const units = toman / 1_000_000n;
    const fraction = (toman % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
    return fraction.length === 0 ? String(units) : `${units}.${fraction}`;
  };

  const draft = await post('/quotation/save-draft', {
    status: 'DRAFT',
    customerType: 'PERSON',
    personId,
    companyId: null,
    name: `S2R10-draft-${stamp}`,
    paymentTerms: 'نقد',
    taxPolicy: 'IR_VAT_9',
    displayMoneyUnit: 'TOMAN',
    documentDiscountKind: 'RATE',
    documentDiscountPercentText: '2',
    documentDiscountAmountText: '',
    lines: [
      {
        clientLineId: 'l1',
        catalogItemId: product.id,
        kind: product.kind,
        name: product.name,
        description: product.description,
        unit: product.unit,
        quantityText: '2',
        unitPriceText: toTomanInput(product.unitPriceExact),
        moneyUnit: 'TOMAN',
        discountKind: 'AMOUNT',
        discountPercentText: '',
        discountAmountText: '1',
      },
      {
        clientLineId: 'l2',
        catalogItemId: service.id,
        kind: service.kind,
        name: service.name,
        description: service.description,
        unit: service.unit,
        quantityText: '1.25',
        unitPriceText: toTomanInput(service.unitPriceExact),
        moneyUnit: 'TOMAN',
        discountKind: 'RATE',
        discountPercentText: '5',
        discountAmountText: '',
      },
    ],
  });

  assert(draft.data?.success === true, `save-draft failed: ${JSON.stringify(draft.data)}`);
  assert(draft.data.persisted === true, 'draft not persisted');

  const displayTotal = draft.data.plan?.displayTotal;
  assert(typeof displayTotal === 'string', 'displayTotal missing');
  assert(displayTotal.includes('تومان') || displayTotal.includes('ریال'), 'unit label missing');
  assert(!/\d\.\d{6}/.test(displayTotal), `trailing six zeros in display: ${displayTotal}`);
  assert(/[۰-۹]/.test(displayTotal), `persian digits expected: ${displayTotal}`);

  const savedId = draft.data.quotationId;
  assert(typeof savedId === 'string' && savedId.length > 0, 'quotationId missing');

  const stored = await gql(`{
    quotation(filter: { id: { eq: "${savedId}" } }) {
      id totalExact taxExact roundingExact netExact version status
    }
  }`);
  const row = stored.data?.quotation;
  assert(row, 'reread missing');
  assert(String(row.totalExact).endsWith('.000000'), `payable not whole: ${row.totalExact}`);

  const pdf = await action({
    action: 'generate-pdf',
    quotationId: savedId,
  });
  assert(pdf.data?.success === true, `pdf failed: ${JSON.stringify(pdf.data)}`);
  const pdfBuffer = Buffer.from(pdf.data.pdfBase64, 'base64');
  assert(pdfBuffer.slice(0, 4).toString() === '%PDF', 'not a pdf');

  let version = row.version;
  let finalStatus = row.status;
  for (const toStatus of [
    'PENDING_INTERNAL_APPROVAL',
    'READY_TO_SEND',
    'SENT',
  ]) {
    const step = await action({
      action: 'transition',
      quotationId: savedId,
      toStatus,
      version,
    });
    assert(
      step.data?.success === true,
      `${toStatus} failed: ${JSON.stringify(step.data)}`,
    );
    version = step.data.version;
    finalStatus = step.data.status;
  }

  assert(finalStatus === 'SENT', `must reach SENT, got ${finalStatus}`);

  console.log(
    JSON.stringify(
      {
        marker: 'S2_R10_FLOOR_DISPLAY_PASS',
        floorAbove: {
          quotationId: floorRow.id,
          totalExact: floorRow.totalExact,
          roundingExact: floorRow.roundingExact,
        },
        draft: {
          quotationId: savedId,
          displayTotal,
          totalExact: row.totalExact,
          taxExact: row.taxExact,
          roundingExact: row.roundingExact,
          status: finalStatus,
          pdfBytes: pdfBuffer.length,
        },
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error('S2_R10_FLOOR_DISPLAY_FAIL', error);
  process.exit(1);
});
