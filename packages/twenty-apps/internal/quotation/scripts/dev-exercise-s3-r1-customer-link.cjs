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

const publicGet = async (url) => {
  const response = await fetch(url, { redirect: 'manual' });
  const location = response.headers.get('location');

  if (
    (response.status === 301 ||
      response.status === 302 ||
      response.status === 307 ||
      response.status === 308) &&
    location
  ) {
    const nextUrl = new URL(location, url).toString();
    const followed = await fetch(nextUrl, { redirect: 'manual' });
    const text = await followed.text();
    return {
      httpStatus: followed.status,
      text,
      redirectedTo: nextUrl,
    };
  }

  const text = await response.text();
  return { httpStatus: response.status, text, redirectedTo: null };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const main = async () => {
  const personId = (await gql(`{ people(first: 1) { edges { node { id } } } }`))
    .data.people.edges[0].node.id;

  const draft = await post('/quotation/save-draft', {
    customerType: 'PERSON',
    personId,
    companyId: null,
    name: `S3-R1-${Date.now()}`,
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
        name: 'کالای لینک مشتری',
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
  });

  assert(draft.data?.success === true, `save failed: ${JSON.stringify(draft.data)}`);
  const quotationId = draft.data.quotationId;

  const blocked = await action({
    action: 'create-customer-link',
    quotationId,
    ttlHours: 24,
  });
  assert(
    blocked.data?.success !== true,
    `draft must not mint a link: ${JSON.stringify(blocked.data)}`,
  );

  let version = (
    await gql(
      `{ quotation(filter: { id: { eq: "${quotationId}" } }) { version status } }`,
    )
  ).data.quotation.version;

  for (const toStatus of ['PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND']) {
    const step = await action({
      action: 'transition',
      quotationId,
      toStatus,
      version,
    });
    assert(step.data?.success === true, `${toStatus} failed: ${JSON.stringify(step.data)}`);
    version = step.data.version;
  }

  const created = await action({
    action: 'create-customer-link',
    quotationId,
    ttlHours: 24,
  });
  assert(created.data?.success === true, `mint failed: ${JSON.stringify(created.data)}`);
  const rawToken = created.data.token ?? created.data.rawToken;
  const viewUrl = created.data.viewUrl;
  const linkId = created.data.linkId;
  assert(typeof rawToken === 'string' && rawToken.length > 20, 'raw token missing');
  assert(viewUrl.includes(encodeURIComponent(rawToken)), 'view url missing token');

  const hash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
  const stored = await gql(`{
    quotationCustomerLinks(filter: { id: { eq: "${linkId}" } }, first: 1) {
      edges { node { id tokenHash expiresAt revokedAt quotationId } }
    }
  }`);
  const row = stored.data?.quotationCustomerLinks?.edges?.[0]?.node;
  assert(row?.tokenHash === hash, 'stored value is not the sha256 of the token');
  assert(!JSON.stringify(row).includes(rawToken), 'raw token was persisted');

  const valid = await publicGet(viewUrl);
  if (valid.httpStatus !== 200) {
    throw new Error(
      `valid link status ${valid.httpStatus} url=${viewUrl} redirectedTo=${valid.redirectedTo} body=${valid.text.slice(0, 400)}`,
    );
  }
  assert(valid.text.includes('کالای لینک مشتری'), 'customer line missing');
  assert(valid.text.includes('مبلغ نهایی'), 'payable missing');
  assert(!valid.text.includes(rawToken), 'page echoed the token');
  assert(!/apiKey|tokenHash|TWENTY_/i.test(valid.text), 'internal marker leaked');
  assert(!valid.text.includes(personId), 'person id leaked');

  const anonymousMint = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create-customer-link',
      quotationId,
    }),
  });
  const anonymousBody = await anonymousMint.text();
  assert(
    anonymousMint.status === 401 ||
      anonymousMint.status === 403 ||
      anonymousBody.toLowerCase().includes('unauthorized') ||
      anonymousBody.includes('Missing authentication token'),
    `unauthenticated mint status ${anonymousMint.status} body=${anonymousBody.slice(0, 500)}`,
  );
  const linksAfterAnonymous = await gql(`{
    quotationCustomerLinks(filter: { quotationId: { eq: "${quotationId}" } }) {
      edges { node { id } }
    }
  }`);
  assert(
    linksAfterAnonymous.data.quotationCustomerLinks.edges.length === 1,
    'anonymous mint created or removed a link',
  );

  const unknown = await publicGet(
    `${apiBase}/s/quotation/customer-view?token=${encodeURIComponent('not-a-real-token')}`,
  );
  assert(unknown.httpStatus === 404, `unknown token status ${unknown.httpStatus}`);
  assert(!unknown.text.includes('کالای لینک مشتری'), 'unknown token showed the quotation');

  const otherQuotation = await post('/quotation/save-draft', {
    customerType: 'PERSON',
    personId,
    companyId: null,
    name: `S3-R1-other-${Date.now()}`,
    paymentTerms: 'نقد',
    taxPolicy: 'IR_VAT_9',
    documentDiscountKind: 'NONE',
    documentDiscountPercentText: '',
    documentDiscountAmountText: '',
    lines: [
      {
        clientLineId: 'l1',
        catalogItemId: null,
        kind: 'SERVICE',
        name: 'خدمت محرمانه دیگر',
        description: null,
        unit: 'ساعت',
        quantityText: '1',
        unitPriceText: '2000',
        moneyUnit: 'TOMAN',
        discountKind: 'NONE',
        discountPercentText: '',
        discountAmountText: '',
      },
    ],
  });
  assert(otherQuotation.data?.success === true, 'second draft failed');
  assert(
    !valid.text.includes('خدمت محرمانه دیگر'),
    'customer page included another quotation',
  );
  assert(
    !valid.text.includes(otherQuotation.data.quotationId),
    'customer page included another quotation id',
  );

  const revoked = await action({
    action: 'revoke-customer-link',
    quotationId,
    linkId,
  });
  assert(revoked.data?.success === true, `revoke failed: ${JSON.stringify(revoked.data)}`);
  const afterRevoke = await publicGet(viewUrl);
  assert(afterRevoke.httpStatus === 410, `revoked status ${afterRevoke.httpStatus}`);
  assert(afterRevoke.text.includes('لغو'), 'revoke page missing Persian copy');

  const expiredMint = await action({
    action: 'create-customer-link',
    quotationId,
    ttlHours: 1,
  });
  assert(expiredMint.data?.success === true, 'second mint failed');
  const expiredId = expiredMint.data.linkId;
  const past = new Date(Date.now() - 60_000).toISOString();
  const forced = await gql(`mutation {
    updateQuotationCustomerLink(id: "${expiredId}", data: { expiresAt: "${past}" }) { id }
  }`);
  assert(forced.data?.updateQuotationCustomerLink?.id === expiredId, 'could not force expiry');
  const afterExpiry = await publicGet(expiredMint.data.viewUrl);
  assert(afterExpiry.httpStatus === 410, `expired status ${afterExpiry.httpStatus}`);
  assert(afterExpiry.text.includes('منقضی'), 'expiry page missing Persian copy');

  console.log(
    JSON.stringify(
      {
        marker: 'S3_R1_CUSTOMER_LINK_PASS',
        quotationId,
        linkId,
        storedHashPrefix: hash.slice(0, 12),
        validStatus: valid.httpStatus,
        revokedStatus: afterRevoke.httpStatus,
        expiredStatus: afterExpiry.httpStatus,
        unknownStatus: unknown.httpStatus,
        anonymousMintStatus: anonymousMint.status,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error('S3_R1_CUSTOMER_LINK_FAIL', error);
  process.exit(1);
});
