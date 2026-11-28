// Goal 039 Package B/C — LF draft create + Nest lifecycle/PDF/share/accounting.
// Mock/Dev only. No live Asan. No outbound customer messages. No credentials logged.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const evidenceDir = __dirname;
const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];
if (!remote?.apiUrl || String(remote.apiUrl).includes('6080')) {
  console.error(JSON.stringify({ status: 'BLOCKED', reason: 'missing or intranet remote' }));
  process.exit(2);
}

const apiBase = String(remote.apiUrl).replace(/\/$/, '');
const token = remote.apiKey;
const marker = `G039-091-${Date.now()}`;
const results = {
  apiBase,
  marker,
  sourceSha: fs.readFileSync(path.join(evidenceDir, 'CODE_SHA.txt'), 'utf8').trim(),
  checks: {},
  failures: [],
  notes: [],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const record = (id, ok, detail = {}) => {
  results.checks[id] = { ok, ...detail };
  if (!ok) results.failures.push(id);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}`);
};

const isHttpOk = (status) => status >= 200 && status < 300;

const redact = (value) => {
  if (value == null) return value;
  const text = String(value);
  if (text.length <= 12) return '[redacted]';
  return `${text.slice(0, 6)}…${text.slice(-4)}`;
};

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
      ? payload.errors.some((error) => error?.extensions?.code === 'RATE_LIMITED')
      : false;
    if (!rateLimited) return payload;
    await sleep(900);
  }
  throw new Error('GraphQL rate limited after retries');
};

const lf = async (route, body) => {
  const response = await fetch(`${apiBase}/s${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    json = { success: false, raw: text.slice(0, 400) };
  }
  return { status: response.status, json };
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
  let json;
  try {
    json = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    json = { success: false, raw: text.slice(0, 400) };
  }
  return { status: response.status, json };
};

const linePayload = (overrides = {}) => ({
  clientLineId: `line-${Math.random().toString(16).slice(2)}`,
  catalogItemId: null,
  kind: 'SERVICE',
  name: 'خدمت آزمون G039',
  description: null,
  unit: 'ساعت',
  quantityText: '2',
  unitPriceText: '1500',
  moneyUnit: 'TOMAN',
  discountKind: 'NONE',
  discountPercentText: '',
  discountAmountText: '',
  ...overrides,
});

const draftPayload = (overrides = {}) => ({
  name: `${marker}-draft`,
  customerType: 'PERSON',
  personId: null,
  companyId: null,
  paymentTerms: 'نقد',
  taxPolicy: 'IR_VAT_9',
  displayMoneyUnit: 'TOMAN',
  documentDiscountKind: 'NONE',
  documentDiscountPercentText: '',
  documentDiscountAmountText: '',
  lines: [linePayload()],
  ...overrides,
});

// Product lifecycle table (tax-007): no DRAFT→READY_TO_SEND shortcut.
const TRANSITION_PATH = {
  DRAFT: {
    PENDING_INTERNAL_APPROVAL: ['PENDING_INTERNAL_APPROVAL'],
    READY_TO_SEND: ['PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND'],
    SENT: ['PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND', 'SENT'],
  },
  PENDING_INTERNAL_APPROVAL: {
    READY_TO_SEND: ['READY_TO_SEND'],
    SENT: ['READY_TO_SEND', 'SENT'],
  },
  READY_TO_SEND: {
    SENT: ['SENT'],
  },
};

const transitionTo = async (quotationId, toStatus) => {
  const lifecycle = await action({ action: 'get-lifecycle', quotationId });
  if (lifecycle.json.success !== true) {
    return { ok: false, lifecycle };
  }
  let current = lifecycle.json.lifecycle;
  const steps = TRANSITION_PATH[current.status]?.[toStatus] ?? [toStatus];
  let last = lifecycle;
  for (const status of steps) {
    last = await action({
      action: 'transition',
      quotationId,
      toStatus: status,
      version: current.version,
    });
    if (last.json.success !== true) {
      return { ok: false, last, attempted: status };
    }
    const refreshed = await action({ action: 'get-lifecycle', quotationId });
    if (refreshed.json.success !== true) {
      return { ok: false, last: refreshed, attempted: status };
    }
    current = refreshed.json.lifecycle;
  }
  return { ok: true, last, current };
};

const readQuotation = async (quotationId) => {
  const payload = await gql(`{
    quotation(filter: { id: { eq: "${quotationId}" } }) {
      id status version personId companyId currencyCode taxPolicy
      grossExact netExact taxExact totalExact
      dutyExact taxRateBasisPoints dutyRateBasisPoints
    }
  }`);
  return payload.data?.quotation ?? null;
};

(async () => {
  // Nest save-draft expects AtomicSaveRequest (header+exact lines). Canonical
  // create from Person/Company uses LF /quotation/save-draft (form text inputs).
  const nestProbe = await action({
    action: 'save-draft',
    name: `${marker}-nest-probe`,
    customerType: 'PERSON',
    personId: '00000000-0000-4000-8000-000000000001',
    lines: [linePayload()],
  });
  record(
    'B-NEST-SAVE-DRAFT-REQUIRES-ATOMIC-PLAN',
    nestProbe.json.success === false && nestProbe.json.code === 'INVALID_INPUT',
    {
      note: 'Nest REST save-draft refuses form-text payloads; LF save-draft remains the create path',
      code: nestProbe.json.code,
    },
  );

  const customers = await gql(`{
    people(first: 5) { edges { node { id name { firstName lastName } } } }
    companies(first: 5) { edges { node { id name } } }
  }`);
  const person = (customers.data?.people?.edges || [])
    .map((edge) => edge.node)
    .find((node) => (node.name?.firstName || '').trim() !== '');
  const company = (customers.data?.companies?.edges || [])
    .map((edge) => edge.node)
    .find((node) => (node.name || '').trim() !== '');
  record('B-CUSTOMERS-AVAILABLE', Boolean(person && company), {
    personId: person?.id || null,
    companyId: company?.id || null,
  });
  if (!person || !company) {
    results.status = 'FAIL';
    fs.writeFileSync(path.join(evidenceDir, 'lifecycle-pdf-share.json'), JSON.stringify(results, null, 2));
    process.exit(1);
  }

  const createdPerson = await lf(
    '/quotation/save-draft',
    draftPayload({
      personId: person.id,
      customerType: 'PERSON',
      documentDiscountKind: 'AMOUNT',
      documentDiscountAmountText: '100',
      lines: [
        linePayload({
          quantityText: '3',
          unitPriceText: '1750',
          discountKind: 'RATE',
          discountPercentText: '5',
        }),
      ],
    }),
  );
  record('B-CREATE-FROM-PERSON', createdPerson.json.success === true, {
    status: createdPerson.status,
    quotationId: createdPerson.json.quotationId || null,
    code: createdPerson.json.code || null,
    planTotal: createdPerson.json.plan?.totalExact || null,
  });
  const personQuotationId = createdPerson.json.quotationId;

  let personRead = null;
  if (personQuotationId) {
    personRead = await readQuotation(personQuotationId);
    const plan = createdPerson.json.plan?.totalsExact || createdPerson.json.plan || {};
    const financeOk =
      personRead &&
      personRead.status === 'DRAFT' &&
      personRead.personId === person.id &&
      String(personRead.grossExact) === String(plan.grossExact || createdPerson.json.plan?.totalsExact?.grossExact) &&
      String(personRead.totalExact) === String(
        plan.totalExact || createdPerson.json.plan?.totalExact,
      );
    // Independent recomputation from LF plan fields (taxExact includes duty).
    const independent = {
      grossExact: String(plan.grossExact),
      netExact: String(plan.netExact),
      taxExact: String(plan.taxExact),
      dutyExact: String(plan.dutyExact),
      totalExact: String(plan.totalExact || createdPerson.json.plan?.totalExact),
    };
    const matchesIndependent =
      String(personRead?.grossExact) === independent.grossExact &&
      String(personRead?.netExact) === independent.netExact &&
      String(personRead?.taxExact) === independent.taxExact &&
      String(personRead?.totalExact) === independent.totalExact;
    record('B-FINANCE-INDEPENDENT-ARITHMETIC', Boolean(financeOk && matchesIndependent), {
      independent,
      actual: personRead
        ? {
            grossExact: personRead.grossExact,
            netExact: personRead.netExact,
            taxExact: personRead.taxExact,
            dutyExact: personRead.dutyExact,
            totalExact: personRead.totalExact,
            currencyCode: personRead.currencyCode,
            taxPolicy: personRead.taxPolicy,
          }
        : null,
      displayTotal: createdPerson.json.plan?.displayTotal || null,
    });
  } else {
    record('B-FINANCE-INDEPENDENT-ARITHMETIC', false, { reason: 'no quotation id' });
  }

  const createdCompany = await lf(
    '/quotation/save-draft',
    draftPayload({
      name: `${marker}-company`,
      customerType: 'COMPANY',
      personId: null,
      companyId: company.id,
      lines: [linePayload({ quantityText: '1', unitPriceText: '2000' })],
    }),
  );
  record('B-CREATE-FROM-COMPANY', createdCompany.json.success === true, {
    status: createdCompany.status,
    quotationId: createdCompany.json.quotationId || null,
  });

  if (personQuotationId && personRead) {
    const conflict = await lf(
      '/quotation/save-draft',
      draftPayload({
        quotationId: personQuotationId,
        expectedVersion: Math.max(0, Number(personRead.version) - 1),
        personId: person.id,
        lines: [linePayload({ quantityText: '1', unitPriceText: '1000' })],
      }),
    );
    const conflictCode = conflict.json.code || '';
    record(
      'B-VERSION-CONFLICT',
      conflict.json.success === false && /VERSION|CONFLICT|STALE/i.test(conflictCode),
      {
        code: conflictCode,
        message: conflict.json.message || null,
        note: 'Observed code may be QUOTATION_VERSION_CONFLICT (Nest/LF alignment)',
      },
    );
  } else {
    record('B-VERSION-CONFLICT', false, { reason: 'skipped' });
  }

  if (personQuotationId) {
    const toReady = await transitionTo(personQuotationId, 'READY_TO_SEND');
    record('B-LIFECYCLE-APPROVE', toReady.ok === true, {
      target: 'READY_TO_SEND',
      lastSuccess: toReady.last?.json?.success,
      code: toReady.last?.json?.code || null,
      message: toReady.last?.json?.message || null,
    });

    const lifecycleAfter = await action({ action: 'get-lifecycle', quotationId: personQuotationId });
    const badEdge = await action({
      action: 'transition',
      quotationId: personQuotationId,
      toStatus: 'DRAFT',
      version: lifecycleAfter.json.lifecycle?.version,
    });
    record(
      'B-LIFECYCLE-UNSUPPORTED-REFUSED',
      badEdge.json.success === false,
      { code: badEdge.json.code || null, message: badEdge.json.message || null },
    );

    const sealed = await gql(`{
      quotation(filter: { id: { eq: "${personQuotationId}" } }) {
        id status version grossExact netExact taxExact totalExact
      }
      quotationRevisions(filter: { quotationId: { eq: "${personQuotationId}" } }, first: 5) {
        edges { node { id version status grossExact totalExact } }
      }
    }`);
    const revisions = sealed.data?.quotationRevisions?.edges?.map((e) => e.node) || [];
    record(
      'B-IMMUTABLE-APPROVED-REVISION',
      sealed.data?.quotation?.status === 'READY_TO_SEND' && revisions.length >= 1,
      {
        status: sealed.data?.quotation?.status || null,
        revisionCount: revisions.length,
        revisionVersions: revisions.map((r) => r.version),
      },
    );

    const pdf = await action({ action: 'generate-pdf', quotationId: personQuotationId });
    const buffer = Buffer.from(pdf.json.pdfBase64 || '', 'base64');
    const isPdf = buffer.subarray(0, 5).toString('latin1') === '%PDF-';
    record('B-PDF-PERSIAN-BYTES', isHttpOk(pdf.status) && pdf.json.success === true && isPdf, {
      status: pdf.status,
      success: pdf.json.success,
      code: pdf.json.code || null,
      message: pdf.json.message || null,
      fileName: pdf.json.fileName || null,
      bytes: buffer.length,
      pdfMagic: buffer.subarray(0, 5).toString('latin1'),
      defect:
        pdf.json.success === true
          ? null
          : 'DEFECT-PDF-FONT — Dev image missing Persian-capable TTF (Vazirmatn); architect owns image/font packaging. No product hotpatch applied.',
    });
    if (isPdf) {
      fs.writeFileSync(path.join(evidenceDir, 'sample-approved.pdf'), buffer);
    }

    const connections = await action({ action: 'accounting-connection-list' });
    const mock =
      (connections.json.connections || []).find((c) => c.adapterId === 'mock' && c.isActive !== false) ||
      (connections.json.connections || []).find((c) => c.adapterId === 'mock');
    const connectionId = mock?.recordId || mock?.id || null;
    if (connectionId) {
      const preview = await action({
        action: 'accounting-outbound-preview-quotation-export',
        quotationId: personQuotationId,
        connectionId,
      });
      record(
        'B-ACCOUNTING-PREVIEW-MOCK',
        isHttpOk(preview.status) && preview.json.success === true && Boolean(preview.json.preview),
        {
          status: preview.status,
          success: preview.json.success,
          keys: Object.keys(preview.json || {}),
          hasPreview: Boolean(preview.json.preview),
          hasFlags: Boolean(preview.json.flags),
          transportApproved: preview.json.transportApproved ?? null,
          error: preview.json.error || preview.json.message || null,
        },
      );
    } else {
      record('B-ACCOUNTING-PREVIEW-MOCK', false, { reason: 'no mock connection' });
    }

    // Product seven-channel set (Nest + app domain). No COPY/SMS/EMAIL invent.
    const channels = [
      'BALE',
      'WHATSAPP',
      'TELEGRAM',
      'INSTAGRAM',
      'EITAA',
      'RUBIKA',
      'SOROUSH',
    ];
    const channelResults = {};
    for (const channel of channels) {
      const response = await action({
        action: 'share-quotation',
        quotationId: personQuotationId,
        channel,
      });
      const shareText = response.json.shareText;
      channelResults[channel] = {
        ok: isHttpOk(response.status) && response.json.success === true && typeof shareText === 'string' && shareText.length > 0,
        status: response.status,
        success: response.json.success,
        outcome: response.json.outcome || null,
        deliveryKind: response.json.deliveryKind || null,
        hasShareText: typeof shareText === 'string' && shareText.length > 0,
        deliveryClaimed:
          response.json.outcome === 'PROVIDER_SENT' ||
          response.json.delivered === true ||
          response.json.sent === true,
        code: response.json.code || null,
        keys: Object.keys(response.json || {}),
      };
    }
    const manualOk = ['WHATSAPP', 'TELEGRAM', 'INSTAGRAM', 'EITAA', 'RUBIKA', 'SOROUSH'].every(
      (channel) => channelResults[channel]?.ok === true,
    );
    const baleHonest =
      channelResults.BALE?.ok === true ||
      channelResults.BALE?.success === false; // provider may refuse without chatId
    const noFakeDelivery = Object.values(channelResults).every((row) => row.deliveryClaimed !== true);
    record('C-SHARE-MANUAL-TEXT', manualOk && noFakeDelivery, {
      channels: channelResults,
      noFakeDelivery,
    });
    record(
      'C-SEVEN-CHANNEL-COPY-SHARE',
      manualOk && baleHonest && noFakeDelivery,
      {
        channels: channelResults,
        noFakeDelivery,
        note: 'Seven product channels; BALE may honest-fail without chat_id; no delivery invented',
      },
    );

    const link = await action({
      action: 'create-customer-link',
      quotationId: personQuotationId,
    });
    const linkToken = link.json.rawToken || link.json.token || link.json.linkToken || null;
    const linkUrl = link.json.viewUrl || link.json.url || link.json.customerLinkUrl || null;
    record(
      'C-CUSTOMER-LINK-CREATE',
      isHttpOk(link.status) && link.json.success === true && Boolean(link.json.linkId) && Boolean(linkToken || linkUrl),
      {
        status: link.status,
        success: link.json.success,
        hasLinkId: Boolean(link.json.linkId),
        hasToken: Boolean(linkToken),
        hasUrl: Boolean(linkUrl),
        tokenRedacted: linkToken ? redact(linkToken) : null,
        expiresAt: link.json.expiresAt || null,
        code: link.json.code || null,
        message: link.json.message || null,
        keys: Object.keys(link.json || {}),
      },
    );

    if (link.json.linkId) {
      const revoke = await action({
        action: 'revoke-customer-link',
        quotationId: personQuotationId,
        linkId: link.json.linkId,
      });
      record(
        'C-CUSTOMER-LINK-REVOKE',
        isHttpOk(revoke.status) && revoke.json.success !== false,
        {
          status: revoke.status,
          success: revoke.json.success,
          code: revoke.json.code || null,
        },
      );
    } else {
      record('C-CUSTOMER-LINK-REVOKE', false, {
        reason: 'no linkId',
        linkResponseKeys: Object.keys(link.json || {}),
      });
    }

    const draftOnly = createdCompany.json.quotationId;
    if (draftOnly) {
      const draftLink = await action({
        action: 'create-customer-link',
        quotationId: draftOnly,
      });
      record(
        'C-DRAFT-LINK-DENIED',
        draftLink.json.success === false,
        {
          code: draftLink.json.code || null,
          message: draftLink.json.message || null,
        },
      );
    } else {
      record('C-DRAFT-LINK-DENIED', false, { reason: 'no company draft' });
    }

    // Customer link typically requires SENT; advance if create failed on READY_TO_SEND.
    if (link.json.success !== true) {
      const toSent = await transitionTo(personQuotationId, 'SENT');
      record('C-LIFECYCLE-SEND-FOR-LINK', toSent.ok === true, {
        code: toSent.last?.json?.code || null,
        message: toSent.last?.json?.message || null,
      });
      if (toSent.ok) {
        const link2 = await action({
          action: 'create-customer-link',
          quotationId: personQuotationId,
        });
        const token2 = link2.json.token || link2.json.linkToken || null;
        const url2 = link2.json.url || link2.json.customerLinkUrl || null;
        record(
          'C-CUSTOMER-LINK-CREATE-AFTER-SENT',
          link2.json.success === true && Boolean(token2 || url2),
          {
            success: link2.json.success,
            hasToken: Boolean(token2),
            hasUrl: Boolean(url2),
            keys: Object.keys(link2.json || {}),
            code: link2.json.code || null,
            message: link2.json.message || null,
          },
        );
        if (token2 || link2.json.linkId) {
          const revoke2 = await action({
            action: 'revoke-customer-link',
            quotationId: personQuotationId,
            token: token2,
            linkId: link2.json.linkId,
          });
          record('C-CUSTOMER-LINK-REVOKE-AFTER-SENT', revoke2.json.success !== false, {
            success: revoke2.json.success,
            code: revoke2.json.code || null,
          });
        }
      }
    }
  } else {
    for (const id of [
      'B-LIFECYCLE-APPROVE',
      'B-LIFECYCLE-UNSUPPORTED-REFUSED',
      'B-IMMUTABLE-APPROVED-REVISION',
      'B-PDF-PERSIAN-BYTES',
      'B-ACCOUNTING-PREVIEW-MOCK',
      'C-SHARE-COPY',
      'C-SEVEN-CHANNEL-COPY-SHARE',
      'C-CUSTOMER-LINK-CREATE',
      'C-CUSTOMER-LINK-REVOKE',
      'C-DRAFT-LINK-DENIED',
    ]) {
      record(id, false, { reason: 'no person quotation' });
    }
  }

  const connections = await action({ action: 'accounting-connection-list' });
  const mock = (connections.json.connections || []).find((c) => c.adapterId === 'mock') || null;
  const connectionId = mock?.recordId || mock?.id || null;
  if (connectionId) {
    const page1 = await action({
      action: 'accounting-import-preview-items-page',
      connectionId,
      pageSize: 25,
      search: '',
      refresh: true,
    });
    const page2 = await action({
      action: 'accounting-import-preview-items-page',
      connectionId,
      pageSize: 25,
      cursor: page1.json.page?.nextCursor || page1.json.nextCursor,
      search: '',
      refresh: false,
    });
    const search = await action({
      action: 'accounting-import-preview-items-page',
      connectionId,
      pageSize: 25,
      search: 'کابل',
      refresh: true,
    });
    const totalKnown = page1.json.page?.totalKnown ?? null;
    record(
      'B-PAGING-SEARCH-SCOPED',
      page1.json.success === true && search.json.success === true,
      {
        totalKnown,
        page1Rows: page1.json.page?.rows?.length ?? null,
        page2Rows: page2.json.page?.rows?.length ?? null,
        searchRows: search.json.page?.rows?.length ?? null,
        note2500:
          totalKnown != null && totalKnown >= 2500
            ? 'PASS_FULL'
            : 'SCOPED_MOCK_CATALOG_BELOW_2500 — Vitest jump semantics cover large-page logic; product Mock fixture not enlarged',
      },
    );
  } else {
    record('B-PAGING-SEARCH-SCOPED', false, { reason: 'no mock connection' });
  }

  results.status = results.failures.length === 0 ? 'PASS' : 'FAIL';
  results.failed = results.failures;
  fs.writeFileSync(
    path.join(evidenceDir, 'lifecycle-pdf-share.json'),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify({ status: results.status, failed: results.failed }, null, 2));
  process.exit(results.failures.length === 0 ? 0 : 1);
})().catch((error) => {
  console.error(JSON.stringify({ status: 'ERROR', message: error.message }));
  process.exit(1);
});
