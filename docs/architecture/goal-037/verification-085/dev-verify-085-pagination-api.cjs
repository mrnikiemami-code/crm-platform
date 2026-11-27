// Dev API pagination probes for accounting customers/products.
// Records pageNumber/pageSize requests and server-confirmed ranges.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const evidenceDir = __dirname;
const token = spawnSync(
  process.execPath,
  [path.join(evidenceDir, 'pilot-token.cjs')],
  { encoding: 'utf8' },
).stdout.trim();
const apiBase = 'http://localhost:3002';

const post = async (body) => {
  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => null) };
};

const summarizePage = (data) => {
  const page = data?.page ?? data;
  const rows = page?.rows ?? [];
  return {
    success: data?.success === true,
    code: data?.code ?? null,
    message: data?.message ?? null,
    pageNumber: page?.pageNumber ?? null,
    pageSize: page?.pageSize ?? null,
    totalKnown: page?.totalKnown ?? page?.summary?.total ?? null,
    rowCount: rows.length,
    firstId:
      rows[0]?.externalPartyId ??
      rows[0]?.externalItemId ??
      rows[0]?.id ??
      null,
    lastId:
      rows.at(-1)?.externalPartyId ??
      rows.at(-1)?.externalItemId ??
      rows.at(-1)?.id ??
      null,
    snapshotId: page?.snapshot?.snapshotId ?? page?.snapshotId ?? null,
    hasNextPage: page?.hasNextPage ?? null,
    hasPreviousPage: page?.hasPreviousPage ?? null,
  };
};

(async () => {
  const out = { startedAt: new Date().toISOString(), steps: {} };
  const stamp = Date.now().toString().slice(-6);
  const save = await post({
    action: 'accounting-connection-save',
    name: `NATIVE_TABLE 085 ${stamp}`,
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
  const connectionId =
    (save.data?.connections ?? []).find((c) =>
      String(c.name ?? '').includes(`NATIVE_TABLE 085 ${stamp}`),
    )?.recordId ?? save.data?.connections?.[0]?.recordId;
  out.steps.connection = {
    success: save.data?.success === true,
    connectionId,
    profile: 'PARTY_UAT',
  };
  if (!connectionId) {
    fs.writeFileSync(
      path.join(evidenceDir, 'pagination-api.json'),
      JSON.stringify(out, null, 2),
    );
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  await post({ action: 'accounting-connection-set-default', recordId: connectionId });

  const parties1 = await post({
    action: 'accounting-import-preview-parties-page',
    connectionId,
    pageSize: 25,
    pageNumber: 1,
    search: '',
    refresh: true,
  });
  out.steps.partiesPage1 = summarizePage(parties1.data);
  const snapshotId = out.steps.partiesPage1.snapshotId;

  // Direct jump — if total < 50*25 the server clamps; record observed behavior.
  const parties50 = await post({
    action: 'accounting-import-preview-parties-page',
    connectionId,
    pageSize: 25,
    pageNumber: 50,
    search: '',
    snapshotId,
    refresh: false,
  });
  out.steps.partiesPage50 = summarizePage(parties50.data);

  const partiesLast = await post({
    action: 'accounting-import-preview-parties-page',
    connectionId,
    pageSize: 25,
    pageNumber: 999,
    search: '',
    snapshotId: out.steps.partiesPage50.snapshotId || snapshotId,
    refresh: false,
  });
  out.steps.partiesClampedLast = summarizePage(partiesLast.data);

  for (const size of [25, 50, 100]) {
    const page = await post({
      action: 'accounting-import-preview-parties-page',
      connectionId,
      pageSize: size,
      pageNumber: 1,
      search: '',
      snapshotId: out.steps.partiesPage1.snapshotId || snapshotId,
      refresh: false,
    });
    out.steps[`partiesSize${size}`] = summarizePage(page.data);
  }

  const search = await post({
    action: 'accounting-import-preview-parties-page',
    connectionId,
    pageSize: 25,
    pageNumber: 1,
    search: 'UAT-000001',
    snapshotId,
    refresh: false,
  });
  out.steps.partiesSearch = summarizePage(search.data);

  const empty = await post({
    action: 'accounting-import-preview-parties-page',
    connectionId,
    pageSize: 25,
    pageNumber: 1,
    search: '___no_match_085___',
    snapshotId,
    refresh: false,
  });
  out.steps.partiesEmpty = summarizePage(empty.data);

  const stale = await post({
    action: 'accounting-import-preview-parties-page',
    connectionId,
    pageSize: 25,
    pageNumber: 3,
    search: '',
    snapshotId: '00000000-0000-4000-8000-000000000085',
    refresh: false,
  });
  out.steps.partiesStaleSnapshot = summarizePage(stale.data);

  const items1 = await post({
    action: 'accounting-import-preview-items-page',
    connectionId,
    pageSize: 25,
    pageNumber: 1,
    search: '',
    refresh: true,
  });
  out.steps.itemsPage1 = summarizePage(items1.data);
  const itemSnap = out.steps.itemsPage1.snapshotId;
  const items50 = await post({
    action: 'accounting-import-preview-items-page',
    connectionId,
    pageSize: 25,
    pageNumber: 50,
    search: '',
    snapshotId: itemSnap,
    refresh: false,
  });
  out.steps.itemsPage50 = summarizePage(items50.data);

  out.finishedAt = new Date().toISOString();
  out.notes = {
    mockPartyUatMax: 100,
    mockCatalogApprox: 'default MOCK_CATALOG_ITEMS (~30+)',
    page50RequiresDataset: '>=1225 rows; Dev mock PARTY_UAT cannot satisfy page 50/25 without product dataset enlargement',
    syntheticCoverage: 'see vitest-page50.log and accounting-read-strategy / destination-snapshot tests with 1300–10000 rows',
  };
  fs.writeFileSync(
    path.join(evidenceDir, 'pagination-api.json'),
    JSON.stringify(out, null, 2),
  );
  console.log(JSON.stringify(out, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
