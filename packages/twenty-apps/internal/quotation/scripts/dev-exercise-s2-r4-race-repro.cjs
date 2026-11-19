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
      name: "S2R4-race"
      status: DRAFT
      customerType: PERSON
      personId: "${personId}"
      currencyCode: "IRR"
      totalExact: "1.000000"
      version: 1
    }) { id status version }
  }`);
  const id = created.data.createQuotation.id;
  const version = created.data.createQuotation.version;

  const mutationA = `mutation {
    updateQuotation(id: "${id}", data: { name: "winner-A", version: ${version} }) {
      id name version
    }
  }`;
  const mutationB = `mutation {
    updateQuotation(id: "${id}", data: { name: "winner-B", version: ${version} }) {
      id name version
    }
  }`;

  const [a, b] = await Promise.all([gql(mutationA), gql(mutationB)]);
  const okA = !!a.data?.updateQuotation && !a.errors;
  const okB = !!b.data?.updateQuotation && !b.errors;
  const finalRow = await gql(
    `query { quotation(filter: { id: { eq: "${id}" } }) { id name version } }`,
  );

  console.log(
    JSON.stringify(
      {
        id,
        startVersion: version,
        okA,
        okB,
        bothSucceeded: okA && okB,
        a,
        b,
        final: finalRow.data?.quotation,
      },
      null,
      2,
    ),
  );

  if (okA && okB) {
    console.log('RACE_CONFIRMED_BOTH_SUCCEEDED');
  } else {
    console.log('RACE_NOT_REPRODUCED');
  }
})();
