import { executeRecordGraphql } from 'src/data/record-api';
import {
  type AccountingAdapter,
  type AccountingMoneyUnit,
} from 'src/domain/accounting/adapter-contract';
import {
  collectItemLookupKeys,
  enrichItemPage,
  type PartyCandidatePage,
} from 'src/domain/accounting/mapping-page';
import {
  type ItemImportRow,
  type PartyImportRow,
} from 'src/domain/accounting/import-plan';
import {
  type PageRequest,
  type SnapshotMeta,
} from 'src/domain/accounting/pagination';
import {
  buildItemPageFromRemote,
  buildItemSnapshot,
  buildPartyPageFromRemote,
  buildPartySnapshot,
  itemRowHaystack,
  partyRowHaystack,
  snapshotKey,
  type DestinationSnapshot,
} from 'src/services/accounting-destination-snapshot.service';
import {
  getFallbackEntry,
  getFreshSnapshotEntry,
  readSnapshotPage,
  writeSnapshot,
  type SnapshotIndexEntry,
  type SnapshotRevision,
  type SnapshotStorage,
} from 'src/services/accounting-snapshot-storage';
import { loadItemLinks, loadPartyLinks } from 'src/services/accounting-import.service';
import { loadCrmItemIndex } from 'src/services/accounting-crm-lookup.service';
import {
  type CustomerKind,
  CUSTOMER_PICKER_PAGE_SIZE,
} from 'src/data/customer-queries';
import { searchCustomersForPicker } from 'src/services/customer-picker.service';
import { refused, type Result } from 'src/domain/shared/result';

// One screenful of the accounting mapping screens.
//
// The screen never learns which read strategy the destination uses. A `REMOTE_PAGED`
// adapter is asked for page N; a `REMOTE_UNPAGED` adapter is read once into a bounded,
// durable snapshot and page N is cut from it. Both produce this same payload, so the person
// sees one list with one pager and one search box either way.
//
// Each call costs at most three bounded reads: one destination page (paged) or one index
// entry plus the chunk(s) of the snapshot that cover the page (unpaged), one batched CRM
// lookup for the SKUs on the page, and — for customers only — one server-side search page.
// Nothing here is proportional to the size of the CRM or the destination catalog.

export type MappingDependencies = {
  // Durable storage for unpaged destinations. Required, not optional: process memory does
  // not survive a logic-function invocation, and falling back to it would silently turn
  // every page request into a full destination re-read.
  storage: SnapshotStorage;
  execute?: (query: string) => Promise<Record<string, unknown>>;
  nowMs?: () => number;
  newSnapshotId?: () => string;
};

export type MappingPagePayload<TRow> = {
  connectionId: string;
  rows: TRow[];
  nextCursor: string | null;
  hasNextPage: boolean;
  totalKnown: number | null;
  search: string;
  pageSize: number;
  snapshot: SnapshotMeta & {
    // True when this response reused an existing snapshot instead of contacting the
    // destination again. Always false for a paged destination, whose page is always fresh.
    reused: boolean;
    ageMs: number;
    // Set when the destination failed on refresh and the rows came from the last snapshot
    // that was known to be whole. The screen stays usable and says the data is older.
    degradedReason: string | null;
  };
  summary: Record<string, number>;
  timings: {
    snapshotMs: number;
    crmLookupMs: number;
    totalMs: number;
  };
};

export type LoadItemPageInput = {
  connectionId: string;
  adapterId: string;
  baseUrl: string;
  remoteUserId: string;
  moneyUnit: AccountingMoneyUnit;
  adapter: AccountingAdapter;
  request: PageRequest;
  // Forces a re-read of the destination. Without it the snapshot is reused, which is the
  // cheap path a person gets when they come back to a screen they abandoned.
  refresh?: boolean;
};

export class SnapshotRefusal extends Error {
  constructor(
    readonly code: string,
    readonly detail: string,
  ) {
    super(detail);
  }
}

const newSnapshotId = (dependencies: MappingDependencies): string =>
  (dependencies.newSnapshotId ?? (() => crypto.randomUUID()))();

const loadLinks = async <TLink>({
  load,
}: {
  load: () => Promise<TLink[]>;
}): Promise<TLink[]> => {
  try {
    return await load();
  } catch {
    // Links are the CRM's own rows. A failure to read them must not make the destination
    // look empty; the page is still useful without link decisions.
    return [];
  }
};

// Resolves which snapshot page N belongs to, building one only when there is no fresh
// snapshot. A failed build falls back to the last snapshot known to be whole.
const resolveSnapshotRevision = async ({
  key,
  refresh,
  dependencies,
  build,
}: {
  key: string;
  refresh: boolean;
  dependencies: MappingDependencies;
  build: () => Promise<Result<DestinationSnapshot>>;
}): Promise<{
  revision: SnapshotRevision;
  key: string;
  reused: boolean;
  degradedReason: string | null;
}> => {
  const nowMs = dependencies.nowMs ?? (() => Date.now());
  const index = await dependencies.storage.readIndex();
  const fresh = refresh ? null : getFreshSnapshotEntry(index, key, nowMs());

  if (fresh !== null) {
    return { revision: fresh, key, reused: true, degradedReason: null };
  }

  const built = await build();

  if (!built.ok) {
    const fallback = getFallbackEntry(index, key);

    if (fallback !== null) {
      return {
        revision: fallback.revision,
        key: fallback.key,
        reused: true,
        degradedReason: built.refusal.detail,
      };
    }

    throw new SnapshotRefusal(built.refusal.code, built.refusal.detail);
  }

  const entry: SnapshotIndexEntry = await writeSnapshot({
    storage: dependencies.storage,
    key,
    nowMs: nowMs(),
    meta: built.value.meta,
    itemRows: built.value.itemRows,
    partyRows: built.value.partyRows,
    itemSummary: built.value.itemSummary,
    partySummary: built.value.partySummary,
  });

  return { revision: entry, key, reused: false, degradedReason: null };
};

export const loadItemMappingPage = async (
  input: LoadItemPageInput,
  dependencies: MappingDependencies,
): Promise<MappingPagePayload<ItemImportRow>> => {
  const nowMs = dependencies.nowMs ?? (() => Date.now());
  const execute = dependencies.execute ?? executeRecordGraphql;
  const started = nowMs();

  // A destination that pages is asked for the page itself: no snapshot, no full read.
  if (
    input.adapter.capabilities.readStrategy === 'REMOTE_PAGED' &&
    input.adapter.readItemPage !== undefined
  ) {
    const remote = await input.adapter.readItemPage({
      cursor: input.request.cursor,
      pageSize: input.request.pageSize,
      search: input.request.search,
    });

    if (!remote.ok) {
      throw new SnapshotRefusal(remote.refusal.code, remote.refusal.detail);
    }

    const links = await loadLinks({
      load: () => loadItemLinks(input.connectionId, { execute }),
    });
    const built = buildItemPageFromRemote({
      nowMs: nowMs(),
      remoteItems: remote.value.rows,
      links,
      moneyUnit: input.moneyUnit,
      search: input.request.search,
      nextCursor: remote.value.nextCursor,
      hasNextPage: remote.value.hasNextPage,
      totalKnown: remote.value.totalKnown,
    });

    const lookupStarted = nowMs();
    const rows = await enrichPageForItems({ rows: built.rows, execute });
    const crmLookupMs = nowMs() - lookupStarted;

    return {
      connectionId: input.connectionId,
      rows,
      nextCursor: built.nextCursor ?? null,
      hasNextPage: built.hasNextPage,
      totalKnown: built.totalKnown,
      search: input.request.search,
      pageSize: input.request.pageSize,
      snapshot: {
        ...built.snapshot,
        reused: false,
        ageMs: 0,
        degradedReason: null,
      },
      summary: built.summary,
      timings: {
        snapshotMs: 0,
        crmLookupMs,
        totalMs: nowMs() - started,
      },
    };
  }

  const key = snapshotKey({
    connectionId: input.connectionId,
    adapterId: input.adapterId,
    resource: 'ITEMS',
    moneyUnit: input.moneyUnit,
    baseUrl: input.baseUrl,
    remoteUserId: input.remoteUserId,
  });

  const snapshotStarted = nowMs();
  const { revision, reused, degradedReason } = await resolveSnapshotRevision({
    key,
    refresh: input.refresh === true,
    dependencies,
    build: async () => {
      const links = await loadItemLinks(input.connectionId, { execute });
      const remote = await input.adapter.listItems();

      return remote.ok
        ? buildItemSnapshot({
            snapshotId: newSnapshotId(dependencies),
            nowMs: nowMs(),
            remoteItems: remote.value,
            links,
            moneyUnit: input.moneyUnit,
            readStrategy: input.adapter.capabilities.readStrategy,
          })
        : refused(remote.refusal.code, remote.refusal.detail);
    },
  });
  const snapshotMs = nowMs() - snapshotStarted;

  const page = await readSnapshotPage<ItemImportRow>({
    storage: dependencies.storage,
    key,
    revision,
    request: input.request,
    resource: 'ITEMS',
    haystack: itemRowHaystack,
  });

  const lookupStarted = nowMs();
  const rows = await enrichPageForItems({
    rows: page.rows,
    execute,
  });
  const crmLookupMs = nowMs() - lookupStarted;

  return {
    connectionId: input.connectionId,
    rows,
    nextCursor: page.nextCursor,
    hasNextPage: page.hasNextPage,
    totalKnown: page.totalKnown,
    search: input.request.search,
    pageSize: input.request.pageSize,
    snapshot: {
      ...revision.meta,
      reused,
      ageMs: Math.max(0, nowMs() - revision.meta.createdAtMs),
      degradedReason,
    },
    summary: revision.itemSummary,
    timings: {
      snapshotMs,
      crmLookupMs,
      totalMs: nowMs() - started,
    },
  };
};

const enrichPageForItems = async ({
  rows,
  execute,
}: {
  rows: ItemImportRow[];
  execute: (query: string) => Promise<Record<string, unknown>>;
}): Promise<ItemImportRow[]> => {
  const { skus, ids } = collectItemLookupKeys(rows);

  // A page with neither a SKU nor a linked record needs no second round-trip at all.
  if (skus.length === 0 && ids.length === 0) {
    return rows;
  }

  const index = await loadCrmItemIndex({ skus, ids }, { execute });

  return enrichItemPage({ rows, index });
};

export type LoadPartyPageInput = {
  connectionId: string;
  adapterId: string;
  baseUrl: string;
  remoteUserId: string;
  moneyUnit: AccountingMoneyUnit;
  adapter: AccountingAdapter;
  request: PageRequest;
  refresh?: boolean;
};

export const loadPartyMappingPage = async (
  input: LoadPartyPageInput,
  dependencies: MappingDependencies,
): Promise<MappingPagePayload<PartyImportRow>> => {
  const nowMs = dependencies.nowMs ?? (() => Date.now());
  const execute = dependencies.execute ?? executeRecordGraphql;
  const started = nowMs();

  if (
    input.adapter.capabilities.readStrategy === 'REMOTE_PAGED' &&
    input.adapter.readPartyPage !== undefined
  ) {
    const remote = await input.adapter.readPartyPage({
      cursor: input.request.cursor,
      pageSize: input.request.pageSize,
      search: input.request.search,
    });

    if (!remote.ok) {
      throw new SnapshotRefusal(remote.refusal.code, remote.refusal.detail);
    }

    const links = await loadLinks({
      load: () => loadPartyLinks(input.connectionId, { execute }),
    });
    const built = buildPartyPageFromRemote({
      nowMs: nowMs(),
      remoteParties: remote.value.rows,
      links,
      search: input.request.search,
      nextCursor: remote.value.nextCursor,
      hasNextPage: remote.value.hasNextPage,
      totalKnown: remote.value.totalKnown,
    });

    return {
      connectionId: input.connectionId,
      rows: built.rows,
      nextCursor: built.nextCursor ?? null,
      hasNextPage: built.hasNextPage,
      totalKnown: built.totalKnown,
      search: input.request.search,
      pageSize: input.request.pageSize,
      snapshot: {
        ...built.snapshot,
        reused: false,
        ageMs: 0,
        degradedReason: null,
      },
      summary: built.summary,
      timings: {
        snapshotMs: 0,
        crmLookupMs: 0,
        totalMs: nowMs() - started,
      },
    };
  }

  const key = snapshotKey({
    connectionId: input.connectionId,
    adapterId: input.adapterId,
    resource: 'PARTIES',
    moneyUnit: input.moneyUnit,
    baseUrl: input.baseUrl,
    remoteUserId: input.remoteUserId,
  });

  const snapshotStarted = nowMs();
  const { revision, reused, degradedReason } = await resolveSnapshotRevision({
    key,
    refresh: input.refresh === true,
    dependencies,
    build: async () => {
      const links = await loadPartyLinks(input.connectionId, { execute });
      const remote = await input.adapter.listParties();

      return remote.ok
        ? buildPartySnapshot({
            snapshotId: newSnapshotId(dependencies),
            nowMs: nowMs(),
            remoteParties: remote.value,
            links,
            readStrategy: input.adapter.capabilities.readStrategy,
          })
        : refused(remote.refusal.code, remote.refusal.detail);
    },
  });
  const snapshotMs = nowMs() - snapshotStarted;

  const page = await readSnapshotPage<PartyImportRow>({
    storage: dependencies.storage,
    key,
    revision,
    request: input.request,
    resource: 'PARTIES',
    haystack: partyRowHaystack,
  });

  return {
    connectionId: input.connectionId,
    rows: page.rows,
    nextCursor: page.nextCursor,
    hasNextPage: page.hasNextPage,
    totalKnown: page.totalKnown,
    search: input.request.search,
    pageSize: input.request.pageSize,
    snapshot: {
      ...revision.meta,
      reused,
      ageMs: Math.max(0, nowMs() - revision.meta.createdAtMs),
      degradedReason,
    },
    summary: revision.partySummary,
    timings: {
      snapshotMs,
      crmLookupMs: 0,
      totalMs: nowMs() - started,
    },
  };
};

// The CRM side of the customer screen: server-side search, one capped page, with the cursor
// the server issued so the next page continues from the same sort position.
export const searchPartyCandidates = async (
  {
    partyType,
    search,
    cursor,
    pageSize = CUSTOMER_PICKER_PAGE_SIZE,
  }: {
    partyType: CustomerKind;
    search: string;
    cursor: string | null;
    pageSize?: number;
  },
  dependencies: { execute?: (query: string) => Promise<Record<string, unknown>> } = {},
): Promise<PartyCandidatePage> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const page = await searchCustomersForPicker(
    {
      customerType: partyType,
      search,
      afterCursor: cursor,
      pageSize,
    },
    { execute },
  );

  return {
    rows: page.rows.map((row) => ({
      id: row.id,
      label: row.label,
      detail: row.detail,
    })),
    hasNextPage: page.hasNextPage,
    endCursor: page.endCursor,
    totalKnown: page.totalKnown,
  };
};
