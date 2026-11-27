const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, 'fresh-workspace.json');
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const expiresAt = new Date(Date.now() + 7 * 864e5).toISOString();

(async () => {
  const response = await fetch(`${state.apiBase}/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.accessToken}`,
    },
    body: JSON.stringify({
      query: `mutation($apiKeyId:UUID!,$expiresAt:String!){
        generateApiKeyToken(apiKeyId:$apiKeyId, expiresAt:$expiresAt){ token }
      }`,
      variables: {
        apiKeyId: state.steps.createApiKey.id,
        expiresAt,
      },
    }),
  });
  const payload = await response.json();
  state.steps.generateApiKeyToken = {
    errors: payload.errors?.map((error) => error.message) ?? null,
    hasToken: Boolean(payload.data?.generateApiKeyToken?.token),
  };
  state.apiKeyToken = payload.data?.generateApiKeyToken?.token ?? null;
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
  console.log(JSON.stringify(state.steps.generateApiKeyToken, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
