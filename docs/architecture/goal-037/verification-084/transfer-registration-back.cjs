const fs = require('node:fs');
const path = require('node:path');

const fresh = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fresh-workspace.json'), 'utf8'),
);
const registrationId = '38c3d2ab-a920-483f-8094-d8078e1fa009';

(async () => {
  const response = await fetch(`${fresh.apiBase}/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${fresh.accessToken}`,
    },
    body: JSON.stringify({
      query: `mutation($applicationRegistrationId:String!,$targetWorkspaceSubdomain:String!){
        transferApplicationRegistrationOwnership(
          applicationRegistrationId:$applicationRegistrationId
          targetWorkspaceSubdomain:$targetWorkspaceSubdomain
        ) { id ownerWorkspaceId }
      }`,
      variables: {
        applicationRegistrationId: registrationId,
        targetWorkspaceSubdomain: 'glorious-aqua-whale',
      },
    }),
  });
  const payload = await response.json();
  const out = {
    errors: payload.errors?.map((e) => e.message) ?? null,
    data: payload.data?.transferApplicationRegistrationOwnership ?? null,
  };
  fs.writeFileSync(
    path.join(__dirname, 'transfer-registration-back.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
