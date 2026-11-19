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

  let bothCount = 0;
  let singleCount = 0;
  let noneCount = 0;

  for (let i = 0; i < 20; i++) {
    const stamp = `${Date.now()}-${i}`;
    const created = await gql(`mutation {
      createQuotation(data: {
        name: "S2R4-burst-${stamp}"
        status: DRAFT
        customerType: PERSON
        personId: "${personId}"
        currencyCode: "IRR"
        totalExact: "1.000000"
        version: 1
      }) { id version }
    }`);
    if (!created.data?.createQuotation?.id) {
      console.error('create-failed', JSON.stringify(created));
      process.exit(1);
    }
    const id = created.data.createQuotation.id;
    const version = created.data.createQuotation.version;
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        gql(`mutation {
          updateQuotation(id: "${id}", data: { name: "burst-${stamp}-${index}", version: ${version} }) {
            id name version
          }
        }`),
      ),
    );
    const successes = results.filter((result) => !!result.data?.updateQuotation);
    if (successes.length >= 2) {
      bothCount += 1;
      console.log(
        'race-hit',
        JSON.stringify(successes.map((row) => row.data.updateQuotation)),
      );
    } else if (successes.length === 1) singleCount += 1;
    else noneCount += 1;
  }

  console.log(
    JSON.stringify({ bothCount, singleCount, noneCount, trials: 25 }, null, 2),
  );
  if (bothCount > 0) console.log('RACE_CONFIRMED_BOTH_SUCCEEDED');
  else console.log('RACE_NOT_REPRODUCED_IN_BURST');
})();
