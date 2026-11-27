const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const fresh = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fresh-workspace.json'), 'utf8'),
);
const apiBase = String(config.remotes['dev-crm129'].apiUrl).replace(/\/$/, '');
const registrationId =
  config.remotes['dev-crm129'].appRegistrationId ??
  '38c3d2ab-a920-483f-8094-d8078e1fa009';

const pilotToken = spawnSync(
  process.execPath,
  [path.join(__dirname, 'pilot-token.cjs')],
  { encoding: 'utf8' },
).stdout.trim();
if (!pilotToken) {
  console.error('pilot token empty');
  process.exit(1);
}

(async () => {
  const response = await fetch(`${apiBase}/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pilotToken}`,
    },
    body: JSON.stringify({
      query: `mutation($applicationRegistrationId:String!,$targetWorkspaceSubdomain:String!){
        transferApplicationRegistrationOwnership(
          applicationRegistrationId:$applicationRegistrationId
          targetWorkspaceSubdomain:$targetWorkspaceSubdomain
        ) { id ownerWorkspaceId universalIdentifier }
      }`,
      variables: {
        applicationRegistrationId: registrationId,
        targetWorkspaceSubdomain: fresh.subdomain,
      },
    }),
  });
  const payload = await response.json();
  const out = {
    registrationId,
    targetSubdomain: fresh.subdomain,
    errors: payload.errors?.map((e) => e.message) ?? null,
    data: payload.data?.transferApplicationRegistrationOwnership ?? null,
  };
  fs.writeFileSync(
    path.join(__dirname, 'transfer-registration.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
