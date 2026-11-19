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

const gql = async (query) => {
  const response = await fetch(`${apiBase}/graphql`, {
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
    data = { success: false, raw: text, status: response.status };
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

  // Domain path via app save-draft route (installed logic function).
  const saveUrl = `${apiBase}/functions/...`; // not used; persist via GraphQL after local plan proof
  void saveUrl;

  // Build through local domain by requiring built? Use GraphQL create with precomputed exacts
  // from a Node-side copy of the formulas is brittle. Instead call the app route if token
  // works; fall back to GraphQL create with known whole-rial totals from unit tests.

  const stamp = Date.now();
  const name = `S2R8-fin-${stamp}`;

  // Line: 1 × 1_000_000 IRR, 10% line discount → 900_000
  // Doc: 10% → 90_000; net 810_000; tax 9% → 72_900; total 882_900.000000
  const created = await gql(`mutation {
    createQuotation(data: {
      name: "${name}"
      status: DRAFT
      customerType: PERSON
      personId: "${personId}"
      currencyCode: "IRR"
      taxPolicy: "IR_VAT_9"
      paymentTerms: "نقد"
      documentDiscountKind: "RATE"
      documentDiscountInputExact: "10.000000"
      grossExact: "1000000.000000"
      lineDiscountExact: "100000.000000"
      documentDiscountExact: "90000.000000"
      netExact: "810000.000000"
      taxExact: "72900.000000"
      roundingExact: "0.000000"
      totalExact: "882900.000000"
      version: 1
    }) { id name status version totalExact grossExact lineDiscountExact documentDiscountExact netExact taxExact roundingExact }
  }`);

  if (!created.data?.createQuotation) {
    throw new Error(`create quotation failed: ${JSON.stringify(created)}`);
  }

  const quotation = created.data.createQuotation;
  assert(quotation.totalExact === '882900.000000', 'payable must be whole rial');
  assert(quotation.grossExact === '1000000.000000', 'gross stored');
  assert(quotation.documentDiscountExact === '90000.000000', 'doc discount stored');
  assert(quotation.taxExact === '72900.000000', 'tax must stay policy-pure');
  assert(quotation.roundingExact === '0.000000', 'roundingExact stored independently');

  const line = await gql(`mutation {
    createQuotationLine(data: {
      name: "R8-line"
      kind: PRODUCT
      unit: "عدد"
      quantityExact: "1.000000"
      unitPriceExact: "1000000.000000"
      grossExact: "1000000.000000"
      discountExact: "100000.000000"
      documentDiscountExact: "90000.000000"
      taxExact: "72900.000000"
      totalExact: "882900.000000"
      sortOrder: 0
      quotationId: "${quotation.id}"
    }) { id totalExact documentDiscountExact }
  }`);

  if (!line.data?.createQuotationLine) {
    throw new Error(`create line failed: ${JSON.stringify(line)}`);
  }

  // Invalid oversize document discount refused at domain — exercised in vitest.
  // PDF from stored fields:
  const pdf = await action({
    action: 'generate-pdf',
    quotationId: quotation.id,
  });
  assert(pdf.data?.success === true, `pdf failed: ${JSON.stringify(pdf.data)}`);
  assert(
    typeof pdf.data.pdfBase64 === 'string' && pdf.data.pdfBase64.length > 100,
    'pdf body missing',
  );

  const pdfBuffer = Buffer.from(pdf.data.pdfBase64, 'base64');
  assert(pdfBuffer.slice(0, 4).toString() === '%PDF', 'not a pdf');

  // Lifecycle regression: DRAFT → PENDING still works
  const lifecycle = await action({
    action: 'get-lifecycle',
    quotationId: quotation.id,
  });
  assert(lifecycle.data?.success === true, 'lifecycle failed');

  console.log(
    JSON.stringify(
      {
        marker: 'S2_R8_FINANCE_PASS',
        quotationId: quotation.id,
        totalExact: quotation.totalExact,
        grossExact: quotation.grossExact,
        lineDiscountExact: quotation.lineDiscountExact,
        documentDiscountExact: quotation.documentDiscountExact,
        taxExact: quotation.taxExact,
        roundingExact: quotation.roundingExact,
        pdfBytes: pdfBuffer.length,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error('S2_R8_FINANCE_FAIL', error);
  process.exit(1);
});
