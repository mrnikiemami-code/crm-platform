// Verify installed metadata for tokenHash/scopeKey. No credentials logged.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const label = process.argv[2] || 'existing';
const tokenScript = process.argv[3];
const apiBase = process.argv[4] || 'http://localhost:3002';

// Field universal identifiers (index error IDs in recovery prose are separate).
const EXPECTED = {
  quotationCustomerLink: {
    field: 'tokenHash',
    universalIdentifier: '1c16db88-0015-5441-8ee5-599154e7d563',
  },
  quotationSequence: {
    field: 'scopeKey',
    universalIdentifier: '2f19974c-36c1-56ae-a157-15ccd468772f',
  },
};

let token;
if (tokenScript === 'pilot') {
  token = spawnSync(process.execPath, [path.join(__dirname, 'pilot-token.cjs')], {
    encoding: 'utf8',
  }).stdout.trim();
} else if (tokenScript === 'fresh') {
  const fresh = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fresh-workspace.json'), 'utf8'),
  );
  token = fresh.apiKeyToken || fresh.accessToken;
} else {
  token = process.env.ACCESS_TOKEN;
}

const meta = async (query, variables = {}) => {
  const response = await fetch(`${apiBase}/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
};

(async () => {
  const payload = await meta(`{
    objects(paging: { first: 200 }) {
      edges {
        node {
          nameSingular
          fieldsList {
            id
            name
            universalIdentifier
            type
            isUnique
            isNullable
            defaultValue
          }
        }
      }
    }
  }`);

  const objects =
    payload.data?.objects?.edges
      ?.map((e) => e.node)
      ?.filter((o) =>
        ['quotationCustomerLink', 'quotationSequence'].includes(o.nameSingular),
      ) ?? [];

  const fields = {};
  const checks = {};
  for (const object of objects) {
    const expected = EXPECTED[object.nameSingular];
    const field = (object.fieldsList ?? []).find((f) => f.name === expected.field);
    fields[object.nameSingular] = field ?? null;
    checks[object.nameSingular] = field
      ? {
          nameOk: field.name === expected.field,
          typeOk: field.type === 'TEXT',
          uniqueOk: field.isUnique === true,
          nullableOk: field.isNullable === false,
          defaultNullOk: field.defaultValue === null,
          universalIdOk: field.universalIdentifier === expected.universalIdentifier,
          universalIdentifier: field.universalIdentifier,
          id: field.id,
          defaultValue: field.defaultValue,
          type: field.type,
          isUnique: field.isUnique,
          isNullable: field.isNullable,
        }
      : { missing: true };
  }

  const out = {
    label,
    errors: payload.errors?.map((e) => e.message) ?? null,
    objectNames: objects.map((o) => o.nameSingular),
    checks,
    allPass: Object.values(checks).every(
      (c) =>
        c.nameOk &&
        c.typeOk &&
        c.uniqueOk &&
        c.nullableOk &&
        c.defaultNullOk &&
        c.universalIdOk,
    ),
  };
  fs.writeFileSync(
    path.join(__dirname, `metadata-fields-${label}.json`),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
