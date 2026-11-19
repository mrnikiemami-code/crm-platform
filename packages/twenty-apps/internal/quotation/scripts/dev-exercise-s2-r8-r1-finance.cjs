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

  const stamp = Date.now();
  const name = `S2R8R1-fin-${stamp}`;

  // Tiny payable with zero tax: net 1.499999 IRR → rounds DOWN to 1.000000
  // taxExact stays 0; roundingExact = -0.499999; totalExact = 1.000000
  const created = await gql(`mutation {
    createQuotation(data: {
      name: "${name}"
      status: DRAFT
      customerType: PERSON
      personId: "${personId}"
      currencyCode: "IRR"
      taxPolicy: "IR_VAT_9"
      paymentTerms: "نقد"
      documentDiscountKind: "NONE"
      documentDiscountInputExact: "0.000000"
      grossExact: "1.499999"
      lineDiscountExact: "0.000000"
      documentDiscountExact: "0.000000"
      netExact: "1.499999"
      taxExact: "0.000000"
      roundingExact: "-0.499999"
      totalExact: "1.000000"
      version: 1
    }) { id name status version totalExact netExact taxExact roundingExact }
  }`);

  if (!created.data?.createQuotation) {
    throw new Error(`create quotation failed: ${JSON.stringify(created)}`);
  }

  const quotation = created.data.createQuotation;
  assert(quotation.taxExact === '0.000000', 'tax must remain policy-pure zero');
  assert(quotation.roundingExact === '-0.499999', 'negative roundingExact stored');
  assert(quotation.totalExact === '1.000000', 'payable whole rial');

  const line = await gql(`mutation {
    createQuotationLine(data: {
      name: "R8R1-line"
      kind: PRODUCT
      unit: "عدد"
      quantityExact: "1.000000"
      unitPriceExact: "1.499999"
      grossExact: "1.499999"
      discountExact: "0.000000"
      documentDiscountExact: "0.000000"
      taxExact: "0.000000"
      totalExact: "1.499999"
      sortOrder: 0
      quotationId: "${quotation.id}"
    }) { id totalExact taxExact }
  }`);

  if (!line.data?.createQuotationLine) {
    throw new Error(`create line failed: ${JSON.stringify(line)}`);
  }

  const reread = await gql(`{
    quotation(filter: { id: { eq: "${quotation.id}" } }) {
      id totalExact taxExact roundingExact netExact status version
    }
  }`);

  const again = reread.data?.quotation;
  assert(again?.roundingExact === '-0.499999', 'reread roundingExact');
  assert(again?.taxExact === '0.000000', 'reread taxExact pure');
  assert(again?.totalExact === '1.000000', 'reread totalExact');

  const linesReread = await gql(`{
    quotationLines(filter: { quotationId: { eq: "${quotation.id}" } }, first: 10) {
      edges { node { totalExact taxExact } }
    }
  }`);
  const storedLine = linesReread.data?.quotationLines?.edges?.[0]?.node;
  assert(storedLine?.totalExact === '1.499999', 'line total stored pre-rounding');
  assert(storedLine?.taxExact === '0.000000', 'line tax remains pure');

  const pdf = await action({
    action: 'generate-pdf',
    quotationId: quotation.id,
  });
  assert(pdf.data?.success === true, `pdf failed: ${JSON.stringify(pdf.data)}`);
  const pdfBuffer = Buffer.from(pdf.data.pdfBase64, 'base64');
  assert(pdfBuffer.slice(0, 4).toString() === '%PDF', 'not a pdf');

  let version = again.version;
  let finalStatus = again.status;
  for (const toStatus of [
    'PENDING_INTERNAL_APPROVAL',
    'READY_TO_SEND',
    'SENT',
  ]) {
    const step = await action({
      action: 'transition',
      quotationId: quotation.id,
      toStatus,
      version,
    });
    assert(
      step.data?.success === true,
      `${toStatus} failed: ${JSON.stringify(step.data)}`,
    );
    version = step.data.version;
    finalStatus = step.data.status;
  }

  assert(finalStatus === 'SENT', `must reach SENT, got ${finalStatus}`);

  // Content lock: SENT forbids line/header rewrite via draft persist path.
  // Direct GraphQL name change is also blocked by immutability hook when present.
  const editAttempt = await gql(`mutation {
    updateQuotation(
      id: "${quotation.id}"
      data: { totalExact: "999.000000" }
    ) { id totalExact }
  }`);
  assert(
    !editAttempt.data?.updateQuotation ||
      editAttempt.data.updateQuotation.totalExact === '1.000000',
    'SENT quotation must not accept financial rewrite',
  );

  console.log(
    JSON.stringify(
      {
        marker: 'S2_R8_R1_FINANCE_PASS',
        quotationId: quotation.id,
        taxExact: again.taxExact,
        roundingExact: again.roundingExact,
        totalExact: again.totalExact,
        status: finalStatus,
        pdfBytes: pdfBuffer.length,
        editBlocked: !editAttempt.data?.updateQuotation,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error('S2_R8_R1_FINANCE_FAIL', error);
  process.exit(1);
});
