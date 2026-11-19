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
  console.error('refuse: missing or intranet remote');
  process.exit(2);
}

const apiBase = remote.apiUrl.replace(/\/$/, '');
const endpoint = `${apiBase}/graphql`;
const actionsUrl = `${apiBase}/rest/quotation/actions`;
const token = remote.apiKey;

const gql = async (query) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  return response.json();
};

const action = async (body) => {
  const response = await fetch(actionsUrl, {
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
    data = { success: false, raw: text, status: response.status };
  }
  return { httpStatus: response.status, data };
};

const stamp = Date.now();
const name = `S2R6-ui-${stamp}`;

const main = async () => {
  const personId = (await gql(`{ people(first: 1) { edges { node { id } } } }`))
    .data.people.edges[0].node.id;

  const created = await gql(`mutation {
    createQuotation(data: {
      name: "${name}"
      status: DRAFT
      customerType: PERSON
      personId: "${personId}"
      currencyCode: "IRR"
      paymentTerms: "نقد"
      totalExact: "1234567.000000"
      version: 1
    }) { id name status version quotationNumber }
  }`);

  if (!created.data?.createQuotation) {
    throw new Error(`create failed: ${JSON.stringify(created)}`);
  }

  const quotationId = created.data.createQuotation.id;
  let version = created.data.createQuotation.version;

  const line = await gql(`mutation {
    createQuotationLine(data: {
      name: "کالای نمونه"
      kind: PRODUCT
      description: "شرح فارسی با نیم‌فاصله پیش‌فاکتور"
      unit: "عدد"
      quantityExact: "2.000000"
      unitPriceExact: "500000.000000"
      discountExact: "0.000000"
      taxExact: "90000.000000"
      totalExact: "1090000.000000"
      sortOrder: 1
      quotationId: "${quotationId}"
    }) { id }
  }`);

  if (!line.data?.createQuotationLine) {
    console.warn('line create soft-fail', JSON.stringify(line.errors ?? line));
  }

  // Line hooks claim a parent version bump outside the GraphQL write TX.
  const refreshed = await gql(
    `query { quotation(filter: { id: { eq: "${quotationId}" } }) { id status version } }`,
  );
  version = refreshed.data?.quotation?.version ?? version;

  const lifecycle1 = await action({
    action: 'get-lifecycle',
    quotationId,
  });

  const transitions = [];
  const steps = [
    'PENDING_INTERNAL_APPROVAL',
    'READY_TO_SEND',
    'SENT',
    'CUSTOMER_ACCEPTED',
  ];

  for (const toStatus of steps) {
    const result = await action({
      action: 'transition',
      quotationId,
      toStatus,
      version,
    });
    transitions.push({ toStatus, result });
    if (result.data?.success === true) {
      version = result.data.version;
    } else {
      break;
    }
  }

  const pdf = await action({
    action: 'generate-pdf',
    quotationId,
  });

  const pdfOk =
    pdf.data?.success === true &&
    typeof pdf.data.pdfBase64 === 'string' &&
    pdf.data.pdfBase64.length > 100;

  if (pdfOk) {
    const out = path.join(__dirname, `tmp-s2-r6-${stamp}.pdf`);
    fs.writeFileSync(out, Buffer.from(pdf.data.pdfBase64, 'base64'));
    console.log('PDF_WRITTEN', out, fs.statSync(out).size);
  }

  // Forbidden path: limited role is covered by R4 script; here assert Persian deny
  // when transitioning with stale version.
  const conflict = await action({
    action: 'transition',
    quotationId,
    toStatus: 'CANCELLED',
    version: 1,
  });

  const summary = {
    quotationId,
    lifecycleOk: lifecycle1.data?.success === true,
    actionsEnabled: (lifecycle1.data?.lifecycle?.actions ?? []).filter(
      (row) => row.enabled,
    ).length,
    transitions: transitions.map((row) => ({
      to: row.toStatus,
      ok: row.result.data?.success === true,
      status: row.result.data?.status,
      code: row.result.data?.code,
      message: row.result.data?.message,
    })),
    finalStatus: transitions.at(-1)?.result.data?.status,
    pdfOk,
    pdfBytes: pdfOk ? Buffer.from(pdf.data.pdfBase64, 'base64').length : 0,
    conflictPersian:
      conflict.data?.success === false &&
      typeof conflict.data?.message === 'string' &&
      /نسخه|هم‌زمان|مجوز|نامعتبر/.test(conflict.data.message),
    conflictMessage: conflict.data?.message,
  };

  const pass =
    summary.lifecycleOk &&
    summary.transitions.every((row) => row.ok) &&
    summary.finalStatus === 'CUSTOMER_ACCEPTED' &&
    summary.pdfOk &&
    summary.conflictPersian;

  console.log(pass ? 'S2_R6_UI_PDF_PASS' : 'S2_R6_UI_PDF_FAIL');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(pass ? 0 : 1);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
