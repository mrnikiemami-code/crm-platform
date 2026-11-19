const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];
if (!remote?.apiUrl || String(remote.apiUrl).includes('6080')) {
  console.error('refuse: missing or intranet remote');
  process.exit(2);
}

const apiBase = remote.apiUrl.replace(/\/$/, '');
const adminToken = remote.apiKey;
const API_KEY_ID = 'baa02353-7f60-4e73-8cc2-bb28c36beda5';
const ADMIN_ROLE_ID = '8cc21785-99f9-4542-a29a-1b47743f4923';
const WORKSPACE_ID = 'afc7afb6-94ef-4142-872b-52a81b3e91dd';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const gql = async (query, token = adminToken) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${apiBase}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });
    const payload = await response.json();
    const rateLimited = Array.isArray(payload.errors)
      ? payload.errors.some(
          (error) => error?.extensions?.code === 'RATE_LIMITED',
        )
      : false;

    if (!rateLimited) {
      return payload;
    }

    await sleep(800);
  }

  throw new Error('GraphQL rate limited after retries');
};

const meta = async (query, variables) => {
  const response = await fetch(`${apiBase}/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
};

const postApp = async (route, body, token = adminToken) => {
  const response = await fetch(`${apiBase}/s${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    data = { success: false, raw: text };
  }
  return { httpStatus: response.status, data };
};

const action = async (body, token = adminToken) => {
  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    data = { success: false, raw: text };
  }
  return { httpStatus: response.status, data };
};

const publicGet = async (url) => {
  const response = await fetch(url, { redirect: 'follow' });
  return { httpStatus: response.status, text: await response.text() };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runSql = (sql) => {
  const sqlPath = path.join(__dirname, 'tmp-s3r2-role-swap.sql');
  fs.writeFileSync(sqlPath, sql, 'utf8');
  execFileSync('docker', [
    'cp',
    sqlPath,
    'twenty-db-1:/tmp/tmp-s3r2-role-swap.sql',
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
      '/tmp/tmp-s3r2-role-swap.sql',
    ],
    { encoding: 'utf8' },
  );
};

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
  execFileSync('docker', ['exec', 'twenty-redis-1', 'redis-cli', 'DEL', ...keys], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
};

const waitHealthy = async () => {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`${apiBase}/healthz`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await sleep(1500);
  }
  throw new Error('Dev server did not become healthy');
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
};

const main = async () => {
  const personId = (await gql(`{ people(first: 1) { edges { node { id } } } }`))
    .data.people.edges[0].node.id;

  const draft = await postApp('/quotation/save-draft', {
    customerType: 'PERSON',
    personId,
    companyId: null,
    name: `S3-R2-${Date.now()}`,
    paymentTerms: 'نقد',
    taxPolicy: 'IR_VAT_9',
    documentDiscountKind: 'NONE',
    documentDiscountPercentText: '',
    documentDiscountAmountText: '',
    lines: [
      {
        clientLineId: 'l1',
        catalogItemId: null,
        kind: 'PRODUCT',
        name: 'کالای UAT لینک',
        description: null,
        unit: 'عدد',
        quantityText: '1',
        unitPriceText: '1500',
        moneyUnit: 'TOMAN',
        discountKind: 'NONE',
        discountPercentText: '',
        discountAmountText: '',
      },
    ],
  });
  assert(draft.data?.success === true, `save failed: ${JSON.stringify(draft.data)}`);
  const quotationId = draft.data.quotationId;

  let version = (
    await gql(
      `{ quotation(filter: { id: { eq: "${quotationId}" } }) { version status } }`,
    )
  ).data.quotation.version;

  for (const toStatus of ['PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND']) {
    const step = await action({
      action: 'transition',
      quotationId,
      toStatus,
      version,
    });
    assert(step.data?.success === true, `${toStatus} failed: ${JSON.stringify(step.data)}`);
    version = step.data.version;
  }

  const appTokenMint = await postApp('/quotation/create-customer-link', {
    quotationId,
    ttlHours: 24,
  });
  assert(
    appTokenMint.data?.success === false &&
      appTokenMint.data?.code === 'USE_USER_SESSION_BRIDGE',
    `app-token mint must be blocked: ${JSON.stringify(appTokenMint.data)}`,
  );

  const created = await action({
    action: 'create-customer-link',
    quotationId,
    ttlHours: 24,
  });
  assert(created.data?.success === true, `authorized mint failed: ${JSON.stringify(created.data)}`);
  const rawToken = created.data.rawToken;
  const viewUrl = created.data.viewUrl;
  const linkId = created.data.linkId;
  assert(typeof rawToken === 'string' && rawToken.length > 20, 'raw token missing');
  const hash = createHash('sha256').update(rawToken, 'utf8').digest('hex');
  const stored = await gql(`{
    quotationCustomerLinks(filter: { id: { eq: "${linkId}" } }, first: 1) {
      edges { node { tokenHash quotationId } }
    }
  }`);
  assert(
    stored.data.quotationCustomerLinks.edges[0].node.tokenHash === hash,
    'stored hash mismatch',
  );

  const valid = await publicGet(viewUrl);
  assert(valid.httpStatus === 200, `valid status ${valid.httpStatus}`);
  assert(valid.text.includes('کالای UAT لینک'), 'line missing on public page');

  const otherDraft = await postApp('/quotation/save-draft', {
    customerType: 'PERSON',
    personId,
    companyId: null,
    name: `S3-R2-other-${Date.now()}`,
    paymentTerms: 'نقد',
    taxPolicy: 'IR_VAT_9',
    documentDiscountKind: 'NONE',
    documentDiscountPercentText: '',
    documentDiscountAmountText: '',
    lines: [
      {
        clientLineId: 'l1',
        catalogItemId: null,
        kind: 'SERVICE',
        name: 'خدمت دیگر',
        description: null,
        unit: 'ساعت',
        quantityText: '1',
        unitPriceText: '900',
        moneyUnit: 'TOMAN',
        discountKind: 'NONE',
        discountPercentText: '',
        discountAmountText: '',
      },
    ],
  });
  assert(otherDraft.data?.success === true, 'other draft failed');
  const otherId = otherDraft.data.quotationId;

  const mismatch = await action({
    action: 'revoke-customer-link',
    quotationId: otherId,
    linkId,
  });
  assert(
    mismatch.data?.success === false &&
      mismatch.data?.code === 'CUSTOMER_LINK_QUOTATION_MISMATCH',
    `cross-quotation revoke must fail: ${JSON.stringify(mismatch.data)}`,
  );

  const objects = await meta(`{
    objects(paging: { first: 200 }) {
      edges { node { id nameSingular } }
    }
  }`);
  const quotationObjectId = objects.data.objects.edges.find(
    (edge) => edge.node.nameSingular === 'quotation',
  ).node.id;

  const role = await meta(
    `mutation CreateOneRole($createRoleInput: CreateRoleInput!) {
      createOneRole(createRoleInput: $createRoleInput) { id label }
    }`,
    {
      createRoleInput: {
        label: `CRM129-S3R2-limited-${Date.now()}`,
        description: 'Object-only quotation editor without send',
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
  assert(!!role.data?.createOneRole?.id, `create role failed: ${JSON.stringify(role)}`);
  const roleId = role.data.createOneRole.id;

  await meta(
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
        ],
      },
    },
  );

  runSql(`UPDATE core."roleTarget"
SET "roleId" = '${roleId}'
WHERE "apiKeyId" = '${API_KEY_ID}';
`);
  await restartDevServer();

  let unauthorizedBlocked = false;
  try {
    const denied = await action({
      action: 'create-customer-link',
      quotationId,
      ttlHours: 24,
    });
    unauthorizedBlocked =
      denied.data?.success === false &&
      denied.data?.code === 'PERMISSION_MISSING';
    assert(
      unauthorizedBlocked,
      `limited role must not mint: ${JSON.stringify(denied.data)}`,
    );

    const deniedRevoke = await action({
      action: 'revoke-customer-link',
      quotationId,
      linkId,
    });
    assert(
      deniedRevoke.data?.success === false &&
        deniedRevoke.data?.code === 'PERMISSION_MISSING',
      `limited role must not revoke: ${JSON.stringify(deniedRevoke.data)}`,
    );
  } finally {
    await restoreAdminRole();
  }

  const revoked = await action({
    action: 'revoke-customer-link',
    quotationId,
    linkId,
  });
  assert(revoked.data?.success === true, `revoke failed: ${JSON.stringify(revoked.data)}`);
  const afterRevoke = await publicGet(viewUrl);
  assert(afterRevoke.httpStatus === 410, `revoked status ${afterRevoke.httpStatus}`);

  const expiredMint = await action({
    action: 'create-customer-link',
    quotationId,
    ttlHours: 1,
  });
  assert(expiredMint.data?.success === true, 'second mint failed');
  const past = new Date(Date.now() - 60_000).toISOString();
  await gql(`mutation {
    updateQuotationCustomerLink(id: "${expiredMint.data.linkId}", data: { expiresAt: "${past}" }) { id }
  }`);
  const afterExpiry = await publicGet(expiredMint.data.viewUrl);
  assert(afterExpiry.httpStatus === 410, `expired status ${afterExpiry.httpStatus}`);

  const unknown = await publicGet(
    `${apiBase}/s/quotation/customer-view?token=${encodeURIComponent('not-real')}`,
  );
  assert(unknown.httpStatus === 404, `unknown status ${unknown.httpStatus}`);

  console.log(
    JSON.stringify(
      {
        marker: 'S3_R2_LINK_AUTHZ_PASS',
        quotationId,
        linkId,
        unauthorizedBlocked,
        appTokenBlocked: true,
        validStatus: valid.httpStatus,
        revokedStatus: afterRevoke.httpStatus,
        expiredStatus: afterExpiry.httpStatus,
        unknownStatus: unknown.httpStatus,
      },
      null,
      2,
    ),
  );
};

main().catch(async (error) => {
  console.error('S3_R2_LINK_AUTHZ_FAIL', error);
  try {
    await restoreAdminRole();
  } catch (restoreError) {
    console.error('restore failed', restoreError);
  }
  process.exit(1);
});
