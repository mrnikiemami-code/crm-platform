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
  const json = await response.json();

  return json;
};

const assertOk = (label, result) => {
  if (result.errors?.length) {
    console.error(label, 'FAILED', JSON.stringify(result.errors, null, 2));
    process.exit(1);
  }

  console.log(label, 'OK', JSON.stringify(result.data));
};

const main = async () => {
  const people = await gql(
    `{ people(first: 1) { edges { node { id } } } }`,
  );
  assertOk('people', people);
  const personId = people.data.people.edges[0]?.node?.id;

  if (!personId) {
    console.error('No person seed available');
    process.exit(1);
  }

  const search = await gql(
    `{ catalogItems(filter: { name: { ilike: "%S2R1%" } }, first: 10) { edges { node { id name kind sku } } } }`,
  );
  assertOk('catalog-search', search);

  const updateCatalog = await gql(
    `mutation { updateCatalogItem(id: "${search.data.catalogItems.edges[0].node.id}", data: { unit: "عدد" }) { id unit } }`,
  );
  assertOk('catalog-update', updateCatalog);

  const createPersonQuote = await gql(
    `mutation { createQuotation(data: {
      name: "PF-S2R1-person"
      status: DRAFT
      customerType: PERSON
      personId: "${personId}"
      currencyCode: "IRR"
      taxPolicy: "IR_VAT_9"
      paymentTerms: "نقد"
      totalExact: "20710000.000000"
      version: 1
    }) { id status version totalExact personId } }`,
  );
  assertOk('create-quotation-person', createPersonQuote);
  const quotationId = createPersonQuote.data.createQuotation.id;

  const lineProduct = await gql(
    `mutation { createQuotationLine(data: {
      name: "کالا"
      kind: PRODUCT
      unit: "عدد"
      quantityExact: "1.000000"
      unitPriceExact: "10000000.000000"
      discountExact: "1000000.000000"
      taxExact: "810000.000000"
      totalExact: "9810000.000000"
      sortOrder: 0
      quotationId: "${quotationId}"
    }) { id kind totalExact } }`,
  );
  assertOk('line-product', lineProduct);

  const lineService = await gql(
    `mutation { createQuotationLine(data: {
      name: "خدمت"
      kind: SERVICE
      unit: "ساعت"
      quantityExact: "2.000000"
      unitPriceExact: "5000000.000000"
      discountExact: "0.000000"
      taxExact: "900000.000000"
      totalExact: "10900000.000000"
      sortOrder: 1
      quotationId: "${quotationId}"
    }) { id kind totalExact } }`,
  );
  assertOk('line-service', lineService);

  const reopen = await gql(
    `query {
      quotation(filter: { id: { eq: "${quotationId}" } }) {
        id name status totalExact version personId
      }
      quotationLines(filter: { quotationId: { eq: "${quotationId}" } }) {
        edges { node { id name kind discountExact taxExact totalExact } }
      }
    }`,
  );
  assertOk('reopen-draft', reopen);

  const lines = reopen.data.quotationLines.edges.map((edge) => edge.node);
  const sum = lines.reduce((acc, line) => acc + Number(line.totalExact), 0);

  console.log('line-sum', sum, 'expected', 20710000);

  const markSent = await gql(
    `mutation { updateQuotation(id: "${quotationId}", data: { status: SENT }) { id status } }`,
  );
  assertOk('mark-sent', markSent);

  // Domain gate is in persist service; GraphQL itself may still allow update.
  // Record both platform behavior and our route-level immutability.
  const tryEditSent = await gql(
    `mutation { updateQuotation(id: "${quotationId}", data: { name: "mutated-after-sent" }) { id name status } }`,
  );
  console.log(
    'platform-edit-sent',
    tryEditSent.errors ? 'REJECTED' : 'ALLOWED',
    JSON.stringify(tryEditSent.data ?? tryEditSent.errors),
  );

  // Create company for company-customer path if none exists
  let companyId = (
    await gql(`{ companies(first: 1) { edges { node { id } } } }`)
  ).data.companies.edges[0]?.node?.id;

  if (!companyId) {
    const createdCompany = await gql(
      `mutation { createCompany(data: { name: "شرکت آزمایشی S2R1" }) { id name } }`,
    );
    assertOk('create-company', createdCompany);
    companyId = createdCompany.data.createCompany.id;
  }

  const companyQuote = await gql(
    `mutation { createQuotation(data: {
      name: "PF-S2R1-company"
      status: DRAFT
      customerType: COMPANY
      companyId: "${companyId}"
      currencyCode: "IRR"
      taxPolicy: "IR_VAT_9"
      paymentTerms: "۳۰ روز"
      totalExact: "10900000.000000"
      version: 1
    }) { id customerType companyId status } }`,
  );
  assertOk('create-quotation-company', companyQuote);

  console.log('EXERCISE_PASS');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
