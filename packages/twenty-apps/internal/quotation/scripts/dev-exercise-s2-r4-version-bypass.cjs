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
  process.exit(2);
}
const endpoint = `${remote.apiUrl.replace(/\/$/, '')}/graphql`;
const gql = async (query) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${remote.apiKey}`,
    },
    body: JSON.stringify({ query }),
  });
  return response.json();
};

(async () => {
  const personId = (
    await gql(`{ people(first: 1) { edges { node { id } } } }`)
  ).data.people.edges[0].node.id;
  const created = await gql(`mutation {
    createQuotation(data: {
      name: "S2R4-bypass"
      status: DRAFT
      customerType: PERSON
      personId: "${personId}"
      currencyCode: "IRR"
      totalExact: "1.000000"
      version: 1
    }) { id version }
  }`);
  const id = created.data.createQuotation.id;

  const noVersion = await gql(`mutation {
    updateQuotation(id: "${id}", data: { name: "no-version" }) { id name version }
  }`);
  const badVersion = await gql(`mutation {
    updateQuotation(id: "${id}", data: { name: "bad-version", version: 999 }) { id name version }
  }`);
  const stringy = await gql(`mutation {
    updateQuotation(id: "${id}", data: { status: PENDING_INTERNAL_APPROVAL }) { id status version }
  }`);

  console.log(
    JSON.stringify(
      {
        noVersionErrors: noVersion.errors?.map((error) => error.message),
        badVersionErrors: badVersion.errors?.map((error) => error.message),
        statusWithoutVersionErrors: stringy.errors?.map((error) => error.message),
        noVersionData: noVersion.data,
        badVersionData: badVersion.data,
        statusWithoutVersionData: stringy.data,
      },
      null,
      2,
    ),
  );
})();
