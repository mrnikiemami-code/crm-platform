const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const config = JSON.parse(
  fs.readFileSync(
    path.join(process.env.USERPROFILE, '.twenty', 'config.json'),
    'utf8',
  ),
);
const remote = config.remotes['dev-crm129'];
if (!remote?.apiUrl || String(remote.apiUrl).includes('6080')) process.exit(2);

const endpoint = `${remote.apiUrl.replace(/\/$/, '')}/graphql`;
const metadataEndpoint = `${remote.apiUrl.replace(/\/$/, '')}/metadata`;
const adminToken = remote.apiKey;
const API_KEY_ID = 'baa02353-7f60-4e73-8cc2-bb28c36beda5';
const ADMIN_ROLE_ID = '8cc21785-99f9-4542-a29a-1b47743f4923';

const requestGraphql = async (url, query, variables) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(variables ? { query, variables } : { query }),
  });
  return response.json();
};
const gql = (query, variables) => requestGraphql(endpoint, query, variables);
const meta = (query, variables) =>
  requestGraphql(metadataEndpoint, query, variables);

const assert = (label, condition, detail) => {
  if (!condition) {
    const error = new Error(`FAIL ${label}`);
    error.detail = detail;
    throw error;
  }
  console.log('PASS', label);
};

const runSql = (sql) => {
  const sqlPath = path.join(__dirname, 'tmp-s2r4-role-swap.sql');
  fs.writeFileSync(sqlPath, sql, 'utf8');
  execFileSync('docker', [
    'cp',
    sqlPath,
    'twenty-db-1:/tmp/tmp-s2r4-role-swap.sql',
  ]);
  return execFileSync(
    'docker',
    [
      'exec',
      'twenty-db-1',
      'psql',
      '-U',
      'postgres',
      '-d',
      'default',
      '-f',
      '/tmp/tmp-s2r4-role-swap.sql',
    ],
    { encoding: 'utf8' },
  );
};

const sleepSync = (ms) => {
  execFileSync('powershell', ['-NoProfile', '-Command', `Start-Sleep -Milliseconds ${ms}`], {
    stdio: 'ignore',
  });
};

const waitHealthy = async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch('http://localhost:3002/healthz');
      if (response.ok) {
        const body = await response.json();
        if (body.status === 'ok') {
          return;
        }
      }
    } catch {
      // retry while container boots
    }
    sleepSync(2000);
  }
  throw new Error('Dev server did not become healthy');
};

const WORKSPACE_ID = 'afc7afb6-94ef-4142-872b-52a81b3e91dd';

const flushRoleCaches = () => {
  const keys = [
    'apiKeyRoleMap',
    'flatRoleMaps',
    'rolesPermissions',
    'flatObjectPermissionMaps',
    'flatRoleTargetMaps',
  ].flatMap((name) => [
    `engine:workspace:${name}:${WORKSPACE_ID}:data`,
    `engine:workspace:${name}:${WORKSPACE_ID}:hash`,
  ]);

  execFileSync(
    'docker',
    ['exec', 'twenty-redis-1', 'redis-cli', 'DEL', ...keys],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
};

const restartDevServer = async () => {
  flushRoleCaches();
  execFileSync('docker', ['restart', 'twenty-server-1'], { encoding: 'utf8' });
  await waitHealthy();
};

const restoreAdminRole = async () => {
  runSql(`UPDATE core."roleTarget"
SET "roleId" = '${ADMIN_ROLE_ID}'
WHERE "apiKeyId" = '${API_KEY_ID}';
`);
  await restartDevServer();
  console.log('RESTORED_ADMIN_ROLE');
};

(async () => {
  const objects = await meta(`{
    objects(paging: { first: 200 }) {
      edges { node { id nameSingular } }
    }
  }`);
  const quotationObjectId = objects.data.objects.edges.find(
    (edge) => edge.node.nameSingular === 'quotation',
  ).node.id;
  const quotationLineObjectId = objects.data.objects.edges.find(
    (edge) => edge.node.nameSingular === 'quotationLine',
  ).node.id;

  const role = await meta(
    `mutation CreateOneRole($createRoleInput: CreateRoleInput!) {
      createOneRole(createRoleInput: $createRoleInput) { id label }
    }`,
    {
      createRoleInput: {
        label: `CRM129-S2R4-role-${Date.now()}`,
        description: 'Object-only quotation editor',
        canUpdateAllSettings: false,
        canAccessAllTools: false,
        canReadAllObjectRecords: true,
        canUpdateAllObjectRecords: false,
        canSoftDeleteAllObjectRecords: false,
        canDestroyAllObjectRecords: false,
        canBeAssignedToUsers: true,
        canBeAssignedToApiKeys: true,
        canBeAssignedToAgents: false,
      },
    },
  );
  assert('create-limited-role', !!role.data?.createOneRole?.id, role);
  const roleId = role.data.createOneRole.id;

  const upsert = await meta(
    `mutation UpsertObjectPermissions($upsertObjectPermissionsInput: UpsertObjectPermissionsInput!) {
      upsertObjectPermissions(upsertObjectPermissionsInput: $upsertObjectPermissionsInput) {
        objectMetadataId canUpdateObjectRecords
      }
    }`,
    {
      upsertObjectPermissionsInput: {
        roleId,
        objectPermissions: [
          {
            objectMetadataId: quotationObjectId,
            canReadObjectRecords: true,
            canUpdateObjectRecords: true,
            canSoftDeleteObjectRecords: false,
            canDestroyObjectRecords: false,
          },
          {
            objectMetadataId: quotationLineObjectId,
            canReadObjectRecords: true,
            canUpdateObjectRecords: true,
            canSoftDeleteObjectRecords: true,
            canDestroyObjectRecords: false,
          },
        ],
      },
    },
  );
  assert(
    'upsert-object-permissions',
    Array.isArray(upsert.data?.upsertObjectPermissions),
    upsert,
  );

  runSql(`UPDATE core."roleTarget"
SET "roleId" = '${roleId}'
WHERE "apiKeyId" = '${API_KEY_ID}';
`);
  console.log('SWAPPED_TO_LIMITED_ROLE');
  await restartDevServer();

  try {
    const personId = (
      await gql(`{ people(first: 1) { edges { node { id } } } }`)
    ).data.people.edges[0].node.id;

    const created = await gql(`mutation {
      createQuotation(data: {
        name: "S2R4-role-${Date.now()}"
        status: DRAFT
        customerType: PERSON
        personId: "${personId}"
        currencyCode: "IRR"
        totalExact: "1.000000"
        version: 1
      }) { id version status }
    }`);
    assert('limited-create-draft', !!created.data?.createQuotation?.id, created);
    const id = created.data.createQuotation.id;
    let version = created.data.createQuotation.version;

    const edited = await gql(`mutation {
      updateQuotation(id: "${id}", data: { name: "limited-edit", version: ${version} }) {
        id name version
      }
    }`);
    assert(
      'limited-edit-draft-allowed',
      edited.data?.updateQuotation?.name === 'limited-edit',
      edited,
    );
    version = edited.data.updateQuotation.version;

    const submitted = await gql(`mutation {
      updateQuotation(id: "${id}", data: { status: PENDING_INTERNAL_APPROVAL, version: ${version} }) {
        id status version
      }
    }`);
    assert(
      'limited-submit-allowed',
      submitted.data?.updateQuotation?.status === 'PENDING_INTERNAL_APPROVAL',
      submitted,
    );
    version = submitted.data.updateQuotation.version;

    const approve = await gql(`mutation {
      updateQuotation(id: "${id}", data: { status: READY_TO_SEND, version: ${version} }) {
        id status
      }
    }`);
    assert(
      'limited-approve-forbidden',
      Array.isArray(approve.errors) &&
        approve.errors[0].message.includes('PERMISSION_MISSING'),
      approve,
    );

    // Advance with Admin capabilities, then re-limit for send/cancel/accept.
    runSql(`UPDATE core."roleTarget"
SET "roleId" = '${ADMIN_ROLE_ID}'
WHERE "apiKeyId" = '${API_KEY_ID}';
`);
    await restartDevServer();

    const adminReady = await gql(`mutation {
      updateQuotation(id: "${id}", data: { status: READY_TO_SEND, version: ${version} }) {
        id status version
      }
    }`);
    assert('admin-approve', !!adminReady.data?.updateQuotation, adminReady);
    version = adminReady.data.updateQuotation.version;

    runSql(`UPDATE core."roleTarget"
SET "roleId" = '${roleId}'
WHERE "apiKeyId" = '${API_KEY_ID}';
`);
    await restartDevServer();

    const limitedSend = await gql(`mutation {
      updateQuotation(id: "${id}", data: { status: SENT, version: ${version} }) {
        id status
      }
    }`);
    assert(
      'limited-send-forbidden',
      Array.isArray(limitedSend.errors) &&
        limitedSend.errors[0].message.includes('PERMISSION_MISSING'),
      limitedSend,
    );

    runSql(`UPDATE core."roleTarget"
SET "roleId" = '${ADMIN_ROLE_ID}'
WHERE "apiKeyId" = '${API_KEY_ID}';
`);
    await restartDevServer();

    const adminSent = await gql(`mutation {
      updateQuotation(id: "${id}", data: { status: SENT, version: ${version} }) {
        id status version
      }
    }`);
    assert('admin-send', !!adminSent.data?.updateQuotation, adminSent);
    version = adminSent.data.updateQuotation.version;

    runSql(`UPDATE core."roleTarget"
SET "roleId" = '${roleId}'
WHERE "apiKeyId" = '${API_KEY_ID}';
`);
    await restartDevServer();

    const cancel = await gql(`mutation {
      updateQuotation(id: "${id}", data: { status: CANCELLED, version: ${version} }) {
        id status
      }
    }`);
    assert(
      'limited-cancel-forbidden',
      Array.isArray(cancel.errors) &&
        cancel.errors[0].message.includes('PERMISSION_MISSING'),
      cancel,
    );

    const accept = await gql(`mutation {
      updateQuotation(id: "${id}", data: { status: CUSTOMER_ACCEPTED, version: ${version} }) {
        id status
      }
    }`);
    assert(
      'limited-accept-forbidden',
      Array.isArray(accept.errors) &&
        accept.errors[0].message.includes('PERMISSION_MISSING'),
      accept,
    );

    await restoreAdminRole();

    const adminAccept = await gql(`mutation {
      updateQuotation(id: "${id}", data: { status: CUSTOMER_ACCEPTED, version: ${version} }) {
        id status
      }
    }`);
    assert(
      'admin-accept-allowed',
      adminAccept.data?.updateQuotation?.status === 'CUSTOMER_ACCEPTED',
      adminAccept,
    );

    await meta(`mutation DeleteOneRole($roleIdToDelete: UUID!) {
      deleteOneRole(roleIdToDelete: $roleIdToDelete)
    }`, { roleIdToDelete: roleId }).catch(() => undefined);

    console.log('S2_R4_ROLE_PASS');
  } catch (error) {
    console.error(error.message || error);
    if (error.detail) {
      console.error(error.detail);
    }
    await restoreAdminRole();
    process.exit(1);
  }
})();
