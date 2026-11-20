// CRM-129: four quotations approved at the same instant must receive four distinct
// document numbers. Duplicates are the failure the numbering protocol exists to
// prevent, and a serial allocator hides under concurrency exactly like a broken one,
// so the approvals are issued in parallel on purpose.
//
// Usage: node scripts/dev-exercise-crm129-numbering-race.cjs
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const gql = async (query) => {
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

    await sleep(900);
  }

  throw new Error('GraphQL rate limited after retries');
};

const postApp = async (route, body) => {
  const response = await fetch(`${apiBase}/s${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();

  try {
    return text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return { success: false, raw: text };
  }
};

const callAction = async (body) => {
  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();

  try {
    return text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return { success: false, raw: text };
  }
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const RACERS = 4;

const createDraft = async ({ personId, stamp, index }) => {
  const draft = await postApp('/quotation/save-draft', {
    status: 'DRAFT',
    customerType: 'PERSON',
    personId,
    companyId: null,
    name: `CRM129-number-race-${stamp}-${index}`,
    paymentTerms: 'نقد',
    taxPolicy: 'IR_VAT_9',
    displayMoneyUnit: 'RIAL',
    documentDiscountKind: 'NONE',
    documentDiscountPercentText: '',
    documentDiscountAmountText: '',
    lines: [
      {
        clientLineId: 'l1',
        catalogItemId: null,
        kind: 'SERVICE',
        name: `رقابتی ${index}`,
        description: '',
        unit: 'عدد',
        quantityText: '1',
        unitPriceText: '1000',
        moneyUnit: 'RIAL',
        discountKind: 'AMOUNT',
        discountPercentText: '',
        discountAmountText: '',
      },
    ],
  });

  assert(draft.success === true, `save-draft ${index} failed: ${JSON.stringify(draft)}`);
  assert(typeof draft.quotationId === 'string', `draft ${index} has no id`);

  return draft.quotationId;
};

const advance = async (quotationId, toStatus) => {
  const lifecycle = await callAction({ action: 'get-lifecycle', quotationId });
  assert(lifecycle.success === true, `lifecycle failed for ${quotationId}`);

  const result = await callAction({
    action: 'transition',
    quotationId,
    toStatus,
    version: lifecycle.lifecycle.version,
  });

  assert(
    result.success === true,
    `transition ${toStatus} failed for ${quotationId}: ${JSON.stringify(result)}`,
  );
};

const main = async () => {
  const stamp = Date.now();
  const people = await gql(`{ people(first: 1) { edges { node { id } } } }`);
  const personId = people.data?.people?.edges?.[0]?.node?.id;

  assert(personId, 'need one person');

  const quotationIds = [];

  for (let index = 0; index < RACERS; index += 1) {
    quotationIds.push(await createDraft({ personId, stamp, index }));
  }

  for (const quotationId of quotationIds) {
    await advance(quotationId, 'PENDING_INTERNAL_APPROVAL');
  }

  // The race: every approval hits the sequence row in the same instant.
  const approvals = await Promise.all(
    quotationIds.map((quotationId) =>
      callAction({ action: 'get-lifecycle', quotationId }).then((lifecycle) =>
        callAction({
          action: 'transition',
          quotationId,
          toStatus: 'READY_TO_SEND',
          version: lifecycle.lifecycle.version,
        }),
      ),
    ),
  );

  approvals.forEach((approval, index) => {
    assert(
      approval.success === true,
      `parallel approval ${index} failed: ${JSON.stringify(approval)}`,
    );
  });

  const idsLiteral = quotationIds.map((id) => `"${id}"`).join(', ');
  const stored = await gql(`{
    quotations(filter: { id: { in: [${idsLiteral}] } }) {
      edges { node { id quotationNumber quotationNumberLabel status } }
    }
  }`);
  const rows = stored.data?.quotations?.edges?.map((edge) => edge.node) ?? [];

  assert(rows.length === RACERS, `expected ${RACERS} rows, got ${rows.length}`);

  const numbers = rows.map((row) => row.quotationNumber);
  const distinct = new Set(numbers);

  assert(!numbers.includes(null), `a racer issued without a number: ${JSON.stringify(numbers)}`);
  assert(
    distinct.size === RACERS,
    `duplicate document numbers: ${JSON.stringify(numbers)}`,
  );

  const sequences = numbers
    .map((number) => Number(number.split('-')[2]))
    .sort((left, right) => left - right);

  assert(
    sequences.every((sequence, index) =>
      index === 0 ? true : sequence === sequences[index - 1] + 1,
    ),
    `allocated numbers are not consecutive (gaps allowed, but not here): ${sequences}`,
  );

  rows.forEach((row) => {
    assert(row.status === 'READY_TO_SEND', `racer not issued: ${row.status}`);
    assert(
      row.quotationNumberLabel ===
        row.quotationNumber.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]),
      `persian label mismatch: ${row.quotationNumberLabel}`,
    );
  });

  // Re-issuing must never mint a second identity: SENT keeps the same number.
  const first = rows[0];
  await advance(first.id, 'SENT');
  const afterSent = await gql(`{
    quotation(filter: { id: { eq: "${first.id}" } }) {
      status quotationNumber quotationNumberLabel
    }
  }`);
  const sent = afterSent.data?.quotation;

  assert(sent.status === 'SENT', `expected SENT, got ${sent.status}`);
  assert(
    sent.quotationNumber === first.quotationNumber,
    `number changed on send: ${first.quotationNumber} -> ${sent.quotationNumber}`,
  );

  console.log(
    JSON.stringify(
      {
        racers: RACERS,
        numbers,
        sequences,
        distinct: distinct.size,
        sentKeepsNumber: sent.quotationNumber,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(`FAILED: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
