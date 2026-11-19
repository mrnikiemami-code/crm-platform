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

const ensureDefaultPriceList = async () => {
  const existing = await gql(`{
    priceLists(filter: { and: [{ currencyCode: { eq: "IRR" } }, { isDefault: { eq: true } }] }, first: 1) {
      edges { node { id } }
    }
  }`);
  const id = existing.data?.priceLists?.edges?.[0]?.node?.id;
  if (id) {
    return id;
  }
  const created = await gql(`mutation {
    createPriceList(data: { name: "نرخ فروش پیش‌فرض R9", currencyCode: "IRR", isDefault: true }) { id }
  }`);
  assert(created.data?.createPriceList?.id, 'price list create failed');
  return created.data.createPriceList.id;
};

const main = async () => {
  const stamp = Date.now();
  const prefix = `R9CAT-${stamp}`;
  const priceListId = await ensureDefaultPriceList();
  const personId = (await gql(`{ people(first: 1) { edges { node { id } } } }`))
    .data.people.edges[0].node.id;

  const createdIds = [];
  // 105 items so page1=100 and page2 has the deep search target.
  for (let index = 0; index < 105; index += 1) {
    const sku = `${prefix}-${String(index).padStart(3, '0')}`;
    // Zero-padded names keep lexicographic order aligned with index so item 104
    // is outside the first page of a prefix search (page size 100).
    const name =
      index === 104
        ? `${prefix}-${String(index).padStart(3, '0')}-DEEP-SEARCH-TARGET`
        : `${prefix}-${String(index).padStart(3, '0')}`;
    const kind = index % 7 === 0 ? 'SERVICE' : 'PRODUCT';
    const unit = kind === 'SERVICE' ? 'ساعت' : 'عدد';
    const item = await gql(`mutation {
      createCatalogItem(data: {
        name: "${name}"
        kind: ${kind}
        sku: "${sku}"
        unit: "${unit}"
        isActive: true
        description: "R9 seed"
      }) { id name sku }
    }`);
    assert(item.data?.createCatalogItem?.id, `item ${index} failed: ${JSON.stringify(item)}`);
    const itemId = item.data.createCatalogItem.id;
    createdIds.push(itemId);

    const priceIrr = (100_000 + index) * 10; // toman-ish *10 = IRR whole
    const price = await gql(`mutation {
      createPrice(data: {
        unitPriceExact: "${priceIrr}.000000"
        itemId: "${itemId}"
        priceListId: "${priceListId}"
      }) { id }
    }`);
    assert(price.data?.createPrice?.id, `price ${index} failed`);

    // Stay under apiKey speed limit (100 req / 60s): item+price = 2 calls.
    if (index > 0 && index % 40 === 0) {
      await sleep(25_000);
    }
  }

  const page1 = await post('/quotation/search-catalog-items', {
    search: prefix,
    afterCursor: null,
    pageSize: 100,
  });
  assert(page1.data?.success === true, `page1 failed: ${JSON.stringify(page1.data)}`);
  assert(page1.data.items.length === 100, `page1 size ${page1.data.items.length}`);
  assert(page1.data.hasNextPage === true, 'page1 must have next');
  assert(typeof page1.data.endCursor === 'string', 'page1 cursor missing');

  const page1Ids = new Set(page1.data.items.map((row) => row.id));
  assert(page1Ids.size === 100, 'page1 duplicates');

  const page2 = await post('/quotation/search-catalog-items', {
    search: prefix,
    afterCursor: page1.data.endCursor,
    pageSize: 100,
  });
  assert(page2.data?.success === true, `page2 failed: ${JSON.stringify(page2.data)}`);
  assert(page2.data.items.length >= 5, `page2 size ${page2.data.items.length}`);
  for (const row of page2.data.items) {
    assert(!page1Ids.has(row.id), `duplicate across pages: ${row.id}`);
  }

  const deepTargetId = createdIds[104];
  assert(!page1Ids.has(deepTargetId), 'deep target must not be on page 1');

  const deep = await post('/quotation/search-catalog-items', {
    search: `${prefix}-104-DEEP-SEARCH-TARGET`,
    afterCursor: null,
    pageSize: 100,
  });
  assert(deep.data?.success === true, `deep search failed: ${JSON.stringify(deep.data)}`);
  const deepItem = deep.data.items.find((row) => row.id === deepTargetId);
  assert(deepItem, 'deep search missed target outside first page');
  assert(deepItem.priceAvailable === true, 'deep item needs price');
  assert(typeof deepItem.unitPriceExact === 'string', 'price snapshot missing');

  // Stale-response race: fire slow then fast; last response must win in client.
  // Server-side we just prove both succeed; client serial is covered by unit/component.
  const raced = await Promise.all([
    post('/quotation/search-catalog-items', {
      search: `${prefix}-000`,
      pageSize: 100,
    }),
    post('/quotation/search-catalog-items', {
      search: `${prefix}-104-DEEP-SEARCH-TARGET`,
      pageSize: 100,
    }),
  ]);
  assert(raced.every((row) => row.data?.success === true), 'race searches failed');

  const service = page1.data.items.find((row) => row.kind === 'SERVICE') ?? page2.data.items.find((row) => row.kind === 'SERVICE');
  const product = page1.data.items.find((row) => row.kind === 'PRODUCT');
  assert(service && product, 'need product and service samples');

  // Convert IRR exact to toman input for save-draft (display unit TOMAN).
  const toTomanInput = (exact) => String(Number(exact.split('.')[0]) / 10);

  const draft = await post('/quotation/save-draft', {
    status: 'DRAFT',
    customerType: 'PERSON',
    personId,
    companyId: null,
    name: `R9-quote-${stamp}`,
    paymentTerms: 'نقد',
    taxPolicy: 'IR_VAT_9',
    displayMoneyUnit: 'TOMAN',
    documentDiscountKind: 'NONE',
    documentDiscountPercentText: '',
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
        discountKind: 'RATE',
        discountPercentText: '5',
        discountAmountText: '',
      },
      {
        clientLineId: 'l2',
        catalogItemId: service.id,
        kind: service.kind,
        name: service.name,
        description: service.description,
        unit: service.unit,
        quantityText: '1.5',
        unitPriceText: toTomanInput(service.unitPriceExact),
        moneyUnit: 'TOMAN',
        discountKind: 'NONE',
        discountPercentText: '',
        discountAmountText: '',
      },
      {
        clientLineId: 'l3',
        catalogItemId: deepItem.id,
        kind: deepItem.kind,
        name: deepItem.name,
        description: deepItem.description,
        unit: deepItem.unit,
        quantityText: '1',
        unitPriceText: toTomanInput(deepItem.unitPriceExact),
        moneyUnit: 'TOMAN',
        discountKind: 'NONE',
        discountPercentText: '',
        discountAmountText: '',
      },
    ],
  });

  assert(draft.data?.success === true, `save-draft failed: ${JSON.stringify(draft.data)}`);
  assert(draft.data.persisted === true, 'draft not persisted');
  const quotationId = draft.data.quotationId ?? draft.data.plan?.quotationId;
  // persist returns quotationId at top level in save-draft handler
  const savedId =
    draft.data.quotationId ||
    (await gql(`{ quotations(filter: { name: { eq: "R9-quote-${stamp}" } }, first: 1) { edges { node { id totalExact taxExact roundingExact } } } }`))
      .data.quotations.edges[0].node.id;

  const stored = await gql(`{
    quotation(filter: { id: { eq: "${savedId}" } }) {
      id name totalExact taxExact roundingExact
    }
    quotationLines(filter: { quotationId: { eq: "${savedId}" } }, first: 10) {
      edges { node { name itemId unitPriceExact quantityExact totalExact } }
    }
  }`);

  const lines = stored.data.quotationLines.edges.map((edge) => edge.node);
  assert(lines.length === 3, `expected 3 lines, got ${lines.length}`);
  assert(lines.every((line) => typeof line.itemId === 'string' && line.itemId.length > 0), 'catalogItemId/itemId missing');
  assert(lines.every((line) => typeof line.unitPriceExact === 'string'), 'price snapshot missing');

  const pdf = await action({ action: 'generate-pdf', quotationId: savedId });
  assert(pdf.data?.success === true, `pdf failed: ${JSON.stringify(pdf.data)}`);
  const pdfBuffer = Buffer.from(pdf.data.pdfBase64, 'base64');
  assert(pdfBuffer.slice(0, 4).toString() === '%PDF', 'not pdf');

  let version =
    (
      await gql(
        `{ quotation(filter: { id: { eq: "${savedId}" } }) { version status } }`,
      )
    ).data.quotation.version ?? 1;

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
    assert(step.data?.success === true, `${toStatus} failed: ${JSON.stringify(step.data)}`);
    version = step.data.version;
  }

  console.log(
    JSON.stringify(
      {
        marker: 'S2_R9_CATALOG_PICKER_PASS',
        seedCount: createdIds.length,
        page1Count: page1.data.items.length,
        page2Count: page2.data.items.length,
        deepFound: deepItem.name,
        quotationId: savedId,
        totalExact: stored.data.quotation.totalExact,
        lineItemIds: lines.map((line) => line.itemId),
        pdfBytes: pdfBuffer.length,
        finalStatus: 'SENT',
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error('S2_R9_CATALOG_PICKER_FAIL', error);
  process.exit(1);
});
