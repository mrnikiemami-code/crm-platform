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
const adminToken = remote.apiKey;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const gql = async (query, token = adminToken) => {
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

    await sleep(800);
  }

  throw new Error('GraphQL rate limited after retries');
};

const postApp = async (route, body, token = adminToken) => {
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

const action = async (body, token = adminToken) => {
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

  const draft = await postApp('/quotation/save-draft', {
    customerType: 'PERSON',
    personId,
    companyId: null,
    name: `S3-R3-${Date.now()}`,
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
        name: 'کالای UAT اشتراک',
        description: null,
        unit: 'عدد',
        quantityText: '1',
        unitPriceText: '2200',
        moneyUnit: 'TOMAN',
        discountKind: 'NONE',
        discountPercentText: '',
        discountAmountText: '',
      },
    ],
  });
  assert(draft.data?.success === true, `save failed: ${JSON.stringify(draft.data)}`);
  const quotationId = draft.data.quotationId;

  let version = (
    await gql(
      `{ quotation(filter: { id: { eq: "${quotationId}" } }) { version status quotationNumber } }`,
    )
  ).data.quotation.version;

  for (const toStatus of ['PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND']) {
    const step = await action({
      action: 'transition',
      quotationId,
      toStatus,
      version,
    });
    assert(
      step.data?.success === true,
      `${toStatus} failed: ${JSON.stringify(step.data)}`,
    );
    version = step.data.version;
  }

  const appTokenShare = await postApp('/quotation/share-quotation', {
    quotationId,
    channel: 'TELEGRAM',
  });
  assert(
    appTokenShare.data?.success === false &&
      appTokenShare.data?.code === 'USE_USER_SESSION_BRIDGE',
    `app-token share must be blocked: ${JSON.stringify(appTokenShare.data)}`,
  );

  const badChannel = await action({
    action: 'share-quotation',
    quotationId,
    channel: 'SMS',
  });
  assert(
    badChannel.data?.success === false,
    `SMS channel must fail: ${JSON.stringify(badChannel.data)}`,
  );

  const shared = await action({
    action: 'share-quotation',
    quotationId,
    channel: 'TELEGRAM',
    ttlHours: 24,
  });
  assert(
    shared.data?.success === true,
    `share failed: ${JSON.stringify(shared.data)}`,
  );
  assert(
    shared.data.outcome === 'MANUAL_SHARE',
    `expected MANUAL_SHARE, got ${shared.data.outcome}`,
  );
  assert(
    shared.data.deliveryKind === 'MANUAL_SHARE',
    'deliveryKind must be MANUAL_SHARE',
  );
  assert(
    typeof shared.data.shareText === 'string' &&
      shared.data.shareText.includes('شماره سند:'),
    'Persian share text missing document number',
  );
  assert(
    typeof shared.data.viewUrl === 'string' &&
      shared.data.viewUrl.includes('customer-view?token='),
    'viewUrl missing',
  );
  assert(
    typeof shared.data.linkId === 'string' && shared.data.linkId.length > 0,
    'linkId missing',
  );
  assert(
    typeof shared.data.shareId === 'string' && shared.data.shareId.length > 0,
    'shareId missing',
  );
  assert(
    shared.data.customerPersonId === personId,
    'customerPersonId not traceable',
  );
  assert(
    shared.data.communicationId === null && shared.data.providerId === null,
    'must not invent provider send ids',
  );

  // History row must store linkId + customer ids, never the raw token/URL.
  const history = await gql(`{
    quotationShares(filter: { id: { eq: "${shared.data.shareId}" } }, first: 1) {
      edges {
        node {
          id
          channel
          outcome
          linkId
          customerPersonId
          customerCompanyId
          detail
          communicationId
          providerId
          quotationId
        }
      }
    }
  }`);
  const row = history.data?.quotationShares?.edges?.[0]?.node;
  assert(row, `share history missing: ${JSON.stringify(history)}`);
  assert(row.outcome === 'MANUAL_SHARE', `history outcome ${row.outcome}`);
  assert(row.channel === 'TELEGRAM', `history channel ${row.channel}`);
  assert(row.linkId === shared.data.linkId, 'history linkId mismatch');
  assert(row.customerPersonId === personId, 'history person mismatch');
  assert(row.quotationId === quotationId, 'history quotation mismatch');
  assert(
    typeof row.detail === 'string' &&
      row.detail.includes(`linkId=${shared.data.linkId}`) &&
      !row.detail.includes('token=') &&
      !row.detail.includes('customer-view'),
    `history detail leaked secret: ${row.detail}`,
  );
  assert(
    row.communicationId === null ||
      row.communicationId === undefined ||
      row.communicationId === '',
    `history must not claim communicationId: ${row.communicationId}`,
  );

  // A second messenger channel also stays manual.
  const rubika = await action({
    action: 'share-quotation',
    quotationId,
    channel: 'RUBIKA',
    ttlHours: 24,
  });
  assert(
    rubika.data?.success === true,
    `rubika share failed: ${JSON.stringify(rubika.data)}`,
  );
  assert(rubika.data.outcome === 'MANUAL_SHARE', 'rubika must be MANUAL_SHARE');

  // Bale is a real provider channel: without a numeric chat_id the server must
  // refuse instead of pretending a manual share happened.
  const baleWithoutChat = await action({
    action: 'share-quotation',
    quotationId,
    channel: 'BALE',
    ttlHours: 24,
  });
  assert(
    baleWithoutChat.data?.success === false,
    `bale without chat_id must fail: ${JSON.stringify(baleWithoutChat.data)}`,
  );
  assert(
    /[\u0600-\u06FF]/.test(baleWithoutChat.data.message ?? ''),
    'bale refusal must be Persian',
  );

  console.log(
    JSON.stringify({
      result: 'S3_R3_SHARE_PASS',
      quotationId,
      shareId: shared.data.shareId,
      linkId: shared.data.linkId,
      outcome: shared.data.outcome,
      channel: shared.data.channel,
      customerPersonId: shared.data.customerPersonId,
    }),
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
