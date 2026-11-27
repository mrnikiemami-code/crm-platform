// Re-probe customer-view via 127.0.0.1 + Host header (Windows *.localhost DNS).
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');

const fresh = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fresh-workspace.json'), 'utf8'),
);
const token = fresh.accessToken;
const apiBase = fresh.apiBase.replace(/\/$/, '');
const subdomainHost = `${fresh.subdomain}.localhost:3002`;

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

const publicGet = (rawToken) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3002,
        path: `/s/quotation/customer-view?token=${encodeURIComponent(rawToken)}`,
        method: 'GET',
        headers: { Host: subdomainHost },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            httpStatus: res.statusCode,
            text: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });

(async () => {
  const ready = await gql(`{
    quotations(filter:{status:{eq:READY_TO_SEND}},first:1){
      edges{ node{ id status quotationNumber } }
    }
  }`);
  const quotationId = ready.data?.quotations?.edges?.[0]?.node?.id;
  if (!quotationId) {
    console.log(JSON.stringify({ error: 'no ready quotation', ready }, null, 2));
    return;
  }
  const minted = await action({
    action: 'create-customer-link',
    quotationId,
    ttlHours: 24,
  });
  const raw = minted.token || minted.rawToken;
  const linkId = minted.linkId;
  if (!raw || !linkId) {
    console.log(
      JSON.stringify(
        {
          error: 'mint failed',
          success: minted.success,
          code: minted.code,
          message: minted.message,
        },
        null,
        2,
      ),
    );
    return;
  }
  const valid = await publicGet(raw);
  const revoked = await action({
    action: 'revoke-customer-link',
    quotationId,
    linkId,
  });
  const afterRevoke = await publicGet(raw);

  const expiredMint = await action({
    action: 'create-customer-link',
    quotationId,
    ttlHours: 1,
  });
  const expiredRaw = expiredMint.token || expiredMint.rawToken;
  const expiredId = expiredMint.linkId;
  const past = new Date(Date.now() - 60_000).toISOString();
  await gql(
    `mutation($id:UUID!,$data:QuotationCustomerLinkUpdateInput!){ updateQuotationCustomerLink(id:$id, data:$data){ id } }`,
    { id: expiredId, data: { expiresAt: past } },
  );
  const afterExpiry = await publicGet(expiredRaw);

  const out = {
    quotationId,
    hashPrefix: createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 12),
    usedHost: subdomainHost,
    valid: {
      httpStatus: valid.httpStatus,
      hasPayable: valid.text.includes('مبلغ نهایی'),
      echoedToken: valid.text.includes(raw),
      snippet: valid.text.replace(/\s+/g, ' ').slice(0, 180),
    },
    revoke: { success: revoked.success === true },
    afterRevoke: {
      httpStatus: afterRevoke.httpStatus,
      hasRevokeCopy: afterRevoke.text.includes('لغو'),
      snippet: afterRevoke.text.replace(/\s+/g, ' ').slice(0, 120),
    },
    afterExpiry: {
      httpStatus: afterExpiry.httpStatus,
      hasExpiryCopy: afterExpiry.text.includes('منقضی'),
      snippet: afterExpiry.text.replace(/\s+/g, ' ').slice(0, 120),
    },
  };
  fs.writeFileSync(
    path.join(__dirname, 'customer-view-reprobe.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
