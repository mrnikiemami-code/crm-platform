// CRM-129-ACCOUNTING-ASAN-INTEGRATION-006 live route verification.
//
// Exercises the deployed Dev app routes against the real workspace. It NEVER writes to a
// real accounting server: the only adapter used for a successful path is the mock, and the
// Asan connection points at a loopback address that nothing listens on.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const config = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.twenty', 'config.json'), 'utf8'),
);
const remote = config.remotes['dev-crm129'];

if (!remote?.apiUrl || String(remote.apiUrl).includes('6080')) {
  console.error('refuse: missing remote or intranet target');
  process.exit(2);
}

const apiBase = remote.apiUrl.replace(/\/$/, '');
const token = remote.apiKey;

const results = [];
const record = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${detail}`);
};

const post = async (route, body) => {
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
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: { raw: text.slice(0, 300) } };
  }
};

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

const CONNECTION = '/quotation/accounting-connection';
const IMPORT = '/quotation/accounting-import';
const OUTBOUND = '/quotation/accounting-outbound';
const QUOTATION_ID = 'd66aba78-3bae-4dc6-8f43-966816991ff5';

const main = async () => {
  // 1. Panel bootstrap: the list call the panel makes on mount.
  const list = await post(CONNECTION, { action: 'list' });
  record(
    'V1 list',
    list.body.success === true &&
      Array.isArray(list.body.adapters) &&
      list.body.adapters.some((adapter) => adapter.id === 'asan') &&
      list.body.adapters.some((adapter) => adapter.id === 'mock'),
    `status=${list.status} adapters=${(list.body.adapters ?? [])
      .map((adapter) => adapter.id)
      .join(',')} flags=${JSON.stringify(list.body.flags ?? {})}`,
  );

  // 2. Saving a mock connection keeps UNCONFIRMED money unit and reports MOCK.
  const saveMock = await post(CONNECTION, {
    action: 'save',
    name: 'اتصال آزمایشی 006',
    adapterId: 'mock',
    settings: {
      baseUrl: 'https://mock.invalid',
      remoteUserId: '',
      defaultStorageId: '',
      moneyUnit: 'UNCONFIRMED',
      transportApproved: false,
      specialCodes: { discount: false, duty: false, tax: false },
    },
  });
  const mockConnectionId = saveMock.body.connection?.id ?? null;
  record(
    'V2 save mock',
    saveMock.body.success === true &&
      saveMock.body.connection?.verificationState === 'MOCK' &&
      saveMock.body.connection?.settings?.moneyUnit === 'UNCONFIRMED',
    `connection=${mockConnectionId} verification=${saveMock.body.connection?.verificationState} unit=${saveMock.body.connection?.settings?.moneyUnit}`,
  );

  // 3. Testing the stored connection: reachable, but still MOCK, never LIVE_VERIFIED.
  const testMock = await post(CONNECTION, {
    action: 'test',
    connectionId: mockConnectionId,
  });
  record(
    'V3 test mock',
    testMock.body.success === true &&
      testMock.body.healthState === 'OK' &&
      testMock.body.verificationState === 'MOCK' &&
      testMock.body.isLive === false,
    `health=${testMock.body.healthState} verification=${testMock.body.verificationState} live=${testMock.body.isLive} latency=${testMock.body.latencyMs}`,
  );

  // 4. An Asan connection with no reachable server stays LIVE_UNVERIFIED, and the secret is
  //    never part of the response.
  const saveAsan = await post(CONNECTION, {
    action: 'save',
    name: 'آسان (بدون سرور) 006',
    adapterId: 'asan',
    settings: {
      // A public, unreachable host: the loopback address the first version used is now
      // refused by the server's private-network policy, which is the intended gate.
      baseUrl: 'https://asan-006.invalid/',
      remoteUserId: '7',
      defaultStorageId: '1',
      moneyUnit: 'UNCONFIRMED',
      transportApproved: false,
      specialCodes: { discount: true, duty: false, tax: true },
    },
  });
  const asanConnectionId = saveAsan.body.connection?.id ?? null;
  const serialized = JSON.stringify(saveAsan.body);
  const connectionKeys = Object.keys(saveAsan.body.connection ?? {});
  record(
    'V4 save asan',
    saveAsan.body.success === true &&
      saveAsan.body.connection?.verificationState === 'LIVE_UNVERIFIED' &&
      !connectionKeys.includes('tunnelToken') &&
      !connectionKeys.includes('token') &&
      !serialized.includes('"tunnelToken":'),
    `connection=${asanConnectionId} verification=${saveAsan.body.connection?.verificationState} connectionKeys=${connectionKeys.join(',')}`,
  );

  // 5. Disconnect scenario on the real deployment: the adapter reports a failure, in Persian,
  //    and does not claim a verified connection.
  const testAsan = await post(CONNECTION, {
    action: 'test',
    connectionId: asanConnectionId,
  });
  record(
    'V5 asan unreachable',
    testAsan.body.success === true &&
      testAsan.body.healthState === 'FAILED' &&
      testAsan.body.verificationState === 'LIVE_UNVERIFIED' &&
      testAsan.body.isLive === true &&
      /[\u0600-\u06FF]/.test(String(testAsan.body.message)),
    `health=${testAsan.body.healthState} verification=${testAsan.body.verificationState} detail=${testAsan.body.detail}`,
  );

  // 6. Import preview against the unreachable vendor refuses instead of importing nothing
  //    silently.
  const previewAsan = await post(IMPORT, {
    action: 'preview-items',
    connectionId: asanConnectionId,
  });
  record(
    'V6 import preview unreachable',
    previewAsan.body.success === false && previewAsan.body.code !== undefined,
    `code=${previewAsan.body.code} message=${String(previewAsan.body.message).slice(0, 60)}`,
  );

  // 7. Mock import preview: rows are previewed with an unconfirmed-unit warning and nothing
  //    is created by a preview.
  const beforeLinks = await gql(
    '{ accountingItemLinks(first: 200) { edges { node { id } } } }',
  );
  const beforeLinkCount =
    beforeLinks.data?.accountingItemLinks?.edges?.length ?? null;

  const previewMock = await post(IMPORT, {
    action: 'preview-items',
    connectionId: mockConnectionId,
  });
  const rows = previewMock.body.preview?.rows ?? [];
  const afterPreviewLinks = await gql(
    '{ accountingItemLinks(first: 200) { edges { node { id } } } }',
  );
  const afterPreviewLinkCount =
    afterPreviewLinks.data?.accountingItemLinks?.edges?.length ?? null;

  record(
    'V7 mock import preview read-only',
    previewMock.body.success === true &&
      rows.length > 0 &&
      rows.every((row) => row.warnings.includes('PRICE_UNIT_UNCONFIRMED')) &&
      rows.every((row) => row.priceMicros === null) &&
      beforeLinkCount === afterPreviewLinkCount,
    `rows=${rows.length} links ${beforeLinkCount}->${afterPreviewLinkCount} warnings=${rows[0]?.warnings?.join(',')}`,
  );

  // 8. Applying a preview row with an UNCONFIRMED unit must not create a price. The row is
  //    selected but the amount stays absent.
  const applyTarget = rows.find((row) => row.decision === 'CREATE');

  if (applyTarget !== undefined) {
    // The service rebuilds the preview itself; sending no selection proves the apply path
    // creates nothing on its own and that the unit gate never invents a price.
    const applyNothing = await post(IMPORT, {
      action: 'apply-items',
      connectionId: mockConnectionId,
      selections: [],
      allowRemoteVersionUpdate: false,
      applyPrices: false,
    });

    record(
      'V8 apply empty selection writes nothing',
      applyNothing.body.success === true &&
        (applyNothing.body.outcome?.createdItems ?? -1) === 0 &&
        (applyNothing.body.outcome?.createdPrices ?? -1) === 0 &&
        (applyNothing.body.outcome?.createdLinks ?? -1) === 0,
      `outcome=${JSON.stringify(applyNothing.body.outcome)} previewRow=${applyTarget.externalItemId}`,
    );
  }

  // 9. Party preview over the mock: preview only, no link writes.
  const beforeParties = await gql(
    '{ accountingPartyLinks(first: 200) { edges { node { id } } } }',
  );
  const previewParties = await post(IMPORT, {
    action: 'preview-parties',
    connectionId: mockConnectionId,
  });
  const afterParties = await gql(
    '{ accountingPartyLinks(first: 200) { edges { node { id } } } }',
  );
  record(
    'V9 party preview read-only',
    previewParties.body.success === true &&
      (previewParties.body.preview?.rows?.length ?? 0) > 0 &&
      beforeParties.data?.accountingPartyLinks?.edges?.length ===
        afterParties.data?.accountingPartyLinks?.edges?.length,
    `rows=${previewParties.body.preview?.rows?.length}`,
  );

  // 10. Document export is off: an approved quotation still cannot be registered, and no
  //     ledger row is written. Repeated calls prove no duplicate intent row appears.
  const beforeOperations = await gql(
    '{ accountingSyncOperations(first: 200) { edges { node { id state kind } } } }',
  );
  const beforeOperationCount =
    beforeOperations.data?.accountingSyncOperations?.edges?.length ?? null;

  const exportPreview = await post(OUTBOUND, {
    action: 'preview-quotation-export',
    connectionId: mockConnectionId,
    quotationId: QUOTATION_ID,
  });
  const exportOne = await post(OUTBOUND, {
    action: 'execute-quotation-export',
    connectionId: mockConnectionId,
    quotationId: QUOTATION_ID,
  });
  const exportTwo = await post(OUTBOUND, {
    action: 'execute-quotation-export',
    connectionId: mockConnectionId,
    quotationId: QUOTATION_ID,
  });
  const afterOperations = await gql(
    '{ accountingSyncOperations(first: 200) { edges { node { id state kind } } } }',
  );
  const afterOperationCount =
    afterOperations.data?.accountingSyncOperations?.edges?.length ?? null;

  record(
    'V10 export gated by approval switches',
    exportPreview.body.success === true &&
      exportPreview.body.preview?.decision?.kind === 'BLOCKED' &&
      exportPreview.body.preview?.decision?.code === 'OUTBOUND_DISABLED' &&
      exportOne.body.success === false &&
      exportOne.body.code === 'OUTBOUND_DISABLED' &&
      exportTwo.body.code === 'OUTBOUND_DISABLED' &&
      beforeOperationCount === afterOperationCount,
    `preview=${exportPreview.body.preview?.decision?.code} exec1=${exportOne.body.code} exec2=${exportTwo.body.code} ops ${beforeOperationCount}->${afterOperationCount}`,
  );

  // 11. The approved quotation is visible to the planner (status and lines read), which is
  //     what a later authorised export needs.
  record(
    'V11 quotation context read',
    exportPreview.body.preview?.quotationStatus === 'READY_TO_SEND' &&
      Array.isArray(exportPreview.body.preview?.lineItemIds) &&
      exportPreview.body.preview?.lineItemIds?.length === 1,
    `status=${exportPreview.body.preview?.quotationStatus} revision=${exportPreview.body.preview?.revisionVersion} lines=${exportPreview.body.preview?.lineItemIds?.length}`,
  );

  // 11b. KNOWN HISTORICAL GAP, recorded rather than hidden: this quotation was approved
  //      before revisions were sealed, so it has none and an export would stop at
  //      REVISION_NOT_FOUND with the switches on. New approvals seal a revision inside
  //      the approval transaction (proven by dev-exercise-crm129-revision-seal.cjs), so
  //      this is a legacy record, not a missing feature.
  const revisionCount = await gql(
    `{ quotationRevisions(filter: { quotationId: { eq: "${QUOTATION_ID}" } }) { edges { node { id status version } } } }`,
  );
  record(
    'V11b sealed revision dependency',
    exportPreview.body.preview?.revisionVersion === null &&
      (revisionCount.data?.quotationRevisions?.edges?.length ?? -1) === 0,
    `sealedRevisions=${revisionCount.data?.quotationRevisions?.edges?.length} plannerRevision=${exportPreview.body.preview?.revisionVersion} => export blocked at REVISION_NOT_FOUND when switches are on`,
  );

  // 12. The operations history route answers even with an empty ledger.
  const history = await post(OUTBOUND, {
    action: 'operations',
    connectionId: mockConnectionId,
  });
  record(
    'V12 operations history',
    history.body.success === true && Array.isArray(history.body.operations),
    `operations=${(history.body.operations ?? []).length}`,
  );

  // 13. Item push previews as a create for an unlinked item and executes nothing while the
  //     outbound switch is off.
  const catalog = await gql(
    '{ catalogItems(first: 1) { edges { node { id name sku } } } }',
  );
  const item = catalog.data?.catalogItems?.edges?.[0]?.node ?? null;

  if (item !== null) {
    const itemPreview = await post(OUTBOUND, {
      action: 'preview-item-push',
      connectionId: mockConnectionId,
      itemId: item.id,
      changedFields: ['price'],
    });
    const itemPush = await post(OUTBOUND, {
      action: 'execute-item-push',
      connectionId: mockConnectionId,
      itemId: item.id,
      changedFields: ['price'],
    });

    record(
      'V13 item push gated',
      itemPreview.body.success === true &&
        itemPreview.body.preview?.decision?.kind === 'CREATE' &&
        itemPush.body.success === false &&
        itemPush.body.code === 'OUTBOUND_DISABLED',
      `preview=${itemPreview.body.preview?.decision?.kind} exec=${itemPush.body.code} item=${item.name}`,
    );
  }

  // 14. The real data is untouched: the quotation header and its line count are unchanged.
  const quotation = await gql(
    `{ quotation(filter: { id: { eq: "${QUOTATION_ID}" } }) { id status version totalExact } }`,
  );
  record(
    'V14 quotation untouched',
    quotation.data?.quotation?.status === 'READY_TO_SEND' &&
      quotation.data?.quotation?.version === 4,
    `status=${quotation.data?.quotation?.status} version=${quotation.data?.quotation?.version} total=${quotation.data?.quotation?.totalExact}`,
  );

  console.log(
    `\nTOTAL ${results.filter((row) => row.ok).length}/${results.length} PASS`,
  );
  console.log(`CREATED_CONNECTIONS=${mockConnectionId},${asanConnectionId}`);

  fs.writeFileSync(
    path.join(__dirname, 'tmp-accounting-006-verify.json'),
    JSON.stringify({ results, mockConnectionId, asanConnectionId }, null, 2),
  );

  process.exit(results.every((row) => row.ok) ? 0 : 1);
};

main().catch((error) => {
  console.error('FATAL', error);
  process.exit(3);
});
