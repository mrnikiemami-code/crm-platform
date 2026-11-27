// Create a fresh Dev workspace for PARTY_UAT 083 — evidence harness only.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const apiBase = String(config.remotes['dev-crm129'].apiUrl).replace(/\/$/, '');
const stamp = Date.now().toString(36);
const email = `party083.${stamp}@local.test`;
const password = 'PilotPass123!';
const origin = 'http://localhost:3002';
const subdomain = `p083${stamp}`.replace(/[^a-z0-9]/g, '').slice(0, 20);

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
  const out = { apiBase, email, password, stamp, subdomain, steps: {} };

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
    fs.writeFileSync(
      path.join(__dirname, 'fresh-workspace.json'),
      JSON.stringify(out, null, 2),
    );
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
    { input: { displayName: `PARTY-UAT-083-${stamp}`, subdomain } },
    userToken,
  );
  out.steps.signUpInNewWorkspace = {
    errors: created.errors?.map((e) => e.message) ?? null,
    workspaceId: created.data?.signUpInNewWorkspace?.workspace?.id ?? null,
    displayName: created.data?.signUpInNewWorkspace?.workspace?.displayName ?? null,
    urls: created.data?.signUpInNewWorkspace?.workspace?.workspaceUrls ?? null,
  };
  out.workspaceId = out.steps.signUpInNewWorkspace.workspaceId;
  const loginToken = created.data?.signUpInNewWorkspace?.loginToken?.token;

  if (!loginToken) {
    fs.writeFileSync(
      path.join(__dirname, 'fresh-workspace.json'),
      JSON.stringify(out, null, 2),
    );
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  const exchanged = await meta(
    `mutation($loginToken:String!,$origin:String!){
      getAuthTokensFromLoginToken(loginToken:$loginToken, origin:$origin) {
        tokens { accessOrWorkspaceAgnosticToken { token } }
      }
    }`,
    { loginToken, origin },
  );
  out.accessToken =
    exchanged.data?.getAuthTokensFromLoginToken?.tokens
      ?.accessOrWorkspaceAgnosticToken?.token ?? null;
  out.steps.exchange = {
    errors: exchanged.errors?.map((e) => e.message) ?? null,
    hasToken: Boolean(out.accessToken),
  };

  if (out.accessToken) {
    const me = await meta(
      `query { currentUser { id email } currentWorkspace { id displayName } }`,
      {},
      out.accessToken,
    );
    out.steps.me = {
      errors: me.errors?.map((e) => e.message) ?? null,
      user: me.data?.currentUser ?? null,
      workspace: me.data?.currentWorkspace ?? null,
    };
    if (me.data?.currentWorkspace?.id) {
      out.workspaceId = me.data.currentWorkspace.id;
    }

    // Create API key for twenty apply (needs a role id)
    const roles = await meta(
      `query { roles { id label isEditable canUpdateAllSettings } }`,
      {},
      out.accessToken,
    );
    out.steps.roles = {
      errors: roles.errors?.map((e) => e.message) ?? null,
      roles: roles.data?.roles ?? null,
    };
    const adminRole =
      (roles.data?.roles ?? []).find((r) => r.canUpdateAllSettings) ??
      (roles.data?.roles ?? []).find((r) => /admin|مدیر/i.test(r.label)) ??
      (roles.data?.roles ?? [])[0];

    if (adminRole?.id) {
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const apiKey = await meta(
        `mutation($input:CreateApiKeyInput!){
          createApiKey(input:$input){ id name }
        }`,
        {
          input: {
            name: `083-apply-${stamp}`,
            expiresAt,
            roleId: adminRole.id,
          },
        },
        out.accessToken,
      );
      out.steps.createApiKey = {
        errors: apiKey.errors?.map((e) => e.message) ?? null,
        id: apiKey.data?.createApiKey?.id ?? null,
      };

      // Token mint — try generateApiKeyToken if present
      if (apiKey.data?.createApiKey?.id) {
        const tokenMut = await meta(
          `mutation($apiKeyId:UUID!,$expiresAt:DateTime){
            generateApiKeyToken(apiKeyId:$apiKeyId, expiresAt:$expiresAt){ token }
          }`,
          { apiKeyId: apiKey.data.createApiKey.id, expiresAt },
          out.accessToken,
        );
        out.steps.generateApiKeyToken = {
          errors: tokenMut.errors?.map((e) => e.message) ?? null,
          hasToken: Boolean(tokenMut.data?.generateApiKeyToken?.token),
        };
        out.apiKeyToken = tokenMut.data?.generateApiKeyToken?.token ?? null;
      }
    }
  }

  // Persist secrets for follow-on scripts (local evidence only; do not push tokens if policy forbids — strip before commit if needed)
  fs.writeFileSync(
    path.join(__dirname, 'fresh-workspace.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        ...out,
        accessToken: out.accessToken ? '[redacted]' : null,
        apiKeyToken: out.apiKeyToken ? '[redacted]' : null,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
