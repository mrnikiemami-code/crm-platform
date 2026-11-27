const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, 'fresh-workspace.json');
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const apiBase = state.apiBase;

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
  const signIn = await meta(
    `mutation($email:String!,$password:String!){
      signIn(email:$email, password:$password) {
        availableWorkspaces {
          availableWorkspacesForSignIn { id loginToken }
        }
      }
    }`,
    { email: state.email, password: state.password },
  );
  const loginToken =
    signIn.data?.signIn?.availableWorkspaces?.availableWorkspacesForSignIn?.[0]
      ?.loginToken ?? null;
  state.steps.signInFresh = {
    errors: signIn.errors?.map((e) => e.message) ?? null,
    loginTokenPresent: Boolean(loginToken),
    workspaceIds:
      signIn.data?.signIn?.availableWorkspaces?.availableWorkspacesForSignIn?.map(
        (w) => w.id,
      ) ?? null,
  };

  const origins = [
    state.steps.signUpInNewWorkspace?.urls?.subdomainUrl?.replace(/\/$/, ''),
    `http://${state.subdomain}.localhost:3002`,
    'http://localhost:3002',
  ].filter(Boolean);

  for (const origin of origins) {
    const exchanged = await meta(
      `mutation($loginToken:String!,$origin:String!){
        getAuthTokensFromLoginToken(loginToken:$loginToken, origin:$origin) {
          tokens { accessOrWorkspaceAgnosticToken { token } }
        }
      }`,
      { loginToken, origin },
    );
    const token =
      exchanged.data?.getAuthTokensFromLoginToken?.tokens
        ?.accessOrWorkspaceAgnosticToken?.token ?? null;
    state.steps[`exchange:${origin}`] = {
      errors: exchanged.errors?.map((e) => e.message) ?? null,
      hasToken: Boolean(token),
    };
    if (token) {
      state.accessToken = token;
      state.origin = origin;
      break;
    }
  }

  if (state.accessToken) {
    const me = await meta(
      `query { currentUser { id email } currentWorkspace { id } }`,
      {},
      state.accessToken,
    );
    state.steps.me = {
      errors: me.errors?.map((e) => e.message) ?? null,
      user: me.data?.currentUser ?? null,
      workspace: me.data?.currentWorkspace ?? null,
    };
  }

  fs.writeFileSync(file, JSON.stringify(state, null, 2));
  console.log(
    JSON.stringify(
      {
        workspaceId: state.workspaceId,
        origin: state.origin,
        hasToken: Boolean(state.accessToken),
        steps: state.steps,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
