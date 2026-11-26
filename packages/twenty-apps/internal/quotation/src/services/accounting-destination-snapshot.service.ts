import {
  type AccountingMoneyUnit,
  type RemoteCatalogItem,
  type RemoteParty,
} from 'src/domain/accounting/adapter-contract';
import { type RemoteReadStrategy } from 'src/domain/accounting/capabilities';
import {
  planItemImport,
  planPartyImport,
  type ExistingItemLink,
  type ExistingPartyLink,
  type ItemImportRow,
  type PartyImportRow,
} from 'src/domain/accounting/import-plan';
import { summarizeItemDecisions } from 'src/domain/accounting/mapping-page';
import {
  type SnapshotMeta,
  type SnapshotTruncation,
} from 'src/domain/accounting/pagination';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// A destination that cannot page (Asan documents AllProducts/AllCustomers with no cursor,
// offset or page number) is read ONCE per configuration into an immutable snapshot that
// pages are cut from. The rows live in `accounting-snapshot-storage`, not in this file: a
// logic function is not a long-lived process, so a snapshot kept in module memory would be
// rebuilt on every page and every keystroke.
//
// Two ceilings, two different answers:
//  - above the soft limit the snapshot is truncated and marked INCOMPLETE, so a person sees
//    the first N rows plus "the rest is not visible in this version";
//  - above the hard maximum the read is REFUSED with an explicit error, because silently
//    keeping the first 100 000 of 1 000 000 customers would look like a complete list.
//
// The ceiling is a memory bound, not a product statement.

export const DESTINATION_SNAPSHOT_DEFAULT_LIMIT = 20_000;

export const DESTINATION_SNAPSHOT_HARD_MAX_DEFAULT = 100_000;

export type DestinationSnapshot = {
  meta: SnapshotMeta;
  itemRows: ItemImportRow[];
  partyRows: PartyImportRow[];
  // Counted over the whole snapshot, so "12 need a CRM record" is a fact about the
  // destination, not about the page currently on screen.
  itemSummary: Record<string, number>;
  partySummary: Record<string, number>;
};

// The key names the configuration that produced the rows. Changing the address or the money
// unit must not reuse rows read under the old one: the prices in those rows were converted
// with the previous unit.
export const snapshotKey = ({
  connectionId,
  adapterId,
  resource,
  moneyUnit,
  baseUrl,
  remoteUserId,
}: {
  connectionId: string;
  adapterId: string;
  resource: 'ITEMS' | 'PARTIES';
  moneyUnit: string;
  baseUrl: string;
  remoteUserId: string;
}): string =>
  [
    connectionId,
    adapterId,
    resource,
    moneyUnit,
    baseUrl.trim(),
    remoteUserId.trim(),
  ].join('|');

const readPositiveInt = (name: string, fallback: number): number => {
  const parsed = Number.parseInt(String(process.env[name] ?? ''), 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const readSnapshotLimit = (): number =>
  readPositiveInt(
    'ACCOUNTING_REMOTE_SNAPSHOT_LIMIT',
    DESTINATION_SNAPSHOT_DEFAULT_LIMIT,
  );

export const readSnapshotHardMax = (): number =>
  readPositiveInt(
    'ACCOUNTING_REMOTE_SNAPSHOT_HARD_MAX',
    DESTINATION_SNAPSHOT_HARD_MAX_DEFAULT,
  );

const truncationFor = (
  declaredTotal: number,
  taken: number,
  limit: number,
): SnapshotTruncation =>
  declaredTotal <= limit
    ? { kind: 'NONE', declaredTotal }
    : { kind: 'BOUNDED', taken, limit, declaredTotal };

// A soft truncation is real information, not a footnote: everything derived from this
// snapshot (counts, duplicate detection, "linked/unlinked") describes only the rows that
// were kept. Marking it INCOMPLETE is what stops "0 unlinked" from being read as "the whole
// destination is mapped".
const syncStatusFor = (
  declaredTotal: number,
  kept: number,
): Pick<SnapshotMeta, 'syncStatus' | 'incompleteReason'> =>
  kept < declaredTotal
    ? { syncStatus: 'INCOMPLETE', incompleteReason: 'SNAPSHOT_LIMIT_REACHED' }
    : { syncStatus: 'COMPLETE', incompleteReason: null };

const oversizeRefusal = (
  resource: 'کالا' | 'مشتری',
  declaredTotal: number,
  hardMax: number,
): Result<never> =>
  refused(
    'REMOTE_DATASET_TOO_LARGE',
    `فهرست ${resource} مقصد ${declaredTotal.toLocaleString('fa-IR')} ردیف دارد و از سقف قابل نگهداری (${hardMax.toLocaleString('fa-IR')} ردیف) بزرگ‌تر است؛ برای جلوگیری از بارگذاری نامحدود در حافظه، این فهرست بارگذاری نشد.`,
  );

export type BuildItemSnapshotInput = {
  snapshotId: string;
  nowMs: number;
  remoteItems: RemoteCatalogItem[];
  links: ExistingItemLink[];
  moneyUnit: AccountingMoneyUnit;
  limit?: number;
  hardMax?: number;
  readStrategy?: RemoteReadStrategy;
};

export const buildItemSnapshot = ({
  snapshotId,
  nowMs,
  remoteItems,
  links,
  moneyUnit,
  limit = readSnapshotLimit(),
  hardMax = readSnapshotHardMax(),
  readStrategy = 'REMOTE_UNPAGED',
}: BuildItemSnapshotInput): Result<DestinationSnapshot> => {
  const declaredTotal = remoteItems.length;

  if (declaredTotal > hardMax) {
    return oversizeRefusal('کالا', declaredTotal, hardMax);
  }

  const kept = remoteItems.slice(0, limit);
  // The plan is computed once over the bounded set: duplicate-code and duplicate-name
  // detection is a property of the whole destination, so it cannot be decided per page.
  const preview = planItemImport({
    remoteItems: kept,
    links,
    // CRM items are resolved per page (batched by SKU), never by scanning the catalog.
    crmItems: [],
    moneyUnit,
  });

  return accepted({
    meta: {
      snapshotId,
      createdAtMs: nowMs,
      truncation: truncationFor(declaredTotal, kept.length, limit),
      vendorPagination: readStrategy === 'REMOTE_PAGED' ? 'CURSOR' : 'NONE',
      readStrategy,
      ...syncStatusFor(declaredTotal, kept.length),
    },
    itemRows: preview.rows,
    partyRows: [],
    // Business counts, not the internal decision names: this is what the screen shows, and
    // storing the histogram here made every counter read as zero.
    itemSummary: summarizeItemDecisions(preview.rows),
    partySummary: {},
  });
};

export type BuildPartySnapshotInput = {
  snapshotId: string;
  nowMs: number;
  remoteParties: RemoteParty[];
  links: ExistingPartyLink[];
  limit?: number;
  hardMax?: number;
  readStrategy?: RemoteReadStrategy;
};

export const buildPartySnapshot = ({
  snapshotId,
  nowMs,
  remoteParties,
  links,
  limit = readSnapshotLimit(),
  hardMax = readSnapshotHardMax(),
  readStrategy = 'REMOTE_UNPAGED',
}: BuildPartySnapshotInput): Result<DestinationSnapshot> => {
  const declaredTotal = remoteParties.length;

  if (declaredTotal > hardMax) {
    return oversizeRefusal('مشتری', declaredTotal, hardMax);
  }

  const kept = remoteParties.slice(0, limit);
  const preview = planPartyImport({
    remoteParties,
    links,
    // Remote-side snapshot only. CRM identity enrichment is performed on each read page.
    crmParties: [],
    crmCandidates: [],
  });

  const partyRows = preview.rows.slice(0, kept.length);
  const partySummary: Record<string, number> = Object.fromEntries(Object.keys(preview.summary).map((key) => [key, 0]));
  for (const row of partyRows) partySummary[row.decision] += 1;
  return accepted({
    meta: {
      snapshotId,
      createdAtMs: nowMs,
      truncation: truncationFor(declaredTotal, kept.length, limit),
      vendorPagination: readStrategy === 'REMOTE_PAGED' ? 'CURSOR' : 'NONE',
      readStrategy,
      ...syncStatusFor(declaredTotal, kept.length),
    },
    itemRows: [], partyRows, itemSummary: {}, partySummary,
  });
};

// The columns a destination row is searched by. Kept next to the snapshot because search
// runs over stored rows, chunk by chunk, not over a materialised array.
export const itemRowHaystack = (row: ItemImportRow): string[] => [
  row.code,
  row.name,
  row.externalItemId,
  row.secondaryName ?? '',
];

export const partyRowHaystack = (row: PartyImportRow): string[] => [
  row.code,
  row.fullName,
  row.externalPartyId,
  row.nationalCode ?? '',
  row.mobile ?? '',
];

// A page that came from a destination which pages itself. It is materialised locally only
// for as long as it takes to enrich the rows on screen; nothing about it is retained.
// Duplicate detection is therefore page-scoped here, and the payload says which strategy
// produced it instead of letting a page look like a whole-destination verdict.
export type RemoteItemPageInput = {
  nowMs: number;
  remoteItems: RemoteCatalogItem[];
  links: ExistingItemLink[];
  moneyUnit: AccountingMoneyUnit;
  search: string;
  nextCursor: string | null;
  hasNextPage: boolean;
  totalKnown: number | null;
};

export const buildItemPageFromRemote = ({
  nowMs,
  remoteItems,
  links,
  moneyUnit,
  search,
  nextCursor,
  hasNextPage,
  totalKnown,
}: RemoteItemPageInput): {
  rows: ItemImportRow[];
  snapshot: SnapshotMeta;
  summary: Record<string, number>;
  nextCursor: string | null;
  hasNextPage: boolean;
  totalKnown: number | null;
} => {
  const preview = planItemImport({
    remoteItems,
    links,
    crmItems: [],
    moneyUnit,
  });

  return {
    rows: preview.rows,
    nextCursor,
    hasNextPage,
    totalKnown,
    snapshot: {
      // A paged read holds no local snapshot; the id names the source so the cursor and the
      // freshness note still have something stable to refer to.
      snapshotId: `remote-page:${search}`,
      createdAtMs: nowMs,
      truncation: { kind: 'NONE', declaredTotal: totalKnown },
      vendorPagination: 'CURSOR',
      readStrategy: 'REMOTE_PAGED',
      syncStatus: 'COMPLETE',
      incompleteReason: null,
    },
    summary: summarizeItemDecisions(preview.rows),
  };
};

export type RemotePartyPageInput = {
  nowMs: number;
  remoteParties: RemoteParty[];
  links: ExistingPartyLink[];
  search: string;
  nextCursor: string | null;
  hasNextPage: boolean;
  totalKnown: number | null;
};

export const buildPartyPageFromRemote = ({
  nowMs,
  remoteParties,
  links,
  search,
  nextCursor,
  hasNextPage,
  totalKnown,
}: RemotePartyPageInput): {
  rows: PartyImportRow[];
  snapshot: SnapshotMeta;
  summary: Record<string, number>;
  nextCursor: string | null;
  hasNextPage: boolean;
  totalKnown: number | null;
} => {
  const preview = planPartyImport({
    remoteParties,
    links,
    crmParties: [],
    crmCandidates: [],
  });

  return {
    rows: preview.rows,
    nextCursor,
    hasNextPage,
    totalKnown,
    snapshot: {
      snapshotId: `remote-page:${search}`,
      createdAtMs: nowMs,
      truncation: { kind: 'NONE', declaredTotal: totalKnown },
      vendorPagination: 'CURSOR',
      readStrategy: 'REMOTE_PAGED',
      syncStatus: 'COMPLETE',
      incompleteReason: null,
    },
    summary: preview.summary,
  };
};
