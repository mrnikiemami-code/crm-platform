const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const token = spawnSync(
  process.execPath,
  [path.join(__dirname, 'pilot-token.cjs')],
  { encoding: 'utf8' },
).stdout.trim();

(async () => {
  const response = await fetch('http://localhost:3002/metadata', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `{
        currentWorkspace { id displayName }
        applications {
          edges {
            node {
              name
              version
              universalIdentifier
              canBeUninstalled
            }
          }
        }
      }`,
    }),
  });
  const payload = await response.json();
  const apps =
    payload.data?.applications?.edges?.map((e) => e.node) ??
    payload.data?.applications ??
    null;
  const quotation = Array.isArray(apps)
    ? apps.find(
        (a) =>
          a.universalIdentifier === 'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb' ||
          a.name === 'پیش‌فاکتور' ||
          String(a.name ?? '').toLowerCase().includes('quotation'),
      )
    : null;
  const out = {
    errors: payload.errors?.map((e) => e.message) ?? null,
    workspace: payload.data?.currentWorkspace ?? null,
    quotation,
    versionOk: quotation?.version === '0.1.85',
  };
  fs.writeFileSync(
    path.join(__dirname, 'installed-version.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
