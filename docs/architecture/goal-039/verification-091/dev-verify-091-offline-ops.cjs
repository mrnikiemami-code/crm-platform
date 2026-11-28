// Goal 039 offline ops harness — Nest REST + Mock only. No live Asan. No credentials logged.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];
const apiBase = String(remote.apiUrl).replace(/\/$/, '');
const apiKey = remote.apiKey;
if (!apiKey) {
  console.error(JSON.stringify({ status: 'BLOCKED', reason: 'dev-crm129 apiKey missing' }));
  process.exit(2);
}

const evidenceDir = __dirname;
const results = { apiBase, checks: {}, failures: [] };

const action = async (body) => {
  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
  return { status: response.status, json };
};

const record = (id, ok, detail) => {
  results.checks[id] = { ok, ...detail };
  if (!ok) results.failures.push(id);
};

(async () => {
  const isHttpOk = (status) => status >= 200 && status < 300;
  const pageRows = (json) =>
    json?.page?.rows ??
    json?.rows ??
    json?.items ??
    json?.parties ??
    json?.quotations ??
    json?.data?.rows ??
    null;

  const list = await action({ action: 'accounting-connection-list' });
  const connections = Array.isArray(list.json.connections) ? list.json.connections : [];
  record('B-CONN-LIST', isHttpOk(list.status) && connections.length > 0, {
    status: list.status,
    count: connections.length,
    adapters: [...new Set(connections.map((c) => c.adapterId))],
  });

  const mock =
    connections.find((c) => c.adapterId === 'mock' && c.isActive !== false) ??
    connections.find((c) => c.adapterId === 'mock');
  const connectionId = mock?.recordId || mock?.id || null;
  record('B-MOCK-CONNECTION', Boolean(connectionId), { connectionId });

  if (connectionId) {
    for (const [id, body] of [
      ['B-PREVIEW-ITEMS', { action: 'accounting-import-preview-items-page', connectionId, pageSize: 25, search: '', refresh: true }],
      ['B-PREVIEW-PARTIES', { action: 'accounting-import-preview-parties-page', connectionId, pageSize: 25, search: '', refresh: true }],
      ['B-OUTBOUND-LIST', { action: 'accounting-outbound-list-exportable-quotations', connectionId, pageSize: 25 }],
    ]) {
      const response = await action(body);
      const rows = pageRows(response.json);
      record(id, isHttpOk(response.status) && response.json.success !== false, {
        status: response.status,
        success: response.json.success,
        keys: Object.keys(response.json || {}),
        rowCount: Array.isArray(rows) ? rows.length : null,
        totalKnown: response.json.page?.totalKnown ?? null,
        error: response.json.error || response.json.message || null,
        transportApproved: response.json.transportApproved ?? null,
      });
    }
  }

  // Tax policies Nest action
  const tax = await action({ action: 'tax-policy-list' });
  const policies = tax.json.policies ?? tax.json.taxPolicies ?? tax.json.data?.policies;
  record('B-TAX-LIST', isHttpOk(tax.status) && Array.isArray(policies) && policies.length > 0, {
    status: tax.status,
    count: Array.isArray(policies) ? policies.length : null,
    keys: Object.keys(tax.json || {}),
  });

  // Currencies
  const currencies = await action({ action: 'quotation-currency-list' });
  const currencyRows = currencies.json.currencies ?? currencies.json.data?.currencies;
  record('B-CURRENCY-LIST', isHttpOk(currencies.status) && Array.isArray(currencyRows), {
    status: currencies.status,
    count: Array.isArray(currencyRows) ? currencyRows.length : null,
    keys: Object.keys(currencies.json || {}),
  });

  // Anonymous refuse
  const anon = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accounting-connection-list' }),
  });
  record('A-ANON-REFUSE', anon.status === 401 || anon.status === 403, { status: anon.status });

  results.status = results.failures.length === 0 ? 'PASS' : 'FAIL';
  results.failed = results.failures;
  fs.writeFileSync(path.join(evidenceDir, 'offline-ops.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.failures.length === 0 ? 0 : 1);
})().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error) }));
  process.exit(1);
});
