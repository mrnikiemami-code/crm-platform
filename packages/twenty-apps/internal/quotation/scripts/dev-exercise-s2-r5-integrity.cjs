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

const createDraft = async (name) => {
  const personId = (
    await gql(`{ people(first: 1) { edges { node { id } } } }`)
  ).data.people.edges[0].node.id;
  const created = await gql(`mutation {
    createQuotation(data: {
      name: "${name}"
      status: DRAFT
      customerType: PERSON
      personId: "${personId}"
      currencyCode: "IRR"
      totalExact: "1.000000"
      version: 1
    }) { id name status version }
  }`);
  if (!created.data?.createQuotation) throw new Error(JSON.stringify(created));
  return created.data.createQuotation;
};

const read = async (id) =>
  (
    await gql(
      `query { quotation(filter: { id: { eq: "${id}" } }) { id name status version } }`,
    )
  ).data.quotation;

(async () => {
  const rowA = await createDraft(`S2R5-integrity-A-${Date.now()}`);

  console.log(
    dockerNode(`
const fs = require('fs');
const src = ${JSON.stringify(SERVICE)};
fs.copyFileSync(src, ${JSON.stringify(BACKUP)});
let t = fs.readFileSync(src, 'utf8');
const marker = 'R5_THROW_AFTER_ATOMIC_APPLY';
if (!t.includes(marker)) {
  const start = t.indexOf('async assertQuotationUpdateAllowed');
  const end = t.indexOf('async assertQuotationDeleteAllowed', start);
  if (start < 0 || end < 0) throw new Error('method bounds missing');
  const method = t.slice(start, end);
  if (!method.includes('runInWorkspaceTransaction')) throw new Error('atomic TX missing');
  const replaced = method.replace(
    /\\}, authContext\\);\\s*$/m,
    "}, authContext);\\n        // " + marker + "\\n        throw new Error('" + marker + "');\\n    ",
  );
  t = t.slice(0, start) + replaced + t.slice(end);
  fs.writeFileSync(src, t);
}
console.log('patched-after-apply');
`),
  );
  await restart();

  const failA = await gql(`mutation {
    updateQuotation(id: "${rowA.id}", data: {
      name: "atomic-name"
      status: PENDING_INTERNAL_APPROVAL
      version: ${rowA.version}
    }) { id name status version }
  }`);
  const afterA = await read(rowA.id);
  console.log('after-apply-throw', {
    errors: failA.errors?.map((error) => error.message),
    afterA,
  });

  console.log(
    dockerNode(`
const fs = require('fs');
fs.copyFileSync(${JSON.stringify(BACKUP)}, ${JSON.stringify(SERVICE)});
console.log('restored');
`),
  );
  await restart();

  if (
    afterA.name !== 'atomic-name' ||
    afterA.status !== 'PENDING_INTERNAL_APPROVAL' ||
    afterA.version !== rowA.version + 1
  ) {
    console.error('FAIL consistent-after-apply-throw', afterA);
    process.exit(1);
  }
  console.log('PASS consistent-after-apply-throw');

  const rowB = await createDraft(`S2R5-integrity-B-${Date.now()}`);
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      gql(`mutation {
        updateQuotation(id: "${rowB.id}", data: { name: "race-${index}", version: ${rowB.version} }) {
          id name version
        }
      }`),
    ),
  );
  const wins = results.filter((result) => !!result.data?.updateQuotation);
  if (wins.length !== 1) {
    console.error('FAIL concurrent-single-winner', wins.length, results);
    process.exit(1);
  }
  console.log('PASS concurrent-single-winner');
  console.log('S2_R5_INTEGRITY_PASS');
})().catch(async (error) => {
  console.error(error);
  try {
    dockerNode(`
const fs = require('fs');
if (fs.existsSync(${JSON.stringify(BACKUP)})) {
  fs.copyFileSync(${JSON.stringify(BACKUP)}, ${JSON.stringify(SERVICE)});
}
`);
    await restart();
  } catch {
    // ignore
  }
  process.exit(1);
});
