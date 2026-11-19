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
const SERVICE =
  '/app/packages/twenty-server/dist/modules/quotation/services/quotation-immutability.service.js';
const BACKUP = '/tmp/quotation-immutability.service.js.r5bak';

const gql = async (query) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${remote.apiKey}`,
    },
    body: JSON.stringify({ query }),
  });
  return response.json();
};

const dockerNode = (script) => {
  const local = path.join(__dirname, 'tmp-r5-docker-node.cjs');
  fs.writeFileSync(local, script);
  execFileSync('docker', ['cp', local, 'twenty-server-1:/tmp/tmp-r5-docker-node.cjs']);
  return execFileSync(
    'docker',
    ['exec', '-u', 'root', 'twenty-server-1', 'node', '/tmp/tmp-r5-docker-node.cjs'],
    { encoding: 'utf8' },
  );
};

const restart = async () => {
  execFileSync('docker', ['restart', 'twenty-server-1'], { encoding: 'utf8' });
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch('http://localhost:3002/healthz');
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch {
      // retry
    }
    execFileSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Seconds 2'], {
      stdio: 'ignore',
    });
  }
  throw new Error('dev unhealthy');
};

(async () => {
  dockerInspectIsolation();

  const personId = (
    await gql(`{ people(first: 1) { edges { node { id } } } }`)
  ).data.people.edges[0].node.id;
  const created = await gql(`mutation {
    createQuotation(data: {
      name: "S2R5-claim-fail"
      status: DRAFT
      customerType: PERSON
      personId: "${personId}"
      currencyCode: "IRR"
      totalExact: "1.000000"
      version: 1
    }) { id status version name }
  }`);
  if (!created.data?.createQuotation?.id) {
    console.error(created);
    process.exit(1);
  }
  const before = created.data.createQuotation;
  console.log('before', before);

  console.log(
    dockerNode(`
const fs = require('fs');
const src = ${JSON.stringify(SERVICE)};
const bak = ${JSON.stringify(BACKUP)};
fs.copyFileSync(src, bak);
let t = fs.readFileSync(src, 'utf8');
const marker = 'R5_THROW_AFTER_CLAIM';
if (t.includes(marker)) { console.log('already-patched'); process.exit(0); }
const anchor = 'async assertQuotationUpdateAllowed';
const start = t.indexOf(anchor);
if (start < 0) throw new Error('assertQuotationUpdateAllowed missing');
const claim = t.indexOf('await this.claimQuotationVersion({', start);
if (claim < 0) throw new Error('claim missing in assertQuotationUpdateAllowed');
const end = t.indexOf('});', claim);
if (end < 0) throw new Error('claim end missing');
const at = end + 3;
t = t.slice(0, at) + "\\n        // " + marker + "\\n        throw new Error('" + marker + "');" + t.slice(at);
fs.writeFileSync(src, t);
console.log('patched');
`),
  );

  await restart();

  const failed = await gql(`mutation {
    updateQuotation(id: "${before.id}", data: {
      name: "should-not-persist"
      status: PENDING_INTERNAL_APPROVAL
      version: ${before.version}
    }) { id name status version }
  }`);
  console.log('mutationErrors', failed.errors?.map((error) => error.message));

  const after = (
    await gql(
      `query { quotation(filter: { id: { eq: "${before.id}" } }) { id name status version } }`,
    )
  ).data.quotation;
  console.log('after', after);

  console.log(
    dockerNode(`
const fs = require('fs');
fs.copyFileSync(${JSON.stringify(BACKUP)}, ${JSON.stringify(SERVICE)});
console.log('restored');
`),
  );
  await restart();

  const claimCommitted =
    after.version !== before.version || after.status !== before.status;
  const contentNotApplied = after.name === before.name;

  console.log(
    JSON.stringify({ claimCommitted, contentNotApplied, before, after }, null, 2),
  );

  if (claimCommitted && contentNotApplied && Array.isArray(failed.errors)) {
    console.log('CLAIM_THEN_FAIL_CONFIRMED');
    process.exit(0);
  }
  console.log('CLAIM_THEN_FAIL_NOT_REPRODUCED');
  process.exit(1);
})().catch(async (error) => {
  console.error(error);
  try {
    dockerNode(`
const fs = require('fs');
const bak = ${JSON.stringify(BACKUP)};
const src = ${JSON.stringify(SERVICE)};
if (fs.existsSync(bak)) fs.copyFileSync(bak, src);
console.log('restored-on-error');
`);
    await restart();
  } catch {
    // ignore
  }
  process.exit(1);
});

function dockerInspectIsolation() {
  const nets = execFileSync(
    'docker',
    ['inspect', 'twenty-server-1', '--format', '{{json .NetworkSettings.Networks}}'],
    { encoding: 'utf8' },
  );
  if (nets.includes('crm-intranet-net') || !nets.includes('twenty_default')) {
    throw new Error('Refusing: Dev server network not isolated');
  }
}
