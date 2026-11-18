const fs = require('node:fs');
const path = require('node:path');

const config = JSON.parse(
  fs.readFileSync(
    path.join(process.env.USERPROFILE, '.twenty', 'config.json'),
    'utf8',
  ),
);
const remote = config.remotes['dev-crm129'];

if (!remote?.apiUrl || String(remote.apiUrl).includes('6080')) {
  console.error('Refusing: remote is not isolated Dev :3002');
  process.exit(2);
}

const token = remote.apiKey;
const base = remote.apiUrl.replace(/\/$/, '');

const post = async (routePath, body) => {
  const response = await fetch(`${base}/s${routePath}`, {
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
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { status: response.status, ok: response.ok, data };
};

const main = async () => {
  const catalog = await post('/quotation/save-catalog-item', {
    kind: 'PRODUCT',
    name: 'کالای مسیر ذخیره',
    sku: 'S2R1-ROUTE-1',
    unit: 'عدد',
    isActive: true,
    defaultUnitPriceText: '250000',
    moneyUnit: 'TOMAN',
  });
  console.log('save-catalog', catalog.status, JSON.stringify(catalog.data));

  const people = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: `{ people(first: 1) { edges { node { id } } } }`,
    }),
  }).then((response) => response.json());
  const personId = people.data.people.edges[0].node.id;

  const draft = await post('/quotation/save-draft', {
    status: 'DRAFT',
    customerType: 'PERSON',
    personId,
    name: 'پیش‌فاکتور مسیر ذخیره',
    paymentTerms: 'نقد',
    taxPolicy: 'IR_VAT_9',
    displayMoneyUnit: 'TOMAN',
    lines: [
      {
        clientLineId: '1',
        kind: 'PRODUCT',
        name: 'کالا',
        unit: 'عدد',
        quantityText: '1',
        unitPriceText: '1000',
        moneyUnit: 'TOMAN',
        discountPercentText: '10',
        taxRatePercentText: '9',
      },
      {
        clientLineId: '2',
        kind: 'SERVICE',
        name: 'خدمت',
        unit: 'ساعت',
        quantityText: '2',
        unitPriceText: '500',
        moneyUnit: 'TOMAN',
        discountPercentText: '',
        taxRatePercentText: '9',
      },
    ],
  });
  console.log('save-draft', draft.status, JSON.stringify(draft.data));

  if (draft.data?.quotationId) {
    const immutable = await post('/quotation/save-draft', {
      quotationId: 'e7916bcf-c162-4fd6-8c99-46c98bfc1a1e',
      status: 'DRAFT',
      customerType: 'PERSON',
      personId,
      name: 'تلاش تغییر پس از ارسال',
      paymentTerms: 'نقد',
      taxPolicy: 'IR_VAT_9',
      displayMoneyUnit: 'TOMAN',
      lines: [
        {
          clientLineId: '1',
          kind: 'PRODUCT',
          name: 'کالا',
          unit: 'عدد',
          quantityText: '1',
          unitPriceText: '1000',
          moneyUnit: 'TOMAN',
          discountPercentText: '',
          taxRatePercentText: '9',
        },
      ],
    });
    console.log(
      'immutable-sent',
      immutable.status,
      JSON.stringify(immutable.data),
    );
  }

  if (catalog.data?.persisted === true && draft.data?.persisted === true) {
    console.log('ROUTES_PERSIST_PASS');
  } else {
    console.log('ROUTES_PARTIAL', {
      catalogPersisted: catalog.data?.persisted,
      draftPersisted: draft.data?.persisted,
      catalogReason: catalog.data?.reason ?? catalog.data?.code,
      draftReason: draft.data?.reason ?? draft.data?.code,
    });
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
