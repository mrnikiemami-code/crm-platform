const fixtureEmail = process.env.CRM129_FIXTURE_EMAIL;
const fixturePassword = process.env.CRM129_FIXTURE_PASSWORD;
if (!fixtureEmail || !fixturePassword) throw new Error('Fixture credentials are required');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const apiBase = String(config.remotes['dev-crm129'].apiUrl).replace(/\/$/, '');

const meta = async (query, variables) => {
  const response = await fetch(`${apiBase}/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
};

(async () => {
  const signIn = await meta(
    `mutation($email:String!,$password:String!){
      signIn(email:$email,password:$password){
        availableWorkspaces{
          availableWorkspacesForSignIn{ id loginToken workspaceUrls { subdomainUrl customUrl } }
        }
      }
    }`,
    { email: fixtureEmail, password: fixturePassword },
  );
  const workspace =
    signIn.data?.signIn?.availableWorkspaces?.availableWorkspacesForSignIn?.find(
      (row) => row.id === 'afc7afb6-94ef-4142-872b-52a81b3e91dd',
    ) ??
    signIn.data?.signIn?.availableWorkspaces?.availableWorkspacesForSignIn?.[0];
  if (!workspace?.loginToken) {
    console.error(JSON.stringify(signIn, null, 2));
    process.exit(1);
  }
  const origins = [
    workspace.workspaceUrls?.subdomainUrl?.replace(/\/$/, ''),
    workspace.workspaceUrls?.customUrl?.replace(/\/$/, ''),
    'http://localhost:3002',
  ].filter(Boolean);
  for (const origin of origins) {
    const exchanged = await meta(
      `mutation($loginToken:String!,$origin:String!){
        getAuthTokensFromLoginToken(loginToken:$loginToken,origin:$origin){
          tokens{ accessOrWorkspaceAgnosticToken{ token } }
        }
      }`,
      { loginToken: workspace.loginToken, origin },
    );
    const token =
      exchanged.data?.getAuthTokensFromLoginToken?.tokens
        ?.accessOrWorkspaceAgnosticToken?.token ?? null;
    if (token) {
      process.stdout.write(token);
      return;
    }
  }
  console.error('Failed to exchange pilot token');
  process.exit(1);
})();
