const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, 'fresh-workspace.json');
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const apiBase = state.apiBase;
const token = state.accessToken;

const meta = async (query, variables) => {
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
  const roles = await meta(`query { getRoles { id label canUpdateAllSettings canBeAssignedToApiKeys } }`);
  // try alternate field names
  const rolesAlt =
    roles.errors
      ? await meta(`query { roles { edges { node { id label } } } }`)
      : roles;
  state.steps.rolesProbe = {
    rolesErrors: roles.errors?.map((e) => e.message) ?? null,
    rolesAltErrors: rolesAlt.errors?.map((e) => e.message) ?? null,
    rolesData: roles.data ?? rolesAlt.data ?? null,
  };

  let roleList =
    roles.data?.getRoles ??
    roles.data?.roles ??
    rolesAlt.data?.roles?.edges?.map((e) => e.node) ??
    [];
  if (!Array.isArray(roleList)) roleList = [];

  const adminRole =
    roleList.find((r) => r.canUpdateAllSettings) ??
    roleList.find((r) => /admin|مدیر|Admin/i.test(r.label ?? '')) ??
    roleList[0];

  state.steps.selectedRole = adminRole ?? null;
  if (!adminRole?.id) {
    fs.writeFileSync(file, JSON.stringify(state, null, 2));
    console.log(JSON.stringify(state.steps, null, 2));
    process.exit(1);
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const created = await meta(
    `mutation($input:CreateApiKeyInput!){ createApiKey(input:$input){ id name } }`,
    {
      input: {
        name: `083-${state.stamp}`,
        expiresAt,
        roleId: adminRole.id,
      },
    },
  );
  state.steps.createApiKey = {
    errors: created.errors?.map((e) => e.message) ?? null,
    id: created.data?.createApiKey?.id ?? null,
  };

  if (created.data?.createApiKey?.id) {
    for (const mutation of [
      `mutation($apiKeyId:UUID!,$expiresAt:DateTime){ generateApiKeyToken(apiKeyId:$apiKeyId, expiresAt:$expiresAt){ token } }`,
      `mutation($apiKeyId:String!,$expiresAt:DateTime!){ generateApiKeyToken(apiKeyId:$apiKeyId, expiresAt:$expiresAt){ token } }`,
    ]) {
      const minted = await meta(mutation, {
        apiKeyId: created.data.createApiKey.id,
        expiresAt,
      });
      state.steps.mintAttempt = {
        errors: minted.errors?.map((e) => e.message) ?? null,
        dataKeys: minted.data ? Object.keys(minted.data) : null,
      };
      const apiToken =
        minted.data?.generateApiKeyToken?.token ??
        minted.data?.createApiKeyToken?.token ??
        null;
      if (apiToken) {
        state.apiKeyToken = apiToken;
        break;
      }
    }
  }

  fs.writeFileSync(file, JSON.stringify(state, null, 2));
  console.log(
    JSON.stringify(
      {
        role: adminRole,
        apiKeyId: state.steps.createApiKey?.id,
        hasApiKeyToken: Boolean(state.apiKeyToken),
        steps: {
          rolesProbe: state.steps.rolesProbe,
          createApiKey: state.steps.createApiKey,
          mintAttempt: state.steps.mintAttempt,
        },
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
