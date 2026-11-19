const fs = require('node:fs');
const path = require('node:path');

const config = JSON.parse(
  fs.readFileSync(
    path.join(process.env.USERPROFILE, '.twenty', 'config.json'),
    'utf8',
  ),
);
const remote = config.remotes['dev-crm129'];

if (!remote?.apiUrl || String(remote.apiUrl).includes('6080')) {
  console.error('Refusing: remote is not isolated Dev :3002');
  process.exit(2);
}

const endpoint = `${remote.apiUrl.replace(/\/$/, '')}/graphql`;
const adminToken = remote.apiKey;
const createdQuotationIds = [];

const gql = async (query, token = adminToken) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  return response.json();
};

const assert = (label, condition, detail) => {
  if (!condition) {
    console.error('FAIL', label, detail);
    process.exit(1);
  }
  console.log('PASS', label);
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
    }) { id status version }
  }`);
  assert(`create:${name}`, !!created.data?.createQuotation?.id, created);
  createdQuotationIds.push(created.data.createQuotation.id);
  return created.data.createQuotation;
};

const readQuotation = async (id, token = adminToken) => {
  const result = await gql(
    `query { quotation(filter: { id: { eq: "${id}" } }) { id name status version } }`,
    token,
  );
  return result.data?.quotation;
};

const main = async () => {
  // --- concurrent same-version writers: at most one success ---
  const raceRow = await createDraft(`S2R4-race-${Date.now()}`);
  const raceResults = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      gql(`mutation {
        updateQuotation(id: "${raceRow.id}", data: { name: "race-${index}", version: ${raceRow.version} }) {
          id name version
        }
      }`),
    ),
  );
  const raceWins = raceResults.filter((result) => !!result.data?.updateQuotation);
  assert('concurrent-single-winner', raceWins.length === 1, {
    wins: raceWins.length,
    errors: raceResults
      .filter((result) => result.errors)
      .map((result) => result.errors[0].message),
  });

  // --- empty / bad version cannot bypass ---
  const bypassRow = await createDraft(`S2R4-bypass-${Date.now()}`);
  const noVersion = await gql(`mutation {
    updateQuotation(id: "${bypassRow.id}", data: { name: "x" }) { id }
  }`);
  assert(
    'missing-version-blocked',
    Array.isArray(noVersion.errors) &&
      noVersion.errors[0].message.includes('VERSION'),
    noVersion,
  );
  const badVersion = await gql(`mutation {
    updateQuotation(id: "${bypassRow.id}", data: { name: "x", version: 999 }) { id }
  }`);
  assert(
    'stale-version-blocked',
    Array.isArray(badVersion.errors) &&
      badVersion.errors[0].message.includes('VERSION_CONFLICT'),
    badVersion,
  );

  // --- status + line race: line must not land on frozen quotation ---
  const freezeRow = await createDraft(`S2R4-freeze-${Date.now()}`);
  let freezeVersion = freezeRow.version;
  for (const status of ['PENDING_INTERNAL_APPROVAL', 'READY_TO_SEND']) {
    const stepped = await gql(`mutation {
      updateQuotation(id: "${freezeRow.id}", data: { status: ${status}, version: ${freezeVersion} }) {
        id status version
      }
    }`);
    assert(`step-${status}`, !!stepped.data?.updateQuotation, stepped);
    freezeVersion = stepped.data.updateQuotation.version;
  }

  const [sentResult, lineResult] = await Promise.all([
    gql(`mutation {
      updateQuotation(id: "${freezeRow.id}", data: { status: SENT, version: ${freezeVersion} }) {
        id status version
      }
    }`),
    gql(`mutation {
      createQuotationLine(data: {
        name: "race-line"
        kind: PRODUCT
        unit: "pcs"
        quantityExact: "1.000000"
        unitPriceExact: "1.000000"
        discountExact: "0.000000"
        taxExact: "0.000000"
        totalExact: "1.000000"
        sortOrder: 0
        quotationId: "${freezeRow.id}"
      }) { id }
    }`),
  ]);

  const sentOk = !!sentResult.data?.updateQuotation;
  const lineOk = !!lineResult.data?.createQuotationLine;
  assert(
    'status-line-race-not-both',
    !(sentOk && lineOk),
    { sentResult, lineResult },
  );
  const afterFreeze = await readQuotation(freezeRow.id);
  if (afterFreeze?.status === 'SENT') {
    assert('sent-after-race', true);
    assert(
      'no-line-on-sent-after-race',
      !lineOk,
      lineResult,
    );
  } else {
    assert('line-won-status-blocked-or-retried', lineOk || !sentOk, {
      afterFreeze,
      sentResult,
      lineResult,
    });
  }

  // --- SENT content still blocked ---
  let sentId = freezeRow.id;
  let sentVersion = afterFreeze?.version;
  if (afterFreeze?.status !== 'SENT') {
    const draft = await createDraft(`S2R4-sent-${Date.now()}`);
    let version = draft.version;
    for (const status of [
      'PENDING_INTERNAL_APPROVAL',
      'READY_TO_SEND',
      'SENT',
    ]) {
      const stepped = await gql(`mutation {
        updateQuotation(id: "${draft.id}", data: { status: ${status}, version: ${version} }) {
          id status version
        }
      }`);
      assert(`sent-setup-${status}`, !!stepped.data?.updateQuotation, stepped);
      version = stepped.data.updateQuotation.version;
    }
    sentId = draft.id;
    sentVersion = version;
  }
  const mutateSent = await gql(`mutation {
    updateQuotation(id: "${sentId}", data: { name: "hacked", version: ${sentVersion} }) { id name }
  }`);
  assert(
    'sent-content-blocked',
    Array.isArray(mutateSent.errors),
    mutateSent,
  );

  // Role-limited checks live in dev-exercise-s2-r4-roles.cjs (real roleTarget swap).

  // --- cleanup mutable experimental rows; preserve seed person ---
  const seedProbe = await gql(`{
    people(first: 1) { edges { node { id name { firstName lastName } } } }
  }`);
  const seedPersonId = seedProbe.data.people.edges[0].node.id;

  for (const id of createdQuotationIds) {
    const row = await readQuotation(id);
    if (
      row &&
      (row.status === 'DRAFT' || row.status === 'PENDING_INTERNAL_APPROVAL')
    ) {
      await gql(`mutation { deleteQuotation(id: "${id}") { id } }`);
    }
  }

  const seedAfter = await gql(`{
    person(filter: { id: { eq: "${seedPersonId}" } }) { id }
  }`);
  assert(
    'seed-person-preserved',
    seedAfter.data?.person?.id === seedPersonId,
    seedAfter,
  );

  console.log('S2_R4_CONCURRENCY_PASS');
  console.log('ROLE_SUITE=dev-exercise-s2-r4-roles.cjs');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
