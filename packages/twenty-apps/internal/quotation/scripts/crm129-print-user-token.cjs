// Prints a real workspace access token for a Dev user, for scripts that take --token.
// Usage: node scripts/crm129-print-user-token.cjs pilot.b@local.test PilotPass123!
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const apiBase = String(config.remotes['dev-crm129'].apiUrl).replace(/\/$/, '');
const email = process.argv[2];
const password = process.argv[3];

const gql = async (query, variables) => {
  const response = await fetch(`${apiBase}/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return (await response.json()).data;
};

(async () => {
  const signIn = await gql(
    `mutation($email:String!,$password:String!){signIn(email:$email,password:$password){availableWorkspaces{availableWorkspacesForSignIn{loginToken}}}}`,
    { email, password },
  );
  const loginToken =
    signIn?.signIn?.availableWorkspaces?.availableWorkspacesForSignIn?.[0]?.loginToken;
  const exchange = await gql(
    `mutation($loginToken:String!,$origin:String!){getAuthTokensFromLoginToken(loginToken:$loginToken,origin:$origin){tokens{accessOrWorkspaceAgnosticToken{token}}}}`,
    { loginToken, origin: 'http://localhost:3002' },
  );
  process.stdout.write(
    exchange?.getAuthTokensFromLoginToken?.tokens?.accessOrWorkspaceAgnosticToken?.token ?? '',
  );
})();
