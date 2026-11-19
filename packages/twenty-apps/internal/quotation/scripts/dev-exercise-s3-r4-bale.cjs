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

const gql = async (query) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${apiBase}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
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
  throw new Error('GraphQL rate limited');
};

const postApp = async (route, body) => {
  const response = await fetch(`${apiBase}/s${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
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
      Authorization: `Bearer ${adminToken}`,
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
  const liveToken = process.env.CRM129_BALE_BOT_TOKEN;
  const liveChatId = process.env.CRM129_BALE_CHAT_ID;
  const liveAuthorized =
    typeof liveToken === 'string' &&
    liveToken.trim() !== '' &&
    typeof liveChatId === 'string' &&
    /^-?\d+$/.test(liveChatId.trim());

  const personId = (await gql(`{ people(first: 1) { edges { node { id } } } }`))
    .data.people.edges[0].node.id;

  const draft = await postApp('/quotation/save-draft', {
    customerType: 'PERSON',
    personId,
    companyId: null,
    name: `S3-R4-${Date.now()}`,
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
        name: 'کالای UAT بله',
        description: null,
        unit: 'عدد',
        quantityText: '1',
        unitPriceText: '1100',
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
      `{ quotation(filter: { id: { eq: "${quotationId}" } }) { version } }`,
    )
  ).data.quotation.version;

  for (const toStatus of ['PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND']) {
    const step = await action({
      action: 'transition',
      quotationId,
      toStatus,
      version,
    });
    assert(step.data?.success === true, `${toStatus} failed`);
    version = step.data.version;
  }

  const missingChat = await action({
    action: 'share-quotation',
    quotationId,
    channel: 'BALE',
    ttlHours: 24,
  });
  assert(
    missingChat.data?.success === false,
    `missing chat_id must fail: ${JSON.stringify(missingChat.data)}`,
  );

  const badChat = await action({
    action: 'share-quotation',
    quotationId,
    channel: 'BALE',
    chatId: 'not-a-chat',
    ttlHours: 24,
  });
  assert(
    badChat.data?.success === false,
    `bad chat_id must fail: ${JSON.stringify(badChat.data)}`,
  );

  // Without an authorized live token/chat, exercise the real Nest→Communication
  // path with a placeholder chat id. Expect honest PROVIDER_FAILED (missing
  // BALE_BOT_TOKEN or provider rejection) — never fake PROVIDER_SENT.
  const placeholder = await action({
    action: 'share-quotation',
    quotationId,
    channel: 'BALE',
    chatId: '183266491',
    ttlHours: 24,
  });
  assert(
    placeholder.data?.success === true,
    `share bridge failed: ${JSON.stringify(placeholder.data)}`,
  );
  assert(
    placeholder.data.outcome === 'PROVIDER_FAILED' ||
      placeholder.data.outcome === 'PROVIDER_SENT',
    `unexpected outcome ${placeholder.data.outcome}`,
  );
  assert(
    placeholder.data.deliveryKind === 'PROVIDER',
    'deliveryKind must be PROVIDER for BALE',
  );
  assert(
    placeholder.data.providerId === 'bale',
    'providerId must be bale',
  );

  if (!liveAuthorized) {
    assert(
      placeholder.data.outcome === 'PROVIDER_FAILED',
      'without live creds outcome must be PROVIDER_FAILED, not fake SENT',
    );
    assert(
      placeholder.data.providerMessageId === null,
      'no providerMessageId without live send',
    );

    console.log(
      JSON.stringify({
        result: 'S3_R4_BALE_CONTRACT_PASS',
        liveStatus: 'LIVE_UNVERIFIED',
        reason:
          'CRM129_BALE_BOT_TOKEN and CRM129_BALE_CHAT_ID not both set; no live send attempted',
        quotationId,
        shareId: placeholder.data.shareId,
        outcome: placeholder.data.outcome,
        communicationId: placeholder.data.communicationId,
      }),
    );
    return;
  }

  // Live path only when operator explicitly supplies authorized test creds.
  // Workspace BALE_BOT_TOKEN must already match CRM129_BALE_BOT_TOKEN.
  const live = await action({
    action: 'share-quotation',
    quotationId,
    channel: 'BALE',
    chatId: liveChatId.trim(),
    ttlHours: 24,
  });
  assert(live.data?.success === true, `live share failed: ${JSON.stringify(live.data)}`);

  if (live.data.outcome === 'PROVIDER_SENT') {
    assert(
      typeof live.data.providerMessageId === 'string' &&
        live.data.providerMessageId.length > 0,
      'live SENT requires providerMessageId',
    );
    assert(
      typeof live.data.communicationId === 'string' &&
        live.data.communicationId.length > 0,
      'live SENT requires communicationId',
    );

    const dup = await action({
      action: 'share-quotation',
      quotationId,
      channel: 'BALE',
      chatId: liveChatId.trim(),
      ttlHours: 24,
    });
    assert(
      dup.data?.success === false,
      `duplicate send must be refused: ${JSON.stringify(dup.data)}`,
    );

    console.log(
      JSON.stringify({
        result: 'S3_R4_BALE_LIVE_PASS',
        liveStatus: 'LIVE_VERIFIED',
        quotationId,
        shareId: live.data.shareId,
        communicationId: live.data.communicationId,
        providerMessageId: live.data.providerMessageId,
      }),
    );
    return;
  }

  console.log(
    JSON.stringify({
      result: 'S3_R4_BALE_CONTRACT_PASS',
      liveStatus: 'LIVE_UNVERIFIED',
      reason: `live attempt returned ${live.data.outcome}: ${live.data.message}`,
      quotationId,
      shareId: live.data.shareId,
      outcome: live.data.outcome,
    }),
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
