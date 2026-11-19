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
  console.error('Refusing: remote is not isolated Dev :3002');
  process.exit(2);
}

const token = remote.apiKey;
const endpoint = `${remote.apiUrl.replace(/\/$/, '')}/graphql`;

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

const assert = (label, condition, detail) => {
  if (!condition) {
    console.error('FAIL', label, detail);
    process.exit(1);
  }
  console.log('PASS', label);
};

const main = async () => {
  const personId = (
    await gql(`{ people(first: 1) { edges { node { id } } } }`)
  ).data.people.edges[0].node.id;

  const created = await gql(`mutation {
    createQuotation(data: {
      name: "S2R3-lock"
      status: DRAFT
      customerType: PERSON
      personId: "${personId}"
      currencyCode: "IRR"
      totalExact: "1000.000000"
      version: 1
    }) { id status version }
  }`);
  assert('create-draft', !!created.data?.createQuotation?.id, created);
  const quotationId = created.data.createQuotation.id;
  let version = created.data.createQuotation.version ?? 1;

  const line = await gql(`mutation {
    createQuotationLine(data: {
      name: "line"
      kind: PRODUCT
      unit: "pcs"
      quantityExact: "1.000000"
      unitPriceExact: "1000.000000"
      discountExact: "0.000000"
      taxExact: "0.000000"
      totalExact: "1000.000000"
      sortOrder: 0
      quotationId: "${quotationId}"
    }) { id }
  }`);
  assert('create-line-on-draft', !!line.data?.createQuotationLine?.id, line);
  const lineId = line.data.createQuotationLine.id;

  // Line mutations atomically bump the parent quotation version.
  const afterLine = await gql(
    `query { quotation(filter: { id: { eq: "${quotationId}" } }) { id version } }`,
  );
  version = afterLine.data.quotation.version;

  const pending = await gql(`mutation {
    updateQuotation(id: "${quotationId}", data: { status: PENDING_INTERNAL_APPROVAL, version: ${version} }) { id status version }
  }`);
  assert(
    'transition-pending',
    pending.data?.updateQuotation?.status === 'PENDING_INTERNAL_APPROVAL',
    pending,
  );
  version = pending.data.updateQuotation.version;

  const ready = await gql(`mutation {
    updateQuotation(id: "${quotationId}", data: { status: READY_TO_SEND, version: ${version} }) { id status version }
  }`);
  assert('transition-ready', ready.data?.updateQuotation?.status === 'READY_TO_SEND', ready);
  version = ready.data.updateQuotation.version;

  const sent = await gql(`mutation {
    updateQuotation(id: "${quotationId}", data: { status: SENT, version: ${version} }) { id status version }
  }`);
  assert('transition-sent', sent.data?.updateQuotation?.status === 'SENT', sent);
  version = sent.data.updateQuotation.version;

  const mutateName = await gql(`mutation {
    updateQuotation(id: "${quotationId}", data: { name: "hacked", version: ${version} }) { id name }
  }`);
  assert(
    'sent-content-blocked',
    Array.isArray(mutateName.errors) && mutateName.errors.length > 0,
    mutateName,
  );

  const mutateNoVersion = await gql(`mutation {
    updateQuotation(id: "${quotationId}", data: { name: "hacked-no-version" }) { id name }
  }`);
  assert(
    'sent-content-blocked-without-version',
    Array.isArray(mutateNoVersion.errors) && mutateNoVersion.errors.length > 0,
    mutateNoVersion,
  );

  const other = await gql(`mutation {
    createQuotation(data: {
      name: "S2R3-other"
      status: DRAFT
      customerType: PERSON
      personId: "${personId}"
      currencyCode: "IRR"
      totalExact: "0.000000"
      version: 1
    }) { id }
  }`);
  const otherId = other.data.createQuotation.id;

  const reassign = await gql(`mutation {
    updateQuotationLine(id: "${lineId}", data: { quotationId: "${otherId}" }) { id quotationId }
  }`);
  assert(
    'line-reassign-blocked',
    Array.isArray(reassign.errors) && reassign.errors.length > 0,
    reassign,
  );

  const addLineOnSent = await gql(`mutation {
    createQuotationLine(data: {
      name: "smuggle"
      kind: PRODUCT
      unit: "pcs"
      quantityExact: "1.000000"
      unitPriceExact: "1.000000"
      discountExact: "0.000000"
      taxExact: "0.000000"
      totalExact: "1.000000"
      sortOrder: 9
      quotationId: "${quotationId}"
    }) { id }
  }`);
  assert(
    'line-create-on-sent-blocked',
    Array.isArray(addLineOnSent.errors) && addLineOnSent.errors.length > 0,
    addLineOnSent,
  );

  const accept = await gql(`mutation {
    updateQuotation(id: "${quotationId}", data: { status: CUSTOMER_ACCEPTED, version: ${version} }) { id status version }
  }`);
  assert(
    'legal-accept-allowed',
    accept.data?.updateQuotation?.status === 'CUSTOMER_ACCEPTED',
    accept,
  );

  console.log('S2_R3_LIVE_PASS');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
