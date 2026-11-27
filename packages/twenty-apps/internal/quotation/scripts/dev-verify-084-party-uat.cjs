// Goal 084 PARTY_UAT on a fresh isolated workspace. Evidence only.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const evidenceDir = path.resolve(
  __dirname,
  '../../../../../docs/architecture/goal-037/verification-084',
);
const fresh = JSON.parse(
  fs.readFileSync(path.join(evidenceDir, 'fresh-workspace.json'), 'utf8'),
);
const apiBase = String(fresh.apiBase).replace(/\/$/, '');
// apply-parties requires authContext.type === 'user' (not apiKey).
const adminToken = fresh.accessToken;
if (!adminToken) {
  console.error('fresh accessToken missing — re-run exchange');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimited = (payload) => {
  if (payload?.data?.code === 'RATE_LIMITED') return true;
  const errors = payload?.errors;
  if (!Array.isArray(errors)) return false;
  return errors.some(
    (error) =>
      error?.extensions?.code === 'RATE_LIMITED' ||
      String(error?.message ?? '').includes('Rate limit'),
  );
};

const retryAfterMs = (payload) => {
  const fromBody = Number(payload?.data?.retryAfterMs);
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;
  const errors = payload?.errors;
  if (!Array.isArray(errors)) return 1200;
  const fromError = Number(
    errors.find((error) => error?.extensions?.retryAfterMs)?.extensions
      ?.retryAfterMs,
  );
  return Number.isFinite(fromError) && fromError > 0 ? fromError : 1200;
};

const post = async (token, body) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(`${apiBase}/rest/quotation/actions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }
    if (!isRateLimited({ data }) && response.status !== 429) {
      return { status: response.status, data };
    }
    await sleep(Math.max(retryAfterMs({ data }), 700) * (attempt + 1));
  }
  return { status: 429, data: { success: false, code: 'RATE_LIMITED' } };
};

const gql = async (token, query, variables) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await fetch(`${apiBase}/graphql`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    const payload = await response.json();
    if (!isRateLimited(payload)) return payload;
    await sleep(Math.max(retryAfterMs(payload), 700) * (attempt + 1));
  }
  return {
    errors: [{ message: 'Rate limit exceeded after retries', extensions: { code: 'RATE_LIMITED' } }],
  };
};

const sanitizeErrors = (payload) => {
  const errors = payload?.errors;
  if (!Array.isArray(errors)) return null;
  return errors.map((error) => ({
    message: String(error?.message ?? '').slice(0, 240),
    code: error?.extensions?.code ?? null,
  }));
};

const fixtureRow = (number) => {
  const person = number <= 60;
  const serial = String(number).padStart(6, '0');
  const national = number % 5 === 0 ? null : (person ? '9900' : '99000') + serial;
  const mobile =
    number % 10 === 0 && ((number > 30 && number <= 60) || number > 80)
      ? null
      : '091299' + String(number).padStart(5, '0');
  return {
    number,
    serial,
    person,
    externalPartyId: 'UAT-' + serial,
    firstName: 'آزمون',
    lastName: 'مشتری ' + serial,
    companyName: 'شرکت آزمون ' + serial,
    nationalCode: person ? national : null,
    legalNationalId: person ? null : national,
    economicCode:
      number % 5 === 0 && number % 10 !== 0 ? '990099' + serial : null,
    mobile,
    strongId: Boolean(national),
  };
};

const phoneInput = (mobile) => {
  if (!mobile) return undefined;
  const digits = mobile.replace(/\D/g, '');
  const national = digits.startsWith('98')
    ? digits.slice(2)
    : digits.startsWith('0')
      ? digits.slice(1)
      : digits;
  return {
    primaryPhoneNumber: national,
    primaryPhoneCountryCode: 'IR',
    primaryPhoneCallingCode: '+98',
  };
};

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const summarizeOutcome = (outcome) => {
  if (!outcome || typeof outcome !== 'object') return outcome ?? null;
  const refused = Array.isArray(outcome.refused) ? outcome.refused : [];
  const reasons = {};
  for (const row of refused) {
    const detail = String(row.detail ?? '');
    const reason = detail.includes(': ')
      ? detail.split(': ').slice(-1)[0]
      : detail;
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  return {
    createdLinks: outcome.createdLinks ?? 0,
    updatedLinks: outcome.updatedLinks ?? 0,
    createdParties: outcome.createdParties ?? 0,
    refusedCount: refused.length,
    refusedCodes: Object.fromEntries(
      refused.reduce((acc, row) => {
        acc.set(row.code, (acc.get(row.code) ?? 0) + 1);
        return acc;
      }, new Map()),
    ),
    refusedReasons: reasons,
    sampleRefused: refused.slice(0, 12).map((row) => ({
      externalPartyId: row.externalPartyId,
      code: row.code,
      detail: row.detail,
    })),
  };
};

const previewAll = async (connectionId) => {
  const allRows = [];
  let cursor;
  for (let page = 0; page < 20; page += 1) {
    const preview = await post(adminToken, {
      action: 'accounting-import-preview-parties-page',
      connectionId,
      pageSize: 25,
      search: '',
      refresh: page === 0,
      ...(cursor ? { cursor } : {}),
    });
    const rows = preview.data?.page?.rows ?? [];
    allRows.push(...rows);
    if (page === 0 && preview.data?.success === false) {
      return { error: preview.data, rows: allRows };
    }
    cursor = preview.data?.page?.nextCursor;
    if (!cursor || rows.length === 0) break;
  }
  return {
    rowCount: allRows.length,
    decisions: allRows.reduce((acc, row) => {
      acc[row.decision] = (acc[row.decision] ?? 0) + 1;
      return acc;
    }, {}),
    rows: allRows,
  };
};

const selectionsFrom = (rows) =>
  rows
    .filter((row) =>
      ['NEEDS_CRM_RECORD', 'LINK_SUGGESTED', 'REMOTE_CHANGED', 'IN_SYNC'].includes(
        row.decision,
      ),
    )
    .map((row) =>
      row.suggestedInternalPartyId
        ? {
            externalPartyId: row.externalPartyId,
            internalPartyId: row.suggestedInternalPartyId,
            createNew: true,
          }
        : { externalPartyId: row.externalPartyId, createNew: true },
    );

const applyBatches = async (connectionId, selections) => {
  const batches = [];
  const totals = {
    createdLinks: 0,
    updatedLinks: 0,
    createdParties: 0,
    refused: [],
  };
  for (const batch of chunk(selections, 25)) {
    const result = await post(adminToken, {
      action: 'accounting-import-apply-parties',
      connectionId,
      selections: batch,
      allowRemoteVersionUpdate: true,
    });
    const outcome = result.data?.outcome;
    batches.push({
      size: batch.length,
      success: result.data?.success,
      code: result.data?.code,
      message: result.data?.message,
      outcome: summarizeOutcome(outcome),
    });
    if (outcome) {
      totals.createdLinks += outcome.createdLinks ?? 0;
      totals.updatedLinks += outcome.updatedLinks ?? 0;
      totals.createdParties += outcome.createdParties ?? 0;
      totals.refused.push(...(outcome.refused ?? []));
    }
  }
  return {
    batches,
    totals: {
      ...totals,
      refusedCount: totals.refused.length,
      refusedCodes: Object.fromEntries(
        totals.refused.reduce((acc, row) => {
          acc.set(row.code, (acc.get(row.code) ?? 0) + 1);
          return acc;
        }, new Map()),
      ),
      refusedReasons: summarizeOutcome({ refused: totals.refused }).refusedReasons,
      sampleRefused: totals.refused.slice(0, 12).map((row) => ({
        externalPartyId: row.externalPartyId,
        code: row.code,
        detail: row.detail,
      })),
    },
  };
};

const countMatches = async () => {
  const codes = [];
  for (let i = 1; i <= 100; i += 1) {
    const row = fixtureRow(i);
    if (row.nationalCode) codes.push({ object: 'person', code: row.nationalCode });
    if (row.legalNationalId)
      codes.push({ object: 'company', code: row.legalNationalId });
  }
  let active = 0;
  let deleted = 0;
  for (const entry of codes) {
    const root = entry.object === 'person' ? 'people' : 'companies';
    const live = await gql(
      adminToken,
      `query($code:String!){ ${root}(filter:{nationalCode:{eq:$code}},first:5){edges{node{id}}}}`,
      { code: entry.code },
    );
    active += live?.data?.[root]?.edges?.length ?? 0;
    const soft = await gql(
      adminToken,
      `query($code:String!){ ${root}(filter:{and:[{nationalCode:{eq:$code}},{deletedAt:{is:NOT_NULL}}]},first:5){edges{node{id}}}}`,
      { code: entry.code },
    );
    // soft filter may be unsupported; ignore errors
    if (!soft.errors) deleted += soft?.data?.[root]?.edges?.length ?? 0;
  }
  const links = await gql(
    adminToken,
    `query { accountingPartyLinks(first:1){ totalCount } }`,
  );
  return {
    strongCodeActiveHits: active,
    strongCodeDeletedHits: deleted,
    accountingPartyLinks: links?.data?.accountingPartyLinks?.totalCount ?? null,
    linkErrors: sanitizeErrors(links),
  };
};

(async () => {
  const out = {
    apiBase,
    workspaceId: fresh.workspaceId,
    email: fresh.email,
    startedAt: new Date().toISOString(),
    precondition: {},
    connection: {},
    seed: { people: 0, companies: 0, errors: [] },
    fourOps: {},
    preview: {},
    apply1: {},
    apply2: {},
    concurrent: {},
    stalePlan: {},
    tombstone: {},
    rollback: {},
    security: {},
    persistence: {},
    counts: {},
    regression: {},
  };

  out.precondition = await countMatches();

  const stamp = Date.now().toString().slice(-6);
  const save = await post(adminToken, {
    action: 'accounting-connection-save',
    name: `PARTY_UAT 084 ${stamp}`,
    adapterId: 'mock',
    settings: {
      baseUrl: 'http://mock.invalid',
      remoteUserId: '',
      defaultStorageId: '',
      moneyUnit: 'RIAL',
      transportApproved: false,
      specialCodes: { discount: false, duty: false, tax: false },
      financial: {
        baseCurrency: 'IRR',
        currencyMappings: {},
        conversionRate: '',
        mockProfile: 'PARTY_UAT',
      },
    },
  });
  const connections = save.data?.connections ?? [];
  const created =
    connections.find((row) =>
      String(row.name ?? '').includes(`PARTY_UAT 084 ${stamp}`),
    ) ?? connections[0];
  const connectionId = created?.recordId ?? null;
  out.connection = {
    success: save.data?.success === true,
    connectionId,
    name: created?.name ?? null,
    code: save.data?.code ?? null,
    message: save.data?.message ?? null,
    profile: created?.settings?.financial?.mockProfile ?? null,
  };
  if (!connectionId) {
    fs.writeFileSync(path.join(evidenceDir, 'party-uat.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  await post(adminToken, {
    action: 'accounting-connection-set-default',
    recordId: connectionId,
  });

  // Seed existing: persons 1-30 and companies 61-80
  for (const row of [
    ...Array.from({ length: 30 }, (_, i) => fixtureRow(i + 1)),
    ...Array.from({ length: 20 }, (_, i) => fixtureRow(61 + i)),
  ]) {
    if (row.person) {
      const data = {
        name: {
          firstName: row.strongId ? 'قدیمی' : row.firstName,
          lastName: row.strongId ? `پیشین ${row.serial}` : row.lastName,
        },
        ...(row.nationalCode ? { nationalCode: row.nationalCode } : {}),
        ...(row.economicCode ? { economicCode: row.economicCode } : {}),
        ...(phoneInput(
          row.strongId && row.mobile ? row.mobile.replace(/9$/, '8') : row.mobile,
        )
          ? {
              phones: phoneInput(
                row.strongId && row.mobile
                  ? row.mobile.replace(/9$/, '8')
                  : row.mobile,
              ),
            }
          : {}),
      };
      const createdPerson = await gql(
        adminToken,
        `mutation($data: PersonCreateInput!) { createPerson(data: $data) { id } }`,
        { data },
      );
      if (createdPerson?.data?.createPerson?.id) out.seed.people += 1;
      else {
        // Prior partial runs may already hold the unique nationalCode.
        const existing = row.nationalCode
          ? await gql(
              adminToken,
              `query($code:String!){ people(filter:{nationalCode:{eq:$code}},first:1){edges{node{id}}}}`,
              { code: row.nationalCode },
            )
          : null;
        if (existing?.data?.people?.edges?.[0]?.node?.id) out.seed.people += 1;
        else
          out.seed.errors.push({
            row: row.externalPartyId,
            errors: sanitizeErrors(createdPerson),
          });
      }
    } else {
      const mobile =
        row.strongId && row.mobile ? row.mobile.replace(/9$/, '7') : row.mobile;
      const data = {
        name: row.strongId ? `شرکت قدیمی ${row.serial}` : row.companyName,
        ...(row.legalNationalId ? { nationalCode: row.legalNationalId } : {}),
        ...(row.economicCode ? { economicCode: row.economicCode } : {}),
        ...(mobile ? { accountingMobile: mobile } : {}),
      };
      const createdCompany = await gql(
        adminToken,
        `mutation($data: CompanyCreateInput!) { createCompany(data: $data) { id } }`,
        { data },
      );
      if (createdCompany?.data?.createCompany?.id) out.seed.companies += 1;
      else {
        const existing = row.legalNationalId
          ? await gql(
              adminToken,
              `query($code:String!){ companies(filter:{nationalCode:{eq:$code}},first:1){edges{node{id}}}}`,
              { code: row.legalNationalId },
            )
          : null;
        if (existing?.data?.companies?.edges?.[0]?.node?.id)
          out.seed.companies += 1;
        else
          out.seed.errors.push({
            row: row.externalPartyId,
            errors: sanitizeErrors(createdCompany),
          });
      }
    }
    // Pace GraphQL writes under Dev rate limits.
    if (row.number % 10 === 0) await sleep(400);
  }

  const peopleBefore = await gql(adminToken, `query { people(first: 1) { totalCount } }`);
  const companiesBefore = await gql(adminToken, `query { companies(first: 1) { totalCount } }`);
  out.counts.before = {
    people: peopleBefore?.data?.people?.totalCount,
    companies: companiesBefore?.data?.companies?.totalCount,
  };

  const preview1 = await previewAll(connectionId);
  out.preview = {
    rowCount: preview1.rowCount,
    decisions: preview1.decisions,
    error: preview1.error ?? null,
    selectionCount: selectionsFrom(preview1.rows ?? []).length,
  };

  // Four ops
  const personUpdate = (preview1.rows ?? []).find(
    (r) => r.decision === 'LINK_SUGGESTED' && r.partyType === 'PERSON',
  );
  const companyUpdate = (preview1.rows ?? []).find(
    (r) => r.decision === 'LINK_SUGGESTED' && r.partyType === 'COMPANY',
  );
  const personCreate = (preview1.rows ?? []).find(
    (r) => r.decision === 'NEEDS_CRM_RECORD' && r.partyType === 'PERSON',
  );
  const companyCreate = (preview1.rows ?? []).find(
    (r) => r.decision === 'NEEDS_CRM_RECORD' && r.partyType === 'COMPANY',
  );
  const one = async (label, selection) => {
    if (!selection) return { label, skipped: true };
    const result = await post(adminToken, {
      action: 'accounting-import-apply-parties',
      connectionId,
      selections: [selection],
      allowRemoteVersionUpdate: true,
    });
    return {
      label,
      success: result.data?.success,
      outcome: summarizeOutcome(result.data?.outcome),
      refused: result.data?.outcome?.refused?.[0] ?? null,
    };
  };
  out.fourOps.personUpdate = await one(
    'Person update',
    personUpdate
      ? {
          externalPartyId: personUpdate.externalPartyId,
          internalPartyId: personUpdate.suggestedInternalPartyId,
          createNew: true,
        }
      : null,
  );
  out.fourOps.companyUpdate = await one(
    'Company update',
    companyUpdate
      ? {
          externalPartyId: companyUpdate.externalPartyId,
          internalPartyId: companyUpdate.suggestedInternalPartyId,
          createNew: true,
        }
      : null,
  );
  out.fourOps.personCreate = await one(
    'Person create',
    personCreate
      ? { externalPartyId: personCreate.externalPartyId, createNew: true }
      : null,
  );
  out.fourOps.companyCreate = await one(
    'Company create',
    companyCreate
      ? { externalPartyId: companyCreate.externalPartyId, createNew: true }
      : null,
  );

  // Fresh preview after four ops for full matrix
  const previewFresh = await previewAll(connectionId);
  const freshSelections = selectionsFrom(previewFresh.rows ?? []);
  out.previewFresh = {
    rowCount: previewFresh.rowCount,
    decisions: previewFresh.decisions,
    selectionCount: freshSelections.length,
  };

  // Stale: mutate then apply old selection (Nest re-prepares — record outcome)
  const linkCandidate = freshSelections.find((row) => row.internalPartyId);
  if (linkCandidate?.internalPartyId) {
    await gql(
      adminToken,
      `mutation($id:UUID!,$data:PersonUpdateInput!){ updatePerson(id:$id, data:$data){ id updatedAt } }`,
      {
        id: linkCandidate.internalPartyId,
        data: { name: { firstName: 'کهنه', lastName: `طرح${stamp}` } },
      },
    );
    const stale = await post(adminToken, {
      action: 'accounting-import-apply-parties',
      connectionId,
      selections: [linkCandidate],
      allowRemoteVersionUpdate: true,
    });
    out.stalePlan = {
      note: 'Nest discards caller plan and re-prepares; outcome recorded as observed.',
      success: stale.data?.success,
      outcome: summarizeOutcome(stale.data?.outcome),
      code: stale.data?.code,
    };
  }

  const previewAfterStale = await previewAll(connectionId);
  const selections = selectionsFrom(previewAfterStale.rows ?? []);

  // Concurrent create on same missing row
  const createOnly = selections.filter((row) => !row.internalPartyId).slice(0, 1);
  if (createOnly.length === 1) {
    const [c1, c2] = await Promise.all([
      post(adminToken, {
        action: 'accounting-import-apply-parties',
        connectionId,
        selections: createOnly,
        allowRemoteVersionUpdate: true,
      }),
      post(adminToken, {
        action: 'accounting-import-apply-parties',
        connectionId,
        selections: createOnly,
        allowRemoteVersionUpdate: true,
      }),
    ]);
    out.concurrent = {
      target: createOnly[0].externalPartyId,
      c1: summarizeOutcome(c1.data?.outcome),
      c2: summarizeOutcome(c2.data?.outcome),
    };
  }

  out.apply1 = await applyBatches(connectionId, selections);

  const peopleMid = await gql(adminToken, `query { people(first: 1) { totalCount } }`);
  const companiesMid = await gql(adminToken, `query { companies(first: 1) { totalCount } }`);
  out.counts.afterApply1 = {
    people: peopleMid?.data?.people?.totalCount,
    companies: companiesMid?.data?.companies?.totalCount,
    peopleDelta:
      (peopleMid?.data?.people?.totalCount ?? 0) -
      (peopleBefore?.data?.people?.totalCount ?? 0),
    companiesDelta:
      (companiesMid?.data?.companies?.totalCount ?? 0) -
      (companiesBefore?.data?.companies?.totalCount ?? 0),
  };

  const linksAfter1 = await gql(
    adminToken,
    `query($cid:UUID!){ accountingPartyLinks(filter:{connectionId:{eq:$cid}},first:1){ totalCount } }`,
    { cid: connectionId },
  );
  out.counts.mappingsAfterApply1 =
    linksAfter1?.data?.accountingPartyLinks?.totalCount ?? null;

  // Repeat
  const previewRepeat = await previewAll(connectionId);
  out.apply2 = await applyBatches(
    connectionId,
    selectionsFrom(previewRepeat.rows ?? []),
  );
  out.previewAfter = {
    rowCount: previewRepeat.rowCount,
    decisions: previewRepeat.decisions,
  };
  const peopleAfter = await gql(adminToken, `query { people(first: 1) { totalCount } }`);
  const companiesAfter = await gql(adminToken, `query { companies(first: 1) { totalCount } }`);
  out.counts.afterApply2 = {
    people: peopleAfter?.data?.people?.totalCount,
    companies: companiesAfter?.data?.companies?.totalCount,
    peopleDeltaVsMid:
      (peopleAfter?.data?.people?.totalCount ?? 0) -
      (peopleMid?.data?.people?.totalCount ?? 0),
    companiesDeltaVsMid:
      (companiesAfter?.data?.companies?.totalCount ?? 0) -
      (companiesMid?.data?.companies?.totalCount ?? 0),
  };

  // Tombstone: soft-delete a linked person then preview/apply that external id
  const linkedPerson = await gql(
    adminToken,
    `query($cid:UUID!){ accountingPartyLinks(filter:{and:[{connectionId:{eq:$cid}},{partyType:{eq:PERSON}}]},first:1){ edges{ node{ id externalPartyId internalPartyId } } } }`,
    { cid: connectionId },
  );
  const tomb = linkedPerson?.data?.accountingPartyLinks?.edges?.[0]?.node;
  if (tomb?.internalPartyId) {
    await gql(
      adminToken,
      `mutation($ids:[UUID!]!){ deletePeople(filter:{id:{in:$ids}}){ deletedAt } }`,
      { ids: [tomb.internalPartyId] },
    );
    const tombPreview = await post(adminToken, {
      action: 'accounting-import-preview-parties-page',
      connectionId,
      pageSize: 50,
      search: tomb.externalPartyId,
      refresh: true,
    });
    const tombRow = (tombPreview.data?.page?.rows ?? []).find(
      (row) => row.externalPartyId === tomb.externalPartyId,
    );
    const tombApply = await post(adminToken, {
      action: 'accounting-import-apply-parties',
      connectionId,
      selections: [{ externalPartyId: tomb.externalPartyId, createNew: true }],
      allowRemoteVersionUpdate: true,
    });
    out.tombstone = {
      externalPartyId: tomb.externalPartyId,
      previewDecision: tombRow?.decision ?? null,
      previewFlags: {
        deleted: tombRow?.crmDeleted === true || tombRow?.isDeleted === true,
        selectable: tombRow?.selectable,
      },
      apply: summarizeOutcome(tombApply.data?.outcome),
      refused: tombApply.data?.outcome?.refused?.[0] ?? null,
    };
  }

  // Rollback note: unit-covered; operational mapping collision if possible
  out.rollback = {
    createSucceeded: (out.apply1?.totals?.createdParties ?? 0) > 0,
    note: 'Per-row transaction rollback covered by Jest; operational mapping-ID collision not forced without unsafe DB surgery.',
  };

  // Security: outbound + browser plan inject
  out.security.outbound = await post(adminToken, {
    action: 'accounting-outbound-execute-quotation-export',
    connectionId,
    quotationId: '0a896586-2c2d-496b-b8ce-9352b2eef66b',
  }).then((result) => ({
    success: result.data?.success,
    code: result.data?.code,
    message: result.data?.message,
  }));
  out.security.browserPlanInject = await post(adminToken, {
    action: 'accounting-import-apply-parties',
    connectionId,
    selections: [{ externalPartyId: 'UAT-000041', createNew: true }],
    plan: {
      rows: [
        {
          externalPartyId: 'UAT-000041',
          internalPartyId: '00000000-0000-4000-8000-000000000099',
          action: 'CREATE',
        },
      ],
    },
  }).then((result) => ({
    success: result.data?.success,
    outcome: summarizeOutcome(result.data?.outcome),
  }));

  // Regression
  out.regression.catalog = await post(adminToken, {
    action: 'accounting-import-preview-items-page',
    connectionId,
    pageSize: 5,
    refresh: true,
  }).then((result) => ({
    success: result.data?.success,
    summary: result.data?.page?.summary,
  }));
  out.regression.documents = await post(adminToken, {
    action: 'accounting-outbound-list-exportable-quotations',
    connectionId,
    pageSize: 5,
  }).then((result) => ({
    success: result.data?.success,
    rows: result.data?.page?.rows?.length,
    code: result.data?.code,
  }));

  out.finishedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(evidenceDir, 'party-uat.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        precondition: out.precondition,
        seed: {
          people: out.seed.people,
          companies: out.seed.companies,
          errors: out.seed.errors.length,
        },
        preview: out.preview,
        previewFresh: out.previewFresh,
        fourOps: Object.fromEntries(
          Object.entries(out.fourOps).map(([k, v]) => [
            k,
            { success: v.success, outcome: v.outcome, refused: v.refused },
          ]),
        ),
        apply1: out.apply1?.totals,
        apply2: out.apply2?.totals,
        counts: out.counts,
        concurrent: out.concurrent,
        stalePlan: out.stalePlan,
        tombstone: out.tombstone,
        security: out.security,
        regression: out.regression,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
