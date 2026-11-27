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
      query: '{ __type(name: "Query") { fields { name } } }',
    }),
  });
  const j = await r.json();
  const names = (j.data?.__type?.fields || [])
    .map((f) => f.name)
    .filter((n) => /object|field|meta/i.test(n));
  console.log(JSON.stringify({ names, errors: j.errors }, null, 2));

  // Probe common shapes
  const probes = [
    `{ objects { edges { node { nameSingular } } } }`,
    `{ objects(paging:{first:5}) { edges { node { nameSingular fieldsList { name } } } } }`,
    `{ objectMetadataItems { id nameSingular } }`,
    `query { findManyObjectMetadata { id nameSingular } }`,
  ];
  for (const query of probes) {
    const resp = await fetch(`${fresh.apiBase}/metadata`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    const payload = await resp.json();
    console.log(
      JSON.stringify(
        {
          query: query.slice(0, 80),
          errors: payload.errors?.map((e) => e.message).slice(0, 2) ?? null,
          keys: payload.data ? Object.keys(payload.data) : null,
          sample: JSON.stringify(payload.data)?.slice(0, 200) ?? null,
        },
        null,
        2,
      ),
    );
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
