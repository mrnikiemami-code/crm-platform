const fs = require('node:fs');
const path = require('node:path');

const config = JSON.parse(
  fs.readFileSync(
    path.join(process.env.USERPROFILE, '.twenty', 'config.json'),
    'utf8',
  ),
);
const remote = config.remotes['dev-crm129'];

fetch(`${remote.apiUrl}/graphql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${remote.apiKey}`,
  },
  body: JSON.stringify({
    query: `{
      quotation(filter: { id: { eq: "1a8bab82-3df6-4377-8e5e-99ba41ba478b" } }) {
        id name status totalExact
      }
      quotationLines(filter: { quotationId: { eq: "1a8bab82-3df6-4377-8e5e-99ba41ba478b" } }) {
        edges { node { name kind totalExact } }
      }
      catalogItem(filter: { id: { eq: "5ec788f5-aa41-41d7-842b-30e888b22dc8" } }) {
        id name sku
      }
    }`,
  }),
})
  .then((response) => response.json())
  .then((json) => {
    console.log(JSON.stringify(json, null, 2));
  });
