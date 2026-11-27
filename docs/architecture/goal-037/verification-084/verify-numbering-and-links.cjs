// Quotation numbering + customer-link lifecycle on fresh workspace.
// Never logs raw tokens — only presence/length/hash prefix.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const evidenceDir = __dirname;
const fresh = JSON.parse(
  fs.readFileSync(path.join(evidenceDir, 'fresh-workspace.json'), 'utf8'),
);
const apiBase = fresh.apiBase.replace(/\/$/, '');
const token = fresh.apiKeyToken || fresh.accessToken;
const pgFresh = JSON.parse(
  fs.readFileSync(path.join(evidenceDir, 'pg-constraints-fresh.json'), 'utf8'),
);
const schemaName = pgFresh.schema;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const gql = async (query, variables) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${apiBase}/graphql`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    const payload = await response.json();
    const rateLimited = Array.isArray(payload.errors)
      ? payload.errors.some((error) => error?.extensions?.code === 'RATE_LIMITED')
      : false;
    if (!rateLimited) return payload;
    const retryAfterMs = Number(
      payload.errors.find((error) => error?.extensions?.retryAfterMs)?.extensions
        ?.retryAfterMs ?? 1000,
    );
    await sleep(Math.max(retryAfterMs, 700));
  }
  throw new Error('GraphQL rate limited');
};

const postApp = async (route, body) => {
  const response = await fetch(`${apiBase}/s${route}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    data = { success: false, raw: text.slice(0, 400) };
  }
  return { httpStatus: response.status, data };
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
  const text = await response.text();
  let data;
  try {
    data = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    data = { success: false, raw: text.slice(0, 400) };
  }
  return { httpStatus: response.status, data };
};

const publicGet = async (url) => {
  // Windows may resolve *.localhost to a non-loopback address. Hit 127.0.0.1
  // and preserve the workspace host via the Host header.
  const parsed = new URL(url);
  const subdomainHost = `${fresh.subdomain}.localhost:3002`;
  const fetchUrl = `http://127.0.0.1:3002${parsed.pathname}${parsed.search}`;
  const response = await fetch(fetchUrl, {
    redirect: 'manual',
    headers: { Host: subdomainHost },
  });
  const location = response.headers.get('location');
  if ([301, 302, 307, 308].includes(response.status) && location) {
    const next = new URL(location, `http://${subdomainHost}`);
    const followed = await fetch(
      `http://127.0.0.1:3002${next.pathname}${next.search}`,
      {
        redirect: 'manual',
        headers: { Host: subdomainHost },
      },
    );
    return {
      httpStatus: followed.status,
      text: await followed.text(),
      redirectedTo: next.toString(),
      usedHost: subdomainHost,
    };
  }
  return {
    httpStatus: response.status,
    text: await response.text(),
    redirectedTo: null,
    usedHost: subdomainHost,
  };
};

const psql = (sql) =>
  spawnSync(
    'docker',
    [
      'exec',
      '-i',
      'twenty-db-1',
      'psql',
      '-U',
      'postgres',
      '-d',
      'default',
      '-t',
      '-A',
      '-c',
      sql,
    ],
    { encoding: 'utf8' },
  );

const saveDraft = async (personId, name) =>
  postApp('/quotation/save-draft', {
    customerType: 'PERSON',
    personId,
    companyId: null,
    name,
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
        name: 'کالای لینک مشتری 084',
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

const advanceToReady = async (quotationId) => {
  let version = (
    await gql(
      `query($id:UUID!){ quotation(filter:{id:{eq:$id}}){ version status quotationNumber } }`,
      { id: quotationId },
    )
  ).data?.quotation;
  const steps = [];
  for (const toStatus of ['PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND']) {
    const step = await action({
      action: 'transition',
      quotationId,
      toStatus,
      version: version?.version,
    });
    steps.push({
      toStatus,
      success: step.data?.success === true,
      code: step.data?.code ?? null,
      message: step.data?.message ?? null,
      number: step.data?.quotationNumber ?? step.data?.number ?? null,
      version: step.data?.version ?? null,
    });
    if (step.data?.success !== true) break;
    version = {
      version: step.data.version,
      status: toStatus,
      quotationNumber: step.data.quotationNumber ?? step.data.number,
    };
  }
  const finalRow = await gql(
    `query($id:UUID!){ quotation(filter:{id:{eq:$id}}){ id status quotationNumber version } }`,
    { id: quotationId },
  );
  return {
    steps,
    quotation: finalRow.data?.quotation ?? null,
    errors: finalRow.errors?.map((e) => e.message?.slice(0, 200)) ?? null,
  };
};

(async () => {
  const out = {
    startedAt: new Date().toISOString(),
    schema: schemaName,
    workspaceId: fresh.workspaceId,
  };

  // Fresh workspace needs tax + currency references before drafts.
  const taxList = await action({ action: 'tax-policy-list' });
  out.taxBefore = {
    success: taxList.data?.success === true,
    count: taxList.data?.policies?.length ?? 0,
  };
  if ((taxList.data?.policies?.length ?? 0) === 0) {
    const boot = await action({ action: 'tax-policy-bootstrap' });
    out.taxBootstrap = {
      success: boot.data?.success === true,
      code: boot.data?.code ?? null,
      message: boot.data?.message ?? null,
      count: boot.data?.policies?.length ?? null,
    };
  }
  const currencyList = await action({ action: 'quotation-currency-list' });
  out.currencyBefore = {
    success: currencyList.data?.success === true,
    count: currencyList.data?.currencies?.length ?? currencyList.data?.rows?.length ?? 0,
  };
  if (
    (currencyList.data?.currencies?.length ?? currencyList.data?.rows?.length ?? 0) === 0
  ) {
    const currencyBoot = await action({ action: 'quotation-currency-bootstrap' });
    out.currencyBootstrap = {
      success: currencyBoot.data?.success === true,
      code: currencyBoot.data?.code ?? null,
      message: currencyBoot.data?.message ?? null,
      count:
        currencyBoot.data?.currencies?.length ??
        currencyBoot.data?.rows?.length ??
        null,
    };
  }

  // Ensure a person exists
  let personId = (
    await gql(`{ people(first: 1) { edges { node { id } } } }`)
  ).data?.people?.edges?.[0]?.node?.id;
  if (!personId) {
    const created = await gql(
      `mutation($data:PersonCreateInput!){ createPerson(data:$data){ id } }`,
      {
        data: {
          name: { firstName: '084', lastName: 'Numbering' },
          nationalCode: '8800840001',
        },
      },
    );
    personId = created.data?.createPerson?.id ?? null;
    out.personCreateErrors =
      created.errors?.map((e) => e.message?.slice(0, 200)) ?? null;
  }
  out.personId = personId;

  const stamp = Date.now();
  const d1 = await saveDraft(personId, `084-num-A-${stamp}`);
  const d2 = await saveDraft(personId, `084-num-B-${stamp}`);
  out.drafts = {
    d1: {
      success: d1.data?.success === true,
      quotationId: d1.data?.quotationId ?? null,
      code: d1.data?.code ?? null,
      message: d1.data?.message ?? null,
    },
    d2: {
      success: d2.data?.success === true,
      quotationId: d2.data?.quotationId ?? null,
      code: d2.data?.code ?? null,
      message: d2.data?.message ?? null,
    },
  };

  const q1Id = out.drafts.d1.quotationId;
  const q2Id = out.drafts.d2.quotationId;

  // Concurrent advance to allocate numbers
  if (q1Id && q2Id) {
    const [a, b] = await Promise.all([
      advanceToReady(q1Id),
      advanceToReady(q2Id),
    ]);
    out.concurrentAdvance = {
      a: {
        status: a.quotation?.status ?? null,
        number: a.quotation?.quotationNumber ?? null,
        stepsOk: a.steps.every((s) => s.success),
        steps: a.steps,
      },
      b: {
        status: b.quotation?.status ?? null,
        number: b.quotation?.quotationNumber ?? null,
        stepsOk: b.steps.every((s) => s.success),
        steps: b.steps,
      },
      distinctNumbers:
        Boolean(a.quotation?.quotationNumber) &&
        Boolean(b.quotation?.quotationNumber) &&
        a.quotation.quotationNumber !== b.quotation.quotationNumber,
      neitherBlank:
        Boolean(a.quotation?.quotationNumber) &&
        Boolean(b.quotation?.quotationNumber) &&
        a.quotation.quotationNumber !== '' &&
        b.quotation.quotationNumber !== '',
    };
  }

  // Sequential third document for consecutive proof
  if (personId) {
    const d3 = await saveDraft(personId, `084-num-C-${stamp}`);
    out.drafts.d3 = {
      success: d3.data?.success === true,
      quotationId: d3.data?.quotationId ?? null,
    };
    if (d3.data?.quotationId) {
      out.sequential = await advanceToReady(d3.data.quotationId);
    }
  }

  // Customer-link lifecycle on first ready quotation
  const linkTargetId =
    out.concurrentAdvance?.a?.status === 'READY_TO_SEND'
      ? q1Id
      : out.concurrentAdvance?.b?.status === 'READY_TO_SEND'
        ? q2Id
        : out.sequential?.quotation?.status === 'READY_TO_SEND'
          ? out.drafts.d3?.quotationId
          : null;

  out.customerLink = { quotationId: linkTargetId };
  if (linkTargetId) {
    const draftBlocked = await action({
      action: 'create-customer-link',
      quotationId: out.drafts.d1.quotationId,
      ttlHours: 24,
    });
    // If d1 already advanced, this may succeed; also try a fresh draft
    const draftOnly = await saveDraft(personId, `084-draft-block-${stamp}`);
    let draftMint = null;
    if (draftOnly.data?.quotationId) {
      draftMint = await action({
        action: 'create-customer-link',
        quotationId: draftOnly.data.quotationId,
        ttlHours: 24,
      });
    }
    out.customerLink.draftBlocked = {
      success: draftMint?.data?.success === true,
      code: draftMint?.data?.code ?? null,
      message: draftMint?.data?.message ?? null,
      expectedFail: draftMint?.data?.success !== true,
    };

    const minted = await action({
      action: 'create-customer-link',
      quotationId: linkTargetId,
      ttlHours: 24,
    });
    const rawToken = minted.data?.token ?? minted.data?.rawToken ?? null;
    const linkId = minted.data?.linkId ?? null;
    const viewUrl = minted.data?.viewUrl ?? null;
    const hash = rawToken
      ? createHash('sha256').update(rawToken, 'utf8').digest('hex')
      : null;
    out.customerLink.mint = {
      success: minted.data?.success === true,
      code: minted.data?.code ?? null,
      message: minted.data?.message ?? null,
      linkId,
      rawTokenPresent: Boolean(rawToken),
      rawTokenLength: rawToken ? rawToken.length : 0,
      viewUrlPresent: Boolean(viewUrl),
      hashPrefix: hash ? hash.slice(0, 12) : null,
    };

    if (rawToken && viewUrl) {
      const valid = await publicGet(viewUrl);
      out.customerLink.validRead = {
        httpStatus: valid.httpStatus,
        hasPayable: valid.text.includes('مبلغ نهایی'),
        echoedToken: valid.text.includes(rawToken),
      };

      // Stored hash check (never log full hash beyond prefix already recorded)
      const stored = await gql(
        `query($id:UUID!){ quotationCustomerLinks(filter:{id:{eq:$id}},first:1){ edges{ node{ id tokenHash expiresAt revokedAt } } } }`,
        { id: linkId },
      );
      const row = stored.data?.quotationCustomerLinks?.edges?.[0]?.node;
      out.customerLink.stored = {
        id: row?.id ?? null,
        hashMatches: row?.tokenHash === hash,
        hasExpiresAt: Boolean(row?.expiresAt),
        revokedAt: row?.revokedAt ?? null,
      };

      const revoked = await action({
        action: 'revoke-customer-link',
        quotationId: linkTargetId,
        linkId,
      });
      out.customerLink.revoke = {
        success: revoked.data?.success === true,
        code: revoked.data?.code ?? null,
        message: revoked.data?.message ?? null,
      };
      const afterRevoke = await publicGet(viewUrl);
      out.customerLink.afterRevoke = {
        httpStatus: afterRevoke.httpStatus,
        hasRevokeCopy: afterRevoke.text.includes('لغو'),
      };

      // Expiry path: mint again, force expiresAt into the past
      const expiredMint = await action({
        action: 'create-customer-link',
        quotationId: linkTargetId,
        ttlHours: 1,
      });
      const expiredId = expiredMint.data?.linkId ?? null;
      const expiredUrl = expiredMint.data?.viewUrl ?? null;
      out.customerLink.expiryMint = {
        success: expiredMint.data?.success === true,
        linkId: expiredId,
        rawTokenPresent: Boolean(
          expiredMint.data?.token || expiredMint.data?.rawToken,
        ),
      };
      if (expiredId) {
        const past = new Date(Date.now() - 60_000).toISOString();
        const forced = await gql(
          `mutation($id:UUID!,$data:QuotationCustomerLinkUpdateInput!){ updateQuotationCustomerLink(id:$id, data:$data){ id } }`,
          { id: expiredId, data: { expiresAt: past } },
        );
        out.customerLink.forceExpiry = {
          ok: forced.data?.updateQuotationCustomerLink?.id === expiredId,
          errors: forced.errors?.map((e) => e.message?.slice(0, 160)) ?? null,
        };
        if (expiredUrl) {
          const afterExpiry = await publicGet(expiredUrl);
          out.customerLink.afterExpiry = {
            httpStatus: afterExpiry.httpStatus,
            hasExpiryCopy: afterExpiry.text.includes('منقضی'),
          };
        }
      }
    }

    // Anonymous mint must fail
    const anonymous = await fetch(`${apiBase}/rest/quotation/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-customer-link',
        quotationId: linkTargetId,
      }),
    });
    const anonymousBody = await anonymous.text();
    out.customerLink.anonymousMint = {
      status: anonymous.status,
      unauthorized:
        anonymous.status === 401 ||
        anonymous.status === 403 ||
        anonymousBody.toLowerCase().includes('unauthorized') ||
        anonymousBody.includes('Missing authentication token'),
    };
  }

  // Sequence rows present (no blank scopeKey)
  const sequences = await gql(
    `{ quotationSequences(first:20){ edges{ node{ id scopeKey lastIssued width name } } } }`,
  );
  out.sequences = {
    count: sequences.data?.quotationSequences?.edges?.length ?? 0,
    rows: (sequences.data?.quotationSequences?.edges ?? []).map((e) => ({
      scopeKey: e.node.scopeKey,
      lastIssued: e.node.lastIssued,
      width: e.node.width,
      blankKey: !e.node.scopeKey,
    })),
    errors: sequences.errors?.map((e) => e.message?.slice(0, 160)) ?? null,
  };

  // PG: refuse null and duplicate inserts inside rolled-back transactions
  const nullRefuse = psql(`
BEGIN;
DO $$
BEGIN
  BEGIN
    INSERT INTO "${schemaName}"."_quotationCustomerLink" ("id","tokenHash","expiresAt","createdAt","updatedAt")
    VALUES (gen_random_uuid(), NULL, now(), now(), now());
    RAISE EXCEPTION 'NULL_TOKENHASH_ACCEPTED';
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO "${schemaName}"."_quotationSequence" ("id","scopeKey","name","lastIssued","width","createdAt","updatedAt")
    VALUES (gen_random_uuid(), NULL, 'x', 0, 6, now(), now());
    RAISE EXCEPTION 'NULL_SCOPEKEY_ACCEPTED';
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;
END $$;
ROLLBACK;
SELECT 'null-refused-ok';
`);
  out.pgNullInsert = {
    stdout: nullRefuse.stdout.trim(),
    stderr: (nullRefuse.stderr || '').slice(0, 600),
    exitCode: nullRefuse.status,
    refusedOk: nullRefuse.stdout.includes('null-refused-ok'),
  };

  const dup = psql(`
BEGIN;
DO $$
BEGIN
  INSERT INTO "${schemaName}"."_quotationSequence" ("id","scopeKey","name","lastIssued","width","createdAt","updatedAt")
  VALUES ('11111111-1111-4111-8111-111111111111', 'QUOTATION:084-TEST', 't', 0, 6, now(), now());
  BEGIN
    INSERT INTO "${schemaName}"."_quotationSequence" ("id","scopeKey","name","lastIssued","width","createdAt","updatedAt")
    VALUES ('22222222-2222-4222-8222-222222222222', 'QUOTATION:084-TEST', 't2', 0, 6, now(), now());
    RAISE EXCEPTION 'DUP_ACCEPTED';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END $$;
ROLLBACK;
SELECT 'dup-refused-ok';
`);
  out.pgDuplicateInsert = {
    stdout: dup.stdout.trim(),
    stderr: (dup.stderr || '').slice(0, 600),
    exitCode: dup.status,
    refusedOk: dup.stdout.includes('dup-refused-ok'),
  };

  const leftover = psql(
    `SELECT count(*) FROM "${schemaName}"."_quotationSequence" WHERE "scopeKey" = 'QUOTATION:084-TEST';`,
  );
  out.pgLeftoverTestRows = leftover.stdout.trim();

  out.finishedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(evidenceDir, 'numbering-and-links.json'),
    JSON.stringify(out, null, 2),
  );
  // sanitized console summary
  console.log(
    JSON.stringify(
      {
        drafts: out.drafts,
        concurrentAdvance: out.concurrentAdvance
          ? {
              a: {
                status: out.concurrentAdvance.a.status,
                number: out.concurrentAdvance.a.number,
              },
              b: {
                status: out.concurrentAdvance.b.status,
                number: out.concurrentAdvance.b.number,
              },
              distinctNumbers: out.concurrentAdvance.distinctNumbers,
              neitherBlank: out.concurrentAdvance.neitherBlank,
            }
          : null,
        sequentialNumber: out.sequential?.quotation?.quotationNumber ?? null,
        customerLink: {
          mintSuccess: out.customerLink?.mint?.success,
          rawTokenPresent: out.customerLink?.mint?.rawTokenPresent,
          hashPrefix: out.customerLink?.mint?.hashPrefix,
          validRead: out.customerLink?.validRead,
          revoke: out.customerLink?.revoke,
          afterRevoke: out.customerLink?.afterRevoke,
          afterExpiry: out.customerLink?.afterExpiry,
          draftBlocked: out.customerLink?.draftBlocked,
          anonymousUnauthorized: out.customerLink?.anonymousMint?.unauthorized,
        },
        sequences: out.sequences,
        pgNullInsert: out.pgNullInsert,
        pgDuplicateInsert: out.pgDuplicateInsert,
        pgLeftoverTestRows: out.pgLeftoverTestRows,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
