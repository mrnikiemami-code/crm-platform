const fs = require('node:fs');
const path = require('node:path');

const config = JSON.parse(
  fs.readFileSync(
    path.join(process.env.USERPROFILE, '.twenty', 'config.json'),
    'utf8',
  ),
);
const remote = config.remotes['dev-crm129'];
if (!remote?.apiUrl || String(remote.apiUrl).includes('6080')) process.exit(2);
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
  let both = 0;
  let single = 0;
  for (let i = 0; i < 6; i++) {
    const created = await gql(`mutation {
      createQuotation(data: {
        name: "S2R4-check-${Date.now()}-${i}"
        status: DRAFT
        customerType: PERSON
        personId: "${personId}"
        currencyCode: "IRR"
        totalExact: "1.000000"
        version: 1
      }) { id version }
    }`);
    if (!created.data?.createQuotation) {
      console.error(created);
      process.exit(1);
    }
    const { id, version } = created.data.createQuotation;
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        gql(`mutation {
          updateQuotation(id: "${id}", data: { name: "c-${i}-${index}", version: ${version} }) {
            id name version
          }
        }`),
      ),
    );
    const wins = results.filter((result) => !!result.data?.updateQuotation);
    if (wins.length >= 2) {
      both += 1;
      console.log('BOTH', wins.map((row) => row.data.updateQuotation));
    } else if (wins.length === 1) single += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  console.log(JSON.stringify({ both, single, trials: 6 }));
  console.log(both === 0 && single === 6 ? 'RACE_FIXED' : 'RACE_STILL_OPEN');
  process.exit(both === 0 && single === 6 ? 0 : 1);
})();
