// Verification harness: sign into previously created G038-090 fresh workspace and mint API key.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const email = process.argv[2];
const subdomain = process.argv[3];
const password = process.env.CRM129_FIXTURE_PASSWORD;
if (!password) throw new Error('CRM129_FIXTURE_PASSWORD is required');
const apiBase = 'http://localhost:3002';
const origin = `http://${subdomain}.localhost:3002`;

const meta = async (query, variables, token) => {
  const response = await fetch(`${apiBase}/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
};

(async () => {
  const out = { email, subdomain, origin, steps: {} };
  const signIn = await meta(
    `mutation($email:String!,$password:String!){
      signIn(email:$email,password:$password){
        availableWorkspaces{
          availableWorkspacesForSignIn{ id loginToken workspaceUrls { subdomainUrl customUrl } }
        }
      }
    }`,
    { email, password },
  );
  const workspaces =
    signIn.data?.signIn?.availableWorkspaces?.availableWorkspacesForSignIn ?? [];
  out.steps.signIn = {
    errors: signIn.errors?.map((e) => e.message) ?? null,
    count: workspaces.length,
    ids: workspaces.map((w) => w.id),
  };
  const workspace =
    workspaces.find((w) =>
      String(w.workspaceUrls?.subdomainUrl ?? '').includes(subdomain),
    ) ?? workspaces[0];
  if (!workspace?.loginToken) {
    fs.writeFileSync(path.join(__dirname, 'fresh-workspace.local.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }
  out.workspaceId = workspace.id;
  const tryOrigins = [
    workspace.workspaceUrls?.subdomainUrl?.replace(/\/$/, ''),
    origin,
    apiBase,
  ].filter(Boolean);
  for (const tryOrigin of tryOrigins) {
    const exchanged = await meta(
      `mutation($loginToken:String!,$origin:String!){
        getAuthTokensFromLoginToken(loginToken:$loginToken,origin:$origin){
          tokens{ accessOrWorkspaceAgnosticToken{ token } }
        }
      }`,
      { loginToken: workspace.loginToken, origin: tryOrigin },
    );
    const token =
      exchanged.data?.getAuthTokensFromLoginToken?.tokens
        ?.accessOrWorkspaceAgnosticToken?.token ?? null;
    if (token) {
      out.accessToken = token;
      out.steps.exchange = { origin: tryOrigin, hasToken: true };
      break;
    }
  }
  if (!out.accessToken) {
    console.log(JSON.stringify({ ...out, accessToken: null }, null, 2));
    process.exit(1);
  }

  const roles = await meta(
    `query { getRoles { id label canUpdateAllSettings } }`,
    {},
    out.accessToken,
  );
  const roleRows = roles.data?.getRoles ?? [];
  const adminRole =
    roleRows.find((r) => r.canUpdateAllSettings) ??
    roleRows.find((r) => /admin|مدیر/i.test(r.label)) ??
    roleRows[0];
  out.steps.roles = {
    errors: roles.errors?.map((e) => e.message) ?? null,
    adminRoleId: adminRole?.id ?? null,
  };
  if (!adminRole?.id) {
    fs.writeFileSync(path.join(__dirname, 'fresh-workspace.local.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify({ ...out, accessToken: '[redacted]' }, null, 2));
    process.exit(1);
  }
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const apiKey = await meta(
    `mutation($input:CreateApiKeyInput!){ createApiKey(input:$input){ id name } }`,
    { input: { name: `g090-install-${Date.now().toString(36)}`, expiresAt, roleId: adminRole.id } },
    out.accessToken,
  );
  out.steps.createApiKey = {
    errors: apiKey.errors?.map((e) => e.message) ?? null,
    id: apiKey.data?.createApiKey?.id ?? null,
  };
  const tokenMut = await meta(
    `mutation($apiKeyId:UUID!,$expiresAt:String!){
      generateApiKeyToken(apiKeyId:$apiKeyId, expiresAt:$expiresAt){ token }
    }`,
    { apiKeyId: apiKey.data.createApiKey.id, expiresAt },
    out.accessToken,
  );
  out.apiKeyToken = tokenMut.data?.generateApiKeyToken?.token ?? null;
  out.steps.generateApiKeyToken = {
    errors: tokenMut.errors?.map((e) => e.message) ?? null,
    hasToken: Boolean(out.apiKeyToken),
  };

  fs.writeFileSync(path.join(__dirname, 'fresh-workspace.local.json'), JSON.stringify(out, null, 2));
  const redacted = { ...out, accessToken: '[redacted]', apiKeyToken: out.apiKeyToken ? '[redacted]' : null };
  fs.writeFileSync(path.join(__dirname, 'fresh-workspace.json'), JSON.stringify(redacted, null, 2));
  console.log(JSON.stringify(redacted, null, 2));
  process.exit(out.apiKeyToken ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
