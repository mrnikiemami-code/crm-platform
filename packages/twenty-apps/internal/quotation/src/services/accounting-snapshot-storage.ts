import {
  type ItemImportRow,
  type PartyImportRow,
} from 'src/domain/accounting/import-plan';
import {
  type PagedRows,
  type PageRequest,
  type SnapshotMeta,
  decodeSnapshotCursor,
  encodeSnapshotCursor,
} from 'src/domain/accounting/pagination';

// Durable storage for the bounded destination snapshot.
//
// WHY DURABLE AND NOT IN-PROCESS: a logic function is not a long-lived process. Measured on
// Dev, two consecutive `preview-items-page` calls each built a NEW snapshot, so "next page"
// re-read the whole destination. At 100 000 products that is the unbounded path this task
// exists to remove, even though each individual read is capped. The snapshot therefore has
// to outlive one invocation, and the app's own workspace key-value store is the smallest
// mechanism that does: no new object, no new server route, no schema change.
//
// WHY CHUNKED: a page must not require loading the whole snapshot. Rows are stored in
// chunks, so a page without a search reads only the chunk(s) it covers, and a search reads
// chunk by chunk while retaining at most one page of matches.

export const SNAPSHOT_CHUNK_ROWS = 500;

// Bounded like the in-memory cache it replaces: an index of at most a few snapshots, oldest
// evicted (and its chunks deleted) when a new one is written.
export const SNAPSHOT_INDEX_MAX_ENTRIES = 4;

export const SNAPSHOT_TTL_MS = 15 * 60 * 1000;

export type SnapshotResource = 'ITEMS' | 'PARTIES';

// Everything needed to page a stored snapshot without re-reading the destination.
export type SnapshotRevision = {
  meta: SnapshotMeta;
  itemRowCount: number;
  partyRowCount: number;
  itemSummary: Record<string, number>;
  partySummary: Record<string, number>;
};

export type SnapshotIndexEntry = SnapshotRevision & {
  key: string;
  snapshotId: string;
  createdAtMs: number;
  expiresAtMs: number;
  // The newest COMPLETE revision for this key, kept past `expiresAtMs`: a failed refresh
  // serves it instead of an error screen. It carries its own counts, because an incomplete
  // re-read has different ones.
  lastHealthy: SnapshotRevision | null;
};

export type SnapshotIndex = Record<string, SnapshotIndexEntry>;

// Every snapshot id ever written for a key, with the row counts needed to delete its chunks.
// This is what makes cleanup self-healing: an interrupted write leaves chunks whose id is in
// the registry but not in the index, and the next write removes them.
export type SnapshotChunkRegistry = Record<
  string,
  { itemRowCount: number; partyRowCount: number }
>;

export type SnapshotStorage = {
  readIndex: () => Promise<SnapshotIndex>;
  writeIndex: (index: SnapshotIndex) => Promise<void>;
  readRegistry: (key: string) => Promise<SnapshotChunkRegistry>;
  writeRegistry: (key: string, registry: SnapshotChunkRegistry) => Promise<void>;
  readChunk: (
    key: string,
    snapshotId: string,
    resource: SnapshotResource,
    chunkIndex: number,
  ) => Promise<Record<string, unknown>[]>;
  writeChunk: (
    key: string,
    snapshotId: string,
    resource: SnapshotResource,
    chunkIndex: number,
    rows: Record<string, unknown>[],
  ) => Promise<void>;
  deleteSnapshot: (key: string, snapshotId: string, revision: SnapshotRevision) => Promise<void>;
};

const chunkCount = (rowCount: number): number =>
  Math.ceil(rowCount / SNAPSHOT_CHUNK_ROWS);

// Keys carry a connection key (which contains a URL) and a snapshot id. Sanitising keeps the
// key readable in the workspace store while a short hash of the original prevents two
// different keys from colliding after sanitisation.
const sanitize = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);

const shortHash = (value: string): string => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
};

export const snapshotNamespace = (key: string): string =>
  `${sanitize(key)}.${shortHash(key)}`;

const chunkKey = ({
  key,
  snapshotId,
  resource,
  chunkIndex,
}: {
  key: string;
  snapshotId: string;
  resource: SnapshotResource;
  chunkIndex: number;
}): string =>
  `acct-snap:${snapshotNamespace(key)}:${snapshotId}:${resource}:${chunkIndex}`;

export type SnapshotKvClient = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  delete: (key: string) => Promise<unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const readCounts = (value: unknown): Record<string, number> => {
  if (!isRecord(value)) {
    return {};
  }

  const counts: Record<string, number> = {};

  for (const [name, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isFinite(count)) {
      counts[name] = count;
    }
  }

  return counts;
};

const readMeta = (value: unknown): SnapshotMeta | null => {
  if (!isRecord(value)) {
    return null;
  }

  const snapshotId = value.snapshotId;

  if (typeof snapshotId !== 'string' || snapshotId === '') {
    return null;
  }

  const truncation = isRecord(value.truncation)
    ? value.truncation.kind === 'BOUNDED'
      ? {
          kind: 'BOUNDED' as const,
          taken: readNumber(value.truncation.taken),
          limit: readNumber(value.truncation.limit),
          declaredTotal:
            typeof value.truncation.declaredTotal === 'number'
              ? value.truncation.declaredTotal
              : null,
        }
      : {
          kind: 'NONE' as const,
          declaredTotal:
            typeof value.truncation.declaredTotal === 'number'
              ? value.truncation.declaredTotal
              : null,
        }
    : { kind: 'NONE' as const, declaredTotal: null };

  return {
    snapshotId,
    createdAtMs: readNumber(value.createdAtMs),
    truncation,
    vendorPagination: value.vendorPagination === 'CURSOR' ? 'CURSOR' : 'NONE',
    readStrategy:
      value.readStrategy === 'REMOTE_PAGED' ? 'REMOTE_PAGED' : 'REMOTE_UNPAGED',
    syncStatus: value.syncStatus === 'COMPLETE' ? 'COMPLETE' : 'INCOMPLETE',
    incompleteReason:
      value.incompleteReason === 'SNAPSHOT_LIMIT_REACHED'
        ? 'SNAPSHOT_LIMIT_REACHED'
        : null,
  };
};

const readRevision = (value: unknown): SnapshotRevision | null => {
  if (!isRecord(value)) {
    return null;
  }

  const meta = readMeta(value.meta);

  if (meta === null) {
    return null;
  }

  return {
    meta,
    itemRowCount: readNumber(value.itemRowCount),
    partyRowCount: readNumber(value.partyRowCount),
    itemSummary: readCounts(value.itemSummary),
    partySummary: readCounts(value.partySummary),
  };
};

const readIndexEntry = (
  key: string,
  value: unknown,
): SnapshotIndexEntry | null => {
  const revision = readRevision(value);

  if (revision === null || !isRecord(value)) {
    return null;
  }

  return {
    ...revision,
    key,
    snapshotId: revision.meta.snapshotId,
    createdAtMs: readNumber(value.createdAtMs),
    expiresAtMs: readNumber(value.expiresAtMs),
    lastHealthy: readRevision(value.lastHealthy),
  };
};

const INDEX_KEY = 'acct-snap:index';

const registryKey = (key: string): string =>
  `acct-snap:reg:${snapshotNamespace(key)}`;

const readRegistryValue = (value: unknown): SnapshotChunkRegistry => {
  if (!isRecord(value)) {
    return {};
  }

  const registry: SnapshotChunkRegistry = {};

  for (const [snapshotId, counts] of Object.entries(value)) {
    if (isRecord(counts)) {
      registry[snapshotId] = {
        itemRowCount: readNumber(counts.itemRowCount),
        partyRowCount: readNumber(counts.partyRowCount),
      };
    }
  }

  return registry;
};

// The app's workspace key-value store, behind the storage interface. The index is one small
// value; rows live in chunks named by snapshot id, so an old snapshot's chunks can be deleted
// as a unit.
export const createKvSnapshotStorage = ({
  client,
}: {
  client: SnapshotKvClient;
}): SnapshotStorage => ({
  readIndex: async () => {
    const stored = await client.get(INDEX_KEY);

    if (!isRecord(stored)) {
      return {};
    }

    const index: SnapshotIndex = {};

    for (const [key, value] of Object.entries(stored)) {
      const entry = readIndexEntry(key, value);

      if (entry !== null) {
        index[key] = entry;
      }
    }

    return index;
  },
  writeIndex: async (index) => {
    await client.set(INDEX_KEY, index);
  },
  readRegistry: async (key) =>
    readRegistryValue(await client.get(registryKey(key))),
  writeRegistry: async (key, registry) => {
    await client.set(registryKey(key), registry);
  },
  readChunk: async (key, snapshotId, resource, chunkIndex) => {
    const stored = await client.get(
      chunkKey({ key, snapshotId, resource, chunkIndex }),
    );

    return Array.isArray(stored)
      ? stored.filter((row): row is Record<string, unknown> => isRecord(row))
      : [];
  },
  writeChunk: async (key, snapshotId, resource, chunkIndex, rows) => {
    await client.set(
      chunkKey({ key, snapshotId, resource, chunkIndex }),
      rows,
    );
  },
  deleteSnapshot: async (key, snapshotId, revision) => {
    for (const resource of ['ITEMS', 'PARTIES'] as const) {
      const rowCount =
        resource === 'ITEMS' ? revision.itemRowCount : revision.partyRowCount;

      for (let chunkIndex = 0; chunkIndex < chunkCount(rowCount); chunkIndex += 1) {
        try {
          await client.delete(
            chunkKey({ key, snapshotId, resource, chunkIndex }),
          );
        } catch {
          // Eviction is best effort: a leftover chunk is unreachable once the index entry
          // is gone, and failing the request over cleanup would be worse than the leak.
        }
      }
    }
  },
});

// The same interface over process memory, used by tests and as the fallback when a caller
// does not inject a durable store. It is deliberately NOT the production path for a logic
// function: process memory does not survive an invocation.
export const createMemorySnapshotStorage = (): SnapshotStorage => {
  const chunks = new Map<string, Record<string, unknown>[]>();
  const registries = new Map<string, SnapshotChunkRegistry>();
  let index: SnapshotIndex = {};

  return {
    readIndex: async () => index,
    writeIndex: async (next) => {
      index = next;
    },
    readRegistry: async (key) => registries.get(key) ?? {},
    writeRegistry: async (key, registry) => {
      registries.set(key, registry);
    },
    readChunk: async (key, snapshotId, resource, chunkIndex) =>
      chunks.get(chunkKey({ key, snapshotId, resource, chunkIndex })) ?? [],
    writeChunk: async (key, snapshotId, resource, chunkIndex, rows) => {
      chunks.set(chunkKey({ key, snapshotId, resource, chunkIndex }), rows);
    },
    deleteSnapshot: async (key, snapshotId, revision) => {
      for (const resource of ['ITEMS', 'PARTIES'] as const) {
        const rowCount =
          resource === 'ITEMS' ? revision.itemRowCount : revision.partyRowCount;

        for (let chunkIndex = 0; chunkIndex < chunkCount(rowCount); chunkIndex += 1) {
          chunks.delete(
            chunkKey({ key, snapshotId, resource, chunkIndex }),
          );
        }
      }
    },
  };
};

export const getFreshSnapshotEntry = (
  index: SnapshotIndex,
  key: string,
  nowMs: number,
): SnapshotIndexEntry | null => {
  const entry = index[key];

  return entry === undefined || entry.expiresAtMs <= nowMs ? null : entry;
};

// The newest WHOLE revision for this key, ignoring expiry. Used only after a failed refresh.
export const getFallbackEntry = (
  index: SnapshotIndex,
  key: string,
): { key: string; revision: SnapshotRevision } | null => {
  const entry = index[key];

  return entry === undefined || entry.lastHealthy === null
    ? null
    : { key, revision: entry.lastHealthy };
};

export type WriteSnapshotInput = {
  storage: SnapshotStorage;
  key: string;
  nowMs: number;
  meta: SnapshotMeta;
  itemRows: ItemImportRow[];
  partyRows: PartyImportRow[];
  itemSummary: Record<string, number>;
  partySummary: Record<string, number>;
  maxEntries?: number;
};

const writeChunks = async ({
  storage,
  key,
  snapshotId,
  resource,
  rows,
}: {
  storage: SnapshotStorage;
  key: string;
  snapshotId: string;
  resource: SnapshotResource;
  rows: Record<string, unknown>[];
}): Promise<void> => {
  for (let chunkIndex = 0; chunkIndex < chunkCount(rows.length); chunkIndex += 1) {
    await storage.writeChunk(
      key,
      snapshotId,
      resource,
      chunkIndex,
      rows.slice(
        chunkIndex * SNAPSHOT_CHUNK_ROWS,
        (chunkIndex + 1) * SNAPSHOT_CHUNK_ROWS,
      ),
    );
  }
};

// Stores one snapshot and returns its index entry. Eviction is bounded by `maxEntries`, so
// the store cannot grow with every refresh.
export const writeSnapshot = async ({
  storage,
  key,
  nowMs,
  meta,
  itemRows,
  partyRows,
  itemSummary,
  partySummary,
  maxEntries = SNAPSHOT_INDEX_MAX_ENTRIES,
}: WriteSnapshotInput): Promise<SnapshotIndexEntry> => {
  const index = await storage.readIndex();
  const previous = index[key];

  await writeChunks({
    storage,
    key,
    snapshotId: meta.snapshotId,
    resource: 'ITEMS',
    rows: itemRows as unknown as Record<string, unknown>[],
  });
  await writeChunks({
    storage,
    key,
    snapshotId: meta.snapshotId,
    resource: 'PARTIES',
    rows: partyRows as unknown as Record<string, unknown>[],
  });

  const revision: SnapshotRevision = {
    meta,
    itemRowCount: itemRows.length,
    partyRowCount: partyRows.length,
    itemSummary,
    partySummary,
  };

  const entry: SnapshotIndexEntry = {
    ...revision,
    key,
    snapshotId: meta.snapshotId,
    createdAtMs: meta.createdAtMs,
    expiresAtMs: nowMs + SNAPSHOT_TTL_MS,
    lastHealthy:
      meta.syncStatus === 'COMPLETE'
        ? revision
        : (previous?.lastHealthy ?? null),
  };

  const nextIndex: SnapshotIndex = { ...index, [key]: entry };

  // A replaced snapshot's chunks are deleted as part of the replacement, not left for an
  // eviction that may never come: every refresh mints a new snapshot id, so without this the
  // store would grow by one full snapshot per refresh.
  const stillReferenced = new Set<string>([meta.snapshotId]);
  const retired: {
    key: string;
    snapshotId: string;
    revision: SnapshotRevision;
  }[] = [];
  const retiredIds = new Set<string>();

  if (
    meta.syncStatus !== 'COMPLETE' &&
    previous !== undefined &&
    previous.lastHealthy !== null
  ) {
    stillReferenced.add(previous.lastHealthy.meta.snapshotId);
  }

  const retire = (
    entryKey: string,
    snapshotId: string,
    revision: SnapshotRevision,
  ) => {
    if (stillReferenced.has(snapshotId) || retiredIds.has(snapshotId)) {
      return;
    }

    retiredIds.add(snapshotId);
    retired.push({ key: entryKey, snapshotId, revision });
  };

  if (previous !== undefined) {
    retire(key, previous.snapshotId, previous);

    if (previous.lastHealthy !== null) {
      retire(key, previous.lastHealthy.meta.snapshotId, previous.lastHealthy);
    }
  }

  const ordered = Object.values(nextIndex).sort(
    (left, right) => left.createdAtMs - right.createdAtMs,
  );

  while (ordered.length > maxEntries) {
    const oldest = ordered.shift();

    if (oldest === undefined) {
      break;
    }

    delete nextIndex[oldest.key];
    retire(oldest.key, oldest.snapshotId, oldest);

    if (oldest.lastHealthy !== null) {
      retire(oldest.key, oldest.lastHealthy.meta.snapshotId, oldest.lastHealthy);
    }
  }

  await storage.writeIndex(nextIndex);

  for (const revision of retired) {
    await storage.deleteSnapshot(revision.key, revision.snapshotId, revision.revision);
  }

  // Self-healing sweep. A write interrupted between chunk writes and the index write leaves
  // chunks that no index entry names, so nothing above can ever delete them. The registry is
  // the only record of those ids: everything it lists that the new index does not reference
  // is an orphan, and is removed here. Without it, one crash leaks a full snapshot per retry.
  const registry = await storage.readRegistry(key);
  const referenced = new Set<string>([meta.snapshotId]);

  if (entry.lastHealthy !== null) {
    referenced.add(entry.lastHealthy.meta.snapshotId);
  }

  const nextRegistry: SnapshotChunkRegistry = {};

  for (const [snapshotId, counts] of Object.entries(registry)) {
    if (!referenced.has(snapshotId)) {
      await storage.deleteSnapshot(key, snapshotId, {
        meta: { ...meta, snapshotId },
        itemRowCount: counts.itemRowCount,
        partyRowCount: counts.partyRowCount,
        itemSummary: {},
        partySummary: {},
      });
      continue;
    }

    nextRegistry[snapshotId] = counts;
  }

  nextRegistry[meta.snapshotId] = {
    itemRowCount: itemRows.length,
    partyRowCount: partyRows.length,
  };

  await storage.writeRegistry(key, nextRegistry);

  return entry;
};

const readRange = async <TRow>({
  storage,
  key,
  snapshotId,
  resource,
  from,
  to,
}: {
  storage: SnapshotStorage;
  key: string;
  snapshotId: string;
  resource: SnapshotResource;
  from: number;
  to: number;
}): Promise<TRow[]> => {
  const rows: TRow[] = [];
  const firstChunk = Math.floor(from / SNAPSHOT_CHUNK_ROWS);
  const lastChunk = Math.floor(Math.max(from, to - 1) / SNAPSHOT_CHUNK_ROWS);

  for (let chunkIndex = firstChunk; chunkIndex <= lastChunk; chunkIndex += 1) {
    const chunk = await storage.readChunk(key, snapshotId, resource, chunkIndex);
    const chunkStart = chunkIndex * SNAPSHOT_CHUNK_ROWS;

    for (let offset = 0; offset < chunk.length; offset += 1) {
      const absolute = chunkStart + offset;

      if (absolute >= from && absolute < to) {
        rows.push(chunk[offset] as unknown as TRow);
      }
    }
  }

  return rows;
};

// One page cut from a stored snapshot. Search scans chunk by chunk and retains at most one
// page; without a search only the covered chunks are read.
export const readSnapshotPage = async <TRow>({
  storage,
  key,
  revision,
  request,
  resource,
  haystack,
}: {
  storage: SnapshotStorage;
  key: string;
  revision: SnapshotRevision;
  request: PageRequest;
  resource: SnapshotResource;
  haystack: (row: TRow) => string[];
}): Promise<PagedRows<TRow>> => {
  const snapshotId = revision.meta.snapshotId;
  const rowCount =
    resource === 'ITEMS' ? revision.itemRowCount : revision.partyRowCount;
  const position = decodeSnapshotCursor(request.cursor);

  // A cursor from another snapshot restarts the list rather than guessing: guessing is what
  // produces "row 5 of page 3" pointing at a different record.
  const offset =
    position === null || position.snapshotId !== snapshotId
      ? 0
      : Math.min(Math.max(position.offset, 0), rowCount);

  const needle = request.search.trim().toLowerCase();
  const pageSize = request.pageSize;

  if (needle === '') {
    const end = Math.min(offset + pageSize, rowCount);
    const rows = await readRange<TRow>({
      storage,
      key,
      snapshotId,
      resource,
      from: offset,
      to: end,
    });
    const hasNextPage = end < rowCount;

    return {
      rows,
      nextCursor: hasNextPage ? encodeSnapshotCursor(snapshotId, end) : null,
      hasNextPage,
      totalKnown: rowCount,
    };
  }

  const collected: TRow[] = [];
  let matches = 0;
  const totalChunks = chunkCount(rowCount);

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const chunk = await storage.readChunk(key, snapshotId, resource, chunkIndex);

    for (const raw of chunk) {
      const row = raw as unknown as TRow;

      if (!haystack(row).some((field) => field.toLowerCase().includes(needle))) {
        continue;
      }

      if (matches >= offset && collected.length < pageSize) {
        collected.push(row);
      }

      matches += 1;
    }
  }

  const hasNextPage = matches > offset + collected.length;

  return {
    rows: collected,
    nextCursor: hasNextPage
      ? encodeSnapshotCursor(snapshotId, offset + collected.length)
      : null,
    hasNextPage,
    totalKnown: matches,
  };
};

export type ItemRowPage = PagedRows<ItemImportRow>;
export type PartyRowPage = PagedRows<PartyImportRow>;
