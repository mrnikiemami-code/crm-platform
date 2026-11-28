// Verification harness only: create an isolated Dev workspace for A19 fresh package install.
// Does not touch accepted 084/086 workspaces. Secrets stay local; committed evidence is redacted.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const apiBase = String(config.remotes['dev-crm129'].apiUrl).replace(/\/$/, '');
const stamp = Date.now().toString(36);
const email = `g038090.${stamp}@local.test`;
const password = 'PilotPass123!';
const origin = 'http://localhost:3002';
const subdomain = `g090${stamp}`.replace(/[^a-z0-9]/g, '').slice(0, 20);

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
  const out = { apiBase, email, stamp, subdomain, steps: {} };

  const signUp = await meta(
    `mutation($email:String!,$password:String!){
      signUp(email:$email, password:$password) {
        tokens { accessOrWorkspaceAgnosticToken { token } }
      }
    }`,
    { email, password },
  );
  const userToken =
    signUp.data?.signUp?.tokens?.accessOrWorkspaceAgnosticToken?.token ?? null;
  out.steps.signUp = {
    errors: signUp.errors?.map((e) => e.message) ?? null,
    hasToken: Boolean(userToken),
  };
  if (!userToken) {
    fs.writeFileSync(path.join(__dirname, 'fresh-workspace.local.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  const created = await meta(
    `mutation($input:SignUpInNewWorkspaceInput){
      signUpInNewWorkspace(input:$input) {
        loginToken { token }
        workspace { id workspaceUrls { subdomainUrl customUrl } }
      }
    }`,
    { input: { displayName: `G038-090-FRESH-${stamp}`, subdomain } },
    userToken,
  );
  out.steps.signUpInNewWorkspace = {
    errors: created.errors?.map((e) => e.message) ?? null,
    workspaceId: created.data?.signUpInNewWorkspace?.workspace?.id ?? null,
    urls: created.data?.signUpInNewWorkspace?.workspace?.workspaceUrls ?? null,
  };
  out.workspaceId = out.steps.signUpInNewWorkspace.workspaceId;
  const loginToken = created.data?.signUpInNewWorkspace?.loginToken?.token;
  if (!loginToken) {
    fs.writeFileSync(path.join(__dirname, 'fresh-workspace.local.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  const origins = [
    created.data?.signUpInNewWorkspace?.workspace?.workspaceUrls?.subdomainUrl?.replace(/\/$/, ''),
    created.data?.signUpInNewWorkspace?.workspace?.workspaceUrls?.customUrl?.replace(/\/$/, ''),
    origin,
  ].filter(Boolean);
  out.steps.exchangeAttempts = [];
  for (const tryOrigin of origins) {
    const exchanged = await meta(
      `mutation($loginToken:String!,$origin:String!){
        getAuthTokensFromLoginToken(loginToken:$loginToken, origin:$origin) {
          tokens { accessOrWorkspaceAgnosticToken { token } }
        }
      }`,
      { loginToken, origin: tryOrigin },
    );
    const token =
      exchanged.data?.getAuthTokensFromLoginToken?.tokens
        ?.accessOrWorkspaceAgnosticToken?.token ?? null;
    out.steps.exchangeAttempts.push({
      origin: tryOrigin,
      errors: exchanged.errors?.map((e) => e.message) ?? null,
      hasToken: Boolean(token),
    });
    if (token) {
      out.accessToken = token;
      break;
    }
  }
  out.steps.exchange = {
    hasToken: Boolean(out.accessToken),
    attempts: out.steps.exchangeAttempts.length,
  };

  if (out.accessToken) {
    const me = await meta(
      `query { currentUser { id email } currentWorkspace { id displayName } }`,
      {},
      out.accessToken,
    );
    out.steps.me = {
      errors: me.errors?.map((e) => e.message) ?? null,
      workspace: me.data?.currentWorkspace ?? null,
    };
    if (me.data?.currentWorkspace?.id) out.workspaceId = me.data.currentWorkspace.id;

    const roles = await meta(
      `query { getRoles { id label isEditable canUpdateAllSettings } }`,
      {},
      out.accessToken,
    );
    const roleRows = roles.data?.getRoles ?? roles.data?.roles ?? [];
    const adminRole =
      roleRows.find((r) => r.canUpdateAllSettings) ??
      roleRows.find((r) => /admin|مدیر/i.test(r.label)) ??
      roleRows[0];
    out.steps.roles = {
      errors: roles.errors?.map((e) => e.message) ?? null,
      adminRoleId: adminRole?.id ?? null,
    };

    if (adminRole?.id) {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const apiKey = await meta(
        `mutation($input:CreateApiKeyInput!){ createApiKey(input:$input){ id name } }`,
        { input: { name: `g090-install-${stamp}`, expiresAt, roleId: adminRole.id } },
        out.accessToken,
      );
      out.steps.createApiKey = {
        errors: apiKey.errors?.map((e) => e.message) ?? null,
        id: apiKey.data?.createApiKey?.id ?? null,
      };
      if (apiKey.data?.createApiKey?.id) {
        const tokenMut = await meta(
          `mutation($apiKeyId:UUID!,$expiresAt:DateTime){
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
      }
    }
  }

  fs.writeFileSync(path.join(__dirname, 'fresh-workspace.local.json'), JSON.stringify(out, null, 2));
  const redacted = {
    ...out,
    accessToken: out.accessToken ? '[redacted]' : null,
    apiKeyToken: out.apiKeyToken ? '[redacted]' : null,
  };
  fs.writeFileSync(path.join(__dirname, 'fresh-workspace.json'), JSON.stringify(redacted, null, 2));
  console.log(JSON.stringify(redacted, null, 2));
  process.exit(out.apiKeyToken && out.workspaceId ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
