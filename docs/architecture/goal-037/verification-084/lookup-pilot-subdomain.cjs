const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const apiBase = String(config.remotes['dev-crm129'].apiUrl).replace(/\/$/, '');

(async () => {
  const response = await fetch(`${apiBase}/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation($email:String!,$password:String!){
        signIn(email:$email,password:$password){
          availableWorkspaces{
            availableWorkspacesForSignIn{ id workspaceUrls{ subdomainUrl customUrl } }
          }
        }
      }`,
      variables: { email: 'pilot.a@local.test', password: 'PilotPass123!' },
    }),
  });
  const payload = await response.json();
  console.log(
    JSON.stringify(
      payload.data?.signIn?.availableWorkspaces?.availableWorkspacesForSignIn ??
        payload,
      null,
      2,
    ),
  );
})();
