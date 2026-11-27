// Isolated synthetic pagination evidence for 085 — no product edits.
// Exercises production loadItemMappingPage / loadPartyMappingPage with ≥2500 rows.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const evidenceDir = __dirname;
const outPath = path.join(evidenceDir, 'pagination-synthetic.json');

const script = `
import { MockAccountingAdapter } from './src/domain/accounting/adapters/mock/mock-adapter.ts';
import { createMemorySnapshotStorage } from './src/services/accounting-snapshot-storage.ts';
import { loadItemMappingPage, loadPartyMappingPage } from './src/services/accounting-mapping.service.ts';

const items = (n) => Array.from({ length: n }, (_, i) => ({
  externalItemId: String(1000 + i),
  code: 'C' + String(1000 + i),
  name: 'کالای ' + (i + 1),
  secondaryName: null,
  unit: 'عدد',
  kind: 'PRODUCT',
  remoteVersion: 'v1',
}));
const parties = (n) => Array.from({ length: n }, (_, i) => ({
  externalPartyId: String(3000 + i),
  code: 'P' + String(3000 + i),
  fullName: 'مشتری ' + (i + 1),
  partyType: i % 2 === 0 ? 'PERSON' : 'COMPANY',
  nationalCode: null,
  mobile: null,
  remoteVersion: 'v1',
}));

const execute = async () => ({ data: { accountingItemLinks: { edges: [] }, accountingPartyLinks: { edges: [] } } });
const N = 2500;
const adapter = new MockAccountingAdapter({ items: items(N), parties: parties(N), readStrategy: 'REMOTE_UNPAGED' });
const listItems = [];
const listParties = [];
const origItems = adapter.listItems.bind(adapter);
const origParties = adapter.listParties.bind(adapter);
adapter.listItems = async (...a) => { listItems.push(1); return origItems(...a); };
adapter.listParties = async (...a) => { listParties.push(1); return origParties(...a); };
const storage = createMemorySnapshotStorage();
const deps = { execute, storage };
const itemInput = (request) => ({ connectionId: 'c1', adapter, moneyUnit: 'RIAL', request });
const partyInput = (request) => ({ connectionId: 'c1', adapter, moneyUnit: 'RIAL', request });

const firstItems = await loadItemMappingPage(itemInput({ cursor: null, pageSize: 25, search: '' }), deps);
const firstParties = await loadPartyMappingPage(partyInput({ cursor: null, pageSize: 25, search: '' }), deps);
const jump = { cursor: null, pageSize: 25, search: '', pageNumber: 50, snapshotId: firstItems.snapshot.snapshotId };
const page50Items = await loadItemMappingPage(itemInput({ ...jump, snapshotId: firstItems.snapshot.snapshotId }), deps);
const page50Parties = await loadPartyMappingPage(partyInput({ ...jump, snapshotId: firstParties.snapshot.snapshotId }), deps);
const size50 = await loadItemMappingPage(itemInput({ cursor: null, pageSize: 50, search: '', pageNumber: 1, snapshotId: firstItems.snapshot.snapshotId }), deps);
const size100 = await loadItemMappingPage(itemInput({ cursor: null, pageSize: 100, search: '', pageNumber: 1, snapshotId: firstItems.snapshot.snapshotId }), deps);
const lastPage = Math.ceil(N / 25);
const last = await loadItemMappingPage(itemInput({ cursor: null, pageSize: 25, search: '', pageNumber: lastPage, snapshotId: firstItems.snapshot.snapshotId }), deps);
const search = await loadItemMappingPage(itemInput({ cursor: null, pageSize: 25, search: 'کالای 2500', pageNumber: 1, snapshotId: firstItems.snapshot.snapshotId }), deps);
const empty = await loadItemMappingPage(itemInput({ cursor: null, pageSize: 25, search: '___none___', pageNumber: 1, snapshotId: firstItems.snapshot.snapshotId }), deps);
const stale = await loadItemMappingPage(itemInput({ cursor: null, pageSize: 25, search: '', pageNumber: 50, snapshotId: 'stale-id' }), deps);

const out = {
  datasetSize: N,
  providerFullReads: { items: listItems.length, parties: listParties.length },
  page50Items: {
    pageNumber: page50Items.pageNumber,
    totalKnown: page50Items.totalKnown,
    rowCount: page50Items.rows.length,
    firstExternalId: page50Items.rows[0]?.externalItemId ?? null,
    lastExternalId: page50Items.rows.at(-1)?.externalItemId ?? null,
    expectedRange: { start: 1226, end: 1250, firstId: '2225', lastId: '2249' },
    rangeOk:
      page50Items.pageNumber === 50 &&
      page50Items.rows.length === 25 &&
      page50Items.rows[0]?.externalItemId === '2225' &&
      page50Items.rows[24]?.externalItemId === '2249',
  },
  page50Parties: {
    pageNumber: page50Parties.pageNumber,
    totalKnown: page50Parties.totalKnown,
    rowCount: page50Parties.rows.length,
    firstExternalId: page50Parties.rows[0]?.externalPartyId ?? null,
    rangeOk:
      page50Parties.pageNumber === 50 &&
      page50Parties.rows.length === 25 &&
      page50Parties.rows[0]?.externalPartyId === '3225',
  },
  pageSizes: {
    25: firstItems.rows.length,
    50: size50.rows.length,
    100: size100.rows.length,
  },
  firstLast: {
    firstPage: firstItems.pageNumber ?? 1,
    lastPage: last.pageNumber,
    lastRowCount: last.rows.length,
    lastHasNext: last.hasNextPage,
  },
  search: { totalKnown: search.totalKnown, rowCount: search.rows.length },
  empty: { totalKnown: empty.totalKnown, rowCount: empty.rows.length },
  staleSnapshotResetsToPage1: stale.pageNumber === 1,
  noIntermediateProviderReread: listItems.length === 1 && listParties.length === 1,
};
console.log(JSON.stringify(out, null, 2));
`;

const tmp = path.join(
  evidenceDir,
  'tmp-pagination-synthetic.mts',
);
fs.writeFileSync(tmp, script);

const result = spawnSync(
  process.execPath,
  [
    '--import',
    'tsx',
    tmp,
  ],
  {
    cwd: path.resolve(
      __dirname,
      '../../../../packages/twenty-apps/internal/quotation',
    ),
    encoding: 'utf8',
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.spec.json' },
  },
);

fs.writeFileSync(
  path.join(evidenceDir, 'pagination-synthetic-run.log'),
  (result.stdout || '') + (result.stderr || ''),
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

const jsonStart = (result.stdout || '').indexOf('{');
const payload = JSON.parse((result.stdout || '').slice(jsonStart));
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));
try {
  fs.unlinkSync(tmp);
} catch {
  // keep tmp on failure path only
}
