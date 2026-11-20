// Proves that a non-draft quotation rejects content writes and out-of-lifecycle
// status changes on the server, and that the operator only ever sees Persian copy.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];

if (!remote?.apiUrl || String(remote.apiUrl).includes('6080')) {
  console.error('refuse: missing or intranet remote');
  process.exit(2);
}

const apiBase = remote.apiUrl.replace(/\/$/, '');
const token = remote.apiKey;

const gql = async (query) => {
  const response = await fetch(`${apiBase}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  return response.json();
};

const action = async (body) => {
  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return response.json();
};

const PERSIAN = /[\u0600-\u06FF]/;
const ASCII_SHOUT = /\b[A-Z]{4,}(_[A-Z]+)+\b/;

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const readQuotation = async (quotationId) => {
  const payload = await gql(`{
    quotation(filter: { id: { eq: "${quotationId}" } }) {
      id
      name
      status
      version
      quotationNumber
      totalExact
      updatedAt
    }
  }`);
  return payload.data?.quotation;
};

const main = async () => {
  const quotationId = process.argv[2];

  assert(quotationId, 'usage: node dev-verify-crm129-locked-guard.cjs <quotationId>');

  const before = await readQuotation(quotationId);
  assert(before, 'quotation not found');
  assert(before.status !== 'DRAFT', `expected a locked quotation, got ${before.status}`);

  const contentWrite = await gql(`mutation {
    updateQuotation(
      id: "${quotationId}"
      data: { name: "locked-content-write-probe", version: ${before.version} }
    ) { id name version }
  }`);

  const contentError = contentWrite.errors?.[0];
  assert(contentError, 'server accepted a content write on a locked quotation');
  assert(
    PERSIAN.test(contentError.extensions?.userFriendlyMessage ?? ''),
    `missing Persian userFriendlyMessage: ${JSON.stringify(contentError.extensions)}`,
  );
  assert(
    !ASCII_SHOUT.test(contentError.message ?? '') ||
      PERSIAN.test(contentError.extensions.userFriendlyMessage),
    'operator copy is not Persian',
  );

  const afterContentAttempt = await readQuotation(quotationId);
  assert(afterContentAttempt.name === before.name, 'name changed on a locked quotation');
  assert(
    Number(afterContentAttempt.version) === Number(before.version),
    'version changed on a locked quotation',
  );
  assert(
    Number(afterContentAttempt.totalExact) === Number(before.totalExact),
    'total changed on a locked quotation',
  );

  const illegalTransition = await action({
    action: 'transition',
    quotationId,
    toStatus: 'DRAFT',
    version: before.version,
  });

  assert(illegalTransition.success === false, 'server accepted a DRAFT rollback');
  assert(
    PERSIAN.test(illegalTransition.message ?? ''),
    `transition failure is not Persian: ${JSON.stringify(illegalTransition)}`,
  );
  assert(
    !ASCII_SHOUT.test(illegalTransition.message ?? ''),
    `transition failure leaks a machine code: ${illegalTransition.message}`,
  );

  const afterTransitionAttempt = await readQuotation(quotationId);
  assert(
    afterTransitionAttempt.status === before.status,
    `status changed after a rejected transition: ${afterTransitionAttempt.status}`,
  );

  console.log(
    JSON.stringify(
      {
        result: 'CRM129_LOCKED_GUARD_PASS',
        quotationId,
        status: before.status,
        version: before.version,
        contentWriteCode: contentError.extensions?.code ?? null,
        contentWriteMessage: contentError.extensions?.userFriendlyMessage,
        illegalTransitionCode: illegalTransition.code,
        illegalTransitionMessage: illegalTransition.message,
        statusAfterAttempts: afterTransitionAttempt.status,
        versionAfterAttempts: afterTransitionAttempt.version,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error('FAIL', error.message);
  process.exit(1);
});
