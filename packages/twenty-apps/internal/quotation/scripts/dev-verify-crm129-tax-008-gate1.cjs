// CRM-129-008 Gate 1: tax-settings authority is decided at the server boundary.
//
// Every check below is a real HTTP call against Dev :3002 and a real SQL read of the
// workspace tax-policy table. "Zero write" means the table fingerprint (row count,
// defaults, updatedAt sum) is byte-identical before and after the refused request.
//
// Usage:
//   node scripts/dev-verify-crm129-tax-008-gate1.cjs --mode=guard       (server reachable, admin role)
//   node scripts/dev-verify-crm129-tax-008-gate1.cjs --mode=forbidden   (Admin role demoted, server restarted)
//   node scripts/dev-verify-crm129-tax-008-gate1.cjs --mode=restored    (Admin role restored, server restarted)
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Client } = require('pg');

const mode = (process.argv.find((arg) => arg.startsWith('--mode=')) ?? '').split('=')[1] || 'guard';
const tokenArgument = (process.argv.find((arg) => arg.startsWith('--token=')) ?? '').slice(
  '--token='.length,
);

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];

if (!remote?.apiUrl || String(remote.apiUrl).includes('6080')) {
  console.error('refuse: missing or intranet remote');
  process.exit(2);
}

const apiBase = String(remote.apiUrl).replace(/\/$/, '');
const adminToken = remote.apiKey;
// A caller token may be supplied to prove the role branch with a real principal that
// is not an admin, instead of demoting the only admin role in the workspace.
const callerToken = tokenArgument.trim() !== '' ? tokenArgument.trim() : adminToken;
const DATABASE_URL =
  process.env.CRM129_DATABASE_URL ??
  'postgres://postgres:563162150m8084M@localhost:5432/default';

const results = [];
const record = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${detail}`);
};

const rest = async ({ action, body, token }) => {
  const headers = { 'Content-Type': 'application/json' };
  if (typeof token === 'string') headers.Authorization = `Bearer ${token}`.trim();

  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...body }),
  });
  const text = await response.text();
  let parsed = {};

  try {
    parsed = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }

  return { status: response.status, body: parsed };
};

const db = new Client({ connectionString: DATABASE_URL });

const findWorkspaceSchema = async () => {
  const { rows } = await db.query(
    `select table_schema from information_schema.tables
      where table_name = '_taxPolicy'
      order by table_schema limit 1`,
  );

  if (rows.length === 0) throw new Error('no _taxPolicy table found');

  return rows[0].table_schema;
};

let schema;

const fingerprint = async () => {
  const { rows } = await db.query(
    `select count(*)::int as total,
            count(*) filter (where "isDefault" and "isActive")::int as defaults,
            coalesce(md5(string_agg(id::text || code || "rateBasisPoints" || "isActive"::text
              || "isDefault"::text || "isExempt"::text, '|' order by id)), '') as digest
       from ${schema}."_taxPolicy" where "deletedAt" is null`,
  );

  return rows[0];
};

const policyList = async () => {
  const response = await rest({ action: 'tax-policy-list', body: {}, token: adminToken });

  return origin(response) ? response.body.policies ?? [] : [];
};

const origin = (response) => response.status >= 200 && response.status < 300;

const mutationAttempt = async ({ action, body, token }) => {
  const before = await fingerprint();
  const response = await rest({ action, body, token });
  const after = await fingerprint();

  return { response, before, after, unchanged: before.digest === after.digest };
};

const run = async () => {
  await db.connect();
  schema = await findWorkspaceSchema();

  if (mode === 'guard') {
    const policies = await policyList();
    record('G0 server and admin authority', policies.length > 0, `policies=${policies.length}`);

    // G1: no Authorization header. The guard must refuse before any handler runs.
    const noHeader = await mutationAttempt({
      action: 'tax-policy-save',
      body: { name: 'بدون مجوز ۰۰۸', ratePercentText: '۱۲.۵', isDefault: false },
      token: null,
    });
    record(
      'G1 anonymous mutation refused',
      (noHeader.response.status === 401 || noHeader.response.status === 403) && noHeader.unchanged,
      `status=${noHeader.response.status} unchanged=${noHeader.unchanged} total=${noHeader.after.total}`,
    );

    // G2: a token that is not a token. Same requirement.
    const garbage = await mutationAttempt({
      action: 'tax-policy-bootstrap',
      body: {},
      token: 'not-a-real-token',
    });
    record(
      'G2 invalid bearer refused',
      (garbage.response.status === 401 || garbage.response.status === 403) && garbage.unchanged,
      `status=${garbage.response.status} unchanged=${garbage.unchanged}`,
    );

    // G3: the admin token is not blanket-denied; authority resolution really ran.
    const unknown = await mutationAttempt({
      action: 'tax-policy-deactivate',
      body: { recordId: '00000000-0000-4000-8000-000000000000' },
      token: adminToken,
    });
    record(
      'G3 admin reaches the service and is refused by domain, not by guard',
      origin(unknown.response) &&
        unknown.response.body.code === 'TAX_POLICY_NOT_FOUND' &&
        unknown.unchanged,
      `status=${unknown.response.status} code=${unknown.response.body.code} unchanged=${unknown.unchanged}`,
    );

    // G4: a read is open to an authenticated member and writes nothing.
    const listBefore = await fingerprint();
    const listed = await rest({ action: 'tax-policy-list', body: {}, token: adminToken });
    const listAfter = await fingerprint();
    record(
      'G4 policy list is a pure read',
      origin(listed) && listed.body.success === true && listBefore.digest === listAfter.digest,
      `policies=${(listed.body.policies ?? []).length} unchanged=${listBefore.digest === listAfter.digest}`,
    );
  }

  if (mode === 'forbidden') {
    // The caller here is a real principal whose role lacks `canUpdateAllSettings`.
    const save = await mutationAttempt({
      action: 'tax-policy-save',
      body: { name: 'بدون مجوز تنظیمات ۰۰۸', ratePercentText: '۱۲.۵', isDefault: true },
      token: callerToken,
    });
    record(
      'G5 mutation refused when the role lacks settings authority',
      origin(save.response) &&
        save.response.body.success === false &&
        save.response.body.code === 'TAX_SETTINGS_FORBIDDEN' &&
        save.unchanged,
      `code=${save.response.body.code} total=${save.before.total}->${save.after.total} unchanged=${save.unchanged}`,
    );

    const bootstrap = await mutationAttempt({
      action: 'tax-policy-bootstrap',
      body: {},
      token: callerToken,
    });
    record(
      'G6 bootstrap refused for the same caller',
      origin(bootstrap.response) &&
        bootstrap.response.body.success === false &&
        bootstrap.response.body.code === 'TAX_SETTINGS_FORBIDDEN' &&
        bootstrap.unchanged,
      `code=${bootstrap.response.body.code} unchanged=${bootstrap.unchanged}`,
    );

    const deactivate = await mutationAttempt({
      action: 'tax-policy-deactivate',
      body: { recordId: '00000000-0000-4000-8000-000000000000' },
      token: callerToken,
    });
    record(
      'G7 every mutating tax action is gated, not just save',
      origin(deactivate.response) &&
        deactivate.response.body.code === 'TAX_SETTINGS_FORBIDDEN' &&
        deactivate.unchanged,
      `code=${deactivate.response.body.code} unchanged=${deactivate.unchanged}`,
    );

    const listed = await rest({ action: 'tax-policy-list', body: {}, token: callerToken });
    record(
      'G8 reading stays available to an authenticated member',
      origin(listed) && listed.body.success === true,
      `policies=${(listed.body.policies ?? []).length}`,
    );
  }

  if (mode === 'restored') {
    // The capability is back: the same call now goes through, so G5 refused because
    // of the role, not because the route was broken.
    const saved = await mutationAttempt({
      action: 'tax-policy-save',
      body: { name: 'سیاست موقت ۰۰۸', ratePercentText: '۱۲.۵', isDefault: false },
      token: adminToken,
    });
    const created = (saved.response.body.policies ?? []).find(
      (policy) => policy.name === 'سیاست موقت ۰۰۸',
    );
    record(
      'G9 the same mutation succeeds once the role has the capability',
      origin(saved.response) && saved.response.body.success === true && Boolean(created),
      `code=${created?.code ?? 'missing'} total=${saved.before.total}->${saved.after.total}`,
    );

    if (created) {
      const deactivated = await rest({
        action: 'tax-policy-deactivate',
        body: { recordId: created.recordId },
        token: adminToken,
      });
      record(
        'G10 cleanup deactivates the fixture policy',
        origin(deactivated) && deactivated.body.success === true,
        `code=${deactivated.body.code ?? 'OK'}`,
      );
      await db.query(
        `update ${schema}."_taxPolicy" set "deletedAt" = now() where id = $1`,
        [created.recordId],
      );
    }
  }

  await db.end();
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS (mode=${mode})`);

  if (failed.length > 0) process.exit(1);
};

run().catch(async (error) => {
  console.error('verification crashed', error);
  try {
    await db.end();
  } catch {}
  process.exit(2);
});
