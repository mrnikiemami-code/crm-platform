const fs = require('node:fs');
const path = require('node:path');

const localFile = path.join(__dirname, 'fresh-workspace.local.json');
const state = JSON.parse(fs.readFileSync(localFile, 'utf8'));
const apiBase = 'http://localhost:3002';

const meta = async (query, variables = {}) => {
  const response = await fetch(`${apiBase}/metadata`, {
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
    { data: { displayName: `G038-090-FRESH-${state.subdomain || 'ws'}` } },
  );
  state.steps = state.steps || {};
  state.steps.activate = {
    errors: activated.errors?.map((e) => e.message) ?? null,
    workspace: activated.data?.activateWorkspace ?? null,
  };

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
      state.steps.rolesReady = status.data.getRoles;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  fs.writeFileSync(localFile, JSON.stringify(state, null, 2));
  const redacted = {
    activate: state.steps.activate,
    activationPoll: state.steps.activationPoll,
    roleCount: state.steps.rolesReady?.length ?? 0,
    workspaceId: state.workspaceId,
  };
  fs.writeFileSync(path.join(__dirname, 'activate-fresh-workspace.json'), JSON.stringify(redacted, null, 2));
  console.log(JSON.stringify(redacted, null, 2));
  process.exit((state.steps.rolesReady?.length ?? 0) > 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
