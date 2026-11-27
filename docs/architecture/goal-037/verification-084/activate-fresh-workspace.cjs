const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, 'fresh-workspace.json');
const state = JSON.parse(fs.readFileSync(file, 'utf8'));

const meta = async (query, variables = {}) => {
  const response = await fetch(`${state.apiBase}/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
};

(async () => {
  const activated = await meta(
    `mutation($data:ActivateWorkspaceInput!){
      activateWorkspace(data:$data){ id activationStatus }
    }`,
    { data: { displayName: `PARTY-UAT-083-${state.stamp}` } },
  );
  state.steps.activate = {
    errors: activated.errors?.map((e) => e.message) ?? null,
    workspace: activated.data?.activateWorkspace ?? null,
  };

  // Poll until ACTIVE
  for (let i = 0; i < 60; i += 1) {
    const status = await meta(
      `query { currentWorkspace { id activationStatus } getRoles { id label canUpdateAllSettings canBeAssignedToApiKeys } }`,
    );
    const activationStatus =
      status.data?.currentWorkspace?.activationStatus ?? null;
    state.steps.activationPoll = {
      i,
      activationStatus,
      roleCount: status.data?.getRoles?.length ?? 0,
      errors: status.errors?.map((e) => e.message) ?? null,
    };
    if (activationStatus === 'ACTIVE' && (status.data?.getRoles?.length ?? 0) > 0) {
      state.steps.roles = status.data.getRoles;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  fs.writeFileSync(file, JSON.stringify(state, null, 2));
  console.log(
    JSON.stringify(
      {
        activate: state.steps.activate,
        activationPoll: state.steps.activationPoll,
        roleCount: state.steps.roles?.length ?? 0,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
