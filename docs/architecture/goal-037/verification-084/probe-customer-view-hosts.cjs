const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const fresh = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fresh-workspace.json'), 'utf8'),
);
const token = fresh.apiKeyToken;
const apiBase = fresh.apiBase.replace(/\/$/, '');
const origin = String(fresh.origin || `http://${fresh.subdomain}.localhost:3002`).replace(
  /\/$/,
  '',
);

const gql = async (query, variables) => {
  const response = await fetch(`${apiBase}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
};

const action = async (body) => {
  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return response.json();
};

(async () => {
  const people = await gql(`{ people(first:1){edges{node{id}}}}`);
  const personId = people.data?.people?.edges?.[0]?.node?.id;
  const draft = await fetch(`${apiBase}/s/quotation/save-draft`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerType: 'PERSON',
      personId,
      companyId: null,
      name: `084-viewprobe-${Date.now()}`,
      paymentTerms: 'نقد',
      taxPolicy: 'IR_VAT_9',
      documentDiscountKind: 'NONE',
      documentDiscountPercentText: '',
      documentDiscountAmountText: '',
      lines: [
        {
          clientLineId: 'l1',
          catalogItemId: null,
          kind: 'PRODUCT',
          name: 'probe',
          description: null,
          unit: 'عدد',
          quantityText: '1',
          unitPriceText: '1000',
          moneyUnit: 'TOMAN',
          discountKind: 'NONE',
          discountPercentText: '',
          discountAmountText: '',
        },
      ],
    }),
  }).then((r) => r.json());

  const quotationId = draft.quotationId;
  if (!quotationId) {
    console.log(JSON.stringify({ draft }, null, 2));
    return;
  }

  let version = (
    await gql(
      `query($id:UUID!){ quotation(filter:{id:{eq:$id}}){ version status } }`,
      { id: quotationId },
    )
  ).data?.quotation?.version;

  for (const toStatus of ['PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND']) {
    const step = await action({
      action: 'transition',
      quotationId,
      toStatus,
      version,
    });
    version = step.version;
  }

  const minted = await action({
    action: 'create-customer-link',
    quotationId,
    ttlHours: 24,
  });
  const raw = minted.token || minted.rawToken;
  const rawUrl = minted.viewUrl;
  const candidates = [
    rawUrl,
    rawUrl.replace(apiBase, origin),
    `${apiBase}/s/quotation/customer-view?token=${encodeURIComponent(raw)}`,
    `${origin}/s/quotation/customer-view?token=${encodeURIComponent(raw)}`,
  ];

  const hits = [];
  for (const url of candidates) {
    const response = await fetch(url, { redirect: 'manual' });
    const text = await response.text();
    hits.push({
      host: new URL(url).host,
      path: new URL(url).pathname,
      status: response.status,
      hasPayable: text.includes('مبلغ نهایی'),
      hasInvalid: text.includes('نامعتبر'),
      hasRevoke: text.includes('لغو'),
      snippet: text.replace(/\s+/g, ' ').slice(0, 160),
    });
  }

  const out = {
    quotationId,
    linkId: minted.linkId,
    hashPrefix: createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 12),
    hits,
  };
  fs.writeFileSync(
    path.join(__dirname, 'customer-view-host-probe.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
