const fs = require('node:fs');
const path = require('node:path');

const fresh = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fresh-workspace.json'), 'utf8'),
);
const token = fresh.apiKeyToken || fresh.accessToken;

(async () => {
  const r = await fetch(`${fresh.apiBase}/metadata`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `{
        __type(name: "ObjectFilter") { inputFields { name type { name kind ofType { name } } } }
        __type(name: "Object") { fields { name } }
      }`,
    }),
  });
  console.log(JSON.stringify(await r.json(), null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
