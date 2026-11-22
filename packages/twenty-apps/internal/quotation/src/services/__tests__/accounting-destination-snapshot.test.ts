import { describe, expect, it } from 'vitest';

import {
  MOCK_CATALOG_ITEMS,
  MOCK_PARTIES,
} from 'src/domain/accounting/adapters/mock/mock-dataset';
import type { RemoteCatalogItem, RemoteParty } from 'src/domain/accounting/adapter-contract';
import type { ItemImportRow } from 'src/domain/accounting/import-plan';
import type { PagedRows } from 'src/domain/accounting/pagination';
import type { Result } from 'src/domain/shared/result';
import {
  buildItemSnapshot,
  buildPartySnapshot,
  DESTINATION_SNAPSHOT_DEFAULT_LIMIT,
  itemRowHaystack,
  partyRowHaystack,
  type DestinationSnapshot,
} from 'src/services/accounting-destination-snapshot.service';
import {
  createKvSnapshotStorage,
  createMemorySnapshotStorage,
  getFallbackEntry,
  getFreshSnapshotEntry,
  readSnapshotPage,
  SNAPSHOT_CHUNK_ROWS,
  SNAPSHOT_TTL_MS,
  writeSnapshot,
  type SnapshotKvClient,
  type SnapshotStorage,
} from 'src/services/accounting-snapshot-storage';

const unwrapSnapshot = (
  result: Result<DestinationSnapshot>,
): DestinationSnapshot => {
  if (!result.ok) {
    throw new Error(`expected a snapshot, got ${result.refusal.code}`);
  }

  return result.value;
};

const refusalOf = (result: Result<DestinationSnapshot>) => {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error('expected a refusal');
  }

  return result.refusal;
};

const remoteItem = (index: number): RemoteCatalogItem => ({
  externalItemId: String(1_000 + index),
  code: String(1_000 + index),
  name: `کالای ${index}`,
  secondaryName: null,
  sellPriceUnits: 100_000,
  salesPriceUnits: [],
  stock: null,
  remoteVersion: `v-${index}`,
  isActive: true,
});
const remoteParty = (index: number): RemoteParty => ({
  externalPartyId: String(2_000 + index),
  code: String(2_000 + index),
  fullName: `مشتری ${index}`,
  mobile: null,
  nationalCode: null,
  remoteVersion: `p-${index}`,
});

const store = async ({
  storage,
  key,
  snapshot,
  nowMs = 0,
}: {
  storage: SnapshotStorage;
  key: string;
  snapshot: DestinationSnapshot;
  nowMs?: number;
}) =>
  writeSnapshot({
    storage,
    key,
    nowMs,
    meta: snapshot.meta,
    itemRows: snapshot.itemRows,
    partyRows: snapshot.partyRows,
    itemSummary: snapshot.itemSummary,
    partySummary: snapshot.partySummary,
  });

// A key-value client over a Map, standing in for the app's workspace store. It is the same
// client shape the logic function passes, so the serialisation path is exercised too.
const createFakeKvClient = () => {
  const values = new Map<string, string>();

  const client: SnapshotKvClient & {
    keys: () => string[];
    getRaw: (key: string) => string | undefined;
  } = {
    get: async (key) => {
      const stored = values.get(key);

      return stored === undefined ? null : JSON.parse(stored);
    },
    set: async (key, value) => {
      values.set(key, JSON.stringify(value));
    },
    delete: async (key) => values.delete(key),
    keys: () => [...values.keys()],
    getRaw: (key) => values.get(key),
  };

  return client;
};

describe('destination snapshot', () => {
  describe('the memory ceiling', () => {
    // 100 000 is the size the scale gate names for a destination catalog. The ceiling is
    // what keeps that number from becoming the process's memory graph.
    it('keeps only the ceiling and says out loud that it did', () => {
      const remoteItems = Array.from({ length: 100_000 }, (_, index) =>
        remoteItem(index),
      );

      const snapshot = unwrapSnapshot(
        buildItemSnapshot({
          snapshotId: 'snap-1',
          nowMs: 0,
          remoteItems,
          links: [],
          moneyUnit: 'RIAL',
          limit: DESTINATION_SNAPSHOT_DEFAULT_LIMIT,
        }),
      );

      expect(snapshot.itemRows).toHaveLength(DESTINATION_SNAPSHOT_DEFAULT_LIMIT);
      expect(snapshot.meta.truncation).toEqual({
        kind: 'BOUNDED',
        taken: 20_000,
        limit: 20_000,
        declaredTotal: 100_000,
      });
      // The vendor is reported as unable to page, because it is.
      expect(snapshot.meta.vendorPagination).toBe('NONE');
      expect(snapshot.meta.readStrategy).toBe('REMOTE_UNPAGED');
      // A prefix must never be presented as the whole destination.
      expect(snapshot.meta.syncStatus).toBe('INCOMPLETE');
      expect(snapshot.meta.incompleteReason).toBe('SNAPSHOT_LIMIT_REACHED');
    });

    it('refuses an oversized destination instead of silently truncating it', () => {
      const remoteParties = Array.from({ length: 1_000_000 }, (_, index) =>
        remoteParty(index),
      );

      const result = buildPartySnapshot({
        snapshotId: 'snap-huge',
        nowMs: 0,
        remoteParties,
        links: [],
        limit: 20_000,
        hardMax: 100_000,
      });

      const refusal = refusalOf(result);

      expect(refusal.code).toBe('REMOTE_DATASET_TOO_LARGE');
      expect(refusal.detail).toContain('۱٬۰۰۰٬۰۰۰');
    });

    it('reports no truncation when the destination fits', () => {
      const snapshot = unwrapSnapshot(
        buildItemSnapshot({
          snapshotId: 'snap-1',
          nowMs: 0,
          remoteItems: MOCK_CATALOG_ITEMS,
          links: [],
          moneyUnit: 'RIAL',
          limit: 20_000,
        }),
      );

      expect(snapshot.meta.truncation).toEqual({
        kind: 'NONE',
        declaredTotal: MOCK_CATALOG_ITEMS.length,
      });
      expect(snapshot.meta.syncStatus).toBe('COMPLETE');
      expect(snapshot.meta.incompleteReason).toBeNull();
    });

    // The screen reads linked/unlinked/blocked/needsAttention. Storing the internal decision
    // histogram here made those counters render as zero next to a table full of unlinked
    // rows, and made the overview claim nothing needed attention.
    it('stores the counts the screen reads, not the internal decision names', () => {
      const snapshot = unwrapSnapshot(
        buildItemSnapshot({
          snapshotId: 'snap-summary',
          nowMs: 0,
          remoteItems: MOCK_CATALOG_ITEMS,
          links: [],
          moneyUnit: 'RIAL',
          limit: 20_000,
        }),
      );

      expect(snapshot.itemSummary.CREATE).toBeUndefined();
      expect(snapshot.itemSummary.blocked).toBe(2);
      expect(snapshot.itemSummary.unlinked).toBe(MOCK_CATALOG_ITEMS.length - 2);
      expect(snapshot.itemSummary.linked).toBe(0);
      expect(typeof snapshot.itemSummary.needsAttention).toBe('number');
    });
  });

  describe('paging a stored snapshot', () => {
    const storedItems = async (count: number) => {
      const storage = createMemorySnapshotStorage();
      const snapshot = unwrapSnapshot(
        buildItemSnapshot({
          snapshotId: 'snap-page',
          nowMs: 0,
          remoteItems: Array.from({ length: count }, (_, index) => remoteItem(index)),
          links: [],
          moneyUnit: 'RIAL',
          limit: 20_000,
        }),
      );
      const entry = await store({ storage, key: 'k', snapshot });

      return { storage, entry };
    };

    it('pages 100 000 destination rows without materialising the page', async () => {
      const { storage, entry } = await storedItems(20_000);

      let cursor: string | null = null;
      let pages = 0;
      let seen = 0;

      do {
        const page: PagedRows<ItemImportRow> =
          await readSnapshotPage<ItemImportRow>({
          storage,
          key: entry.key,
          revision: entry,
          request: { cursor, pageSize: 100, search: '' },
          resource: 'ITEMS',
          haystack: itemRowHaystack,
        });

        // No page is ever larger than the ceiling, whatever the set size is.
        expect(page.rows.length).toBeLessThanOrEqual(100);
        seen += page.rows.length;
        cursor = page.nextCursor;
        pages += 1;
      } while (cursor !== null && pages < 1_000);

      expect(seen).toBe(20_000);
      expect(pages).toBe(200);
    });

    it('reads only the chunks a page covers, not the whole snapshot', async () => {
      const storage = createMemorySnapshotStorage();
      const reads: number[] = [];
      const counting: SnapshotStorage = {
        ...storage,
        readChunk: async (key, snapshotId, resource, chunkIndex) => {
          reads.push(chunkIndex);

          return storage.readChunk(key, snapshotId, resource, chunkIndex);
        },
      };
      const snapshot = unwrapSnapshot(
        buildItemSnapshot({
          snapshotId: 'snap-chunk',
          nowMs: 0,
          remoteItems: Array.from({ length: 10_000 }, (_, index) => remoteItem(index)),
          links: [],
          moneyUnit: 'RIAL',
          limit: 20_000,
        }),
      );
      const entry = await store({ storage: counting, key: 'k', snapshot });

      const page = await readSnapshotPage({
        storage: counting,
        key: entry.key,
        revision: entry,
        request: { cursor: null, pageSize: 25, search: '' },
        resource: 'ITEMS',
        haystack: itemRowHaystack,
      });

      expect(page.rows).toHaveLength(25);
      // 20 chunks exist for 10 000 rows; one page asked for one of them.
      expect(reads).toEqual([0]);
      expect(Math.ceil(entry.itemRowCount / SNAPSHOT_CHUNK_ROWS)).toBe(20);
    });

    it('finds a destination row by code or name and pages the result', async () => {
      const storage = createMemorySnapshotStorage();
      const snapshot = unwrapSnapshot(
        buildItemSnapshot({
          snapshotId: 'snap-search',
          nowMs: 0,
          remoteItems: Array.from({ length: 300 }, (_, index) => remoteItem(index)),
          links: [],
          moneyUnit: 'RIAL',
          limit: 1_000,
        }),
      );
      const entry = await store({ storage, key: 'k', snapshot });

      const page = await readSnapshotPage({
        storage,
        key: entry.key,
        revision: entry,
        request: { cursor: null, pageSize: 10, search: 'کالای 25' },
        resource: 'ITEMS',
        haystack: itemRowHaystack,
      });

      expect(page.rows.length).toBeGreaterThan(0);
      expect(
        page.rows.every((row) => row.name.includes('کالای 25')),
      ).toBe(true);
      expect(page.rows).toHaveLength(10);
      expect(page.totalKnown).toBe(11);
      expect(page.hasNextPage).toBe(true);
    });

    it('searches parties by national code, name and destination id', async () => {
      const storage = createMemorySnapshotStorage();
      const snapshot = unwrapSnapshot(
        buildPartySnapshot({
          snapshotId: 'snap-party',
          nowMs: 0,
          remoteParties: MOCK_PARTIES,
          links: [],
          limit: 1_000,
        }),
      );
      const entry = await store({ storage, key: 'k', snapshot });

      const page = await readSnapshotPage({
        storage,
        key: entry.key,
        revision: entry,
        request: { cursor: null, pageSize: 10, search: '' },
        resource: 'PARTIES',
        haystack: partyRowHaystack,
      });

      expect(page.rows.length).toBeGreaterThan(0);
      expect(page.totalKnown).toBe(MOCK_PARTIES.length);
    });

    it('restarts a page whose cursor belongs to another snapshot', async () => {
      const { storage, entry } = await storedItems(30);
      const otherSnapshotCursor = Buffer.from(
        JSON.stringify({ snapshotId: 'another', offset: 20 }),
      ).toString('base64url');

      const page = await readSnapshotPage({
        storage,
        key: entry.key,
        revision: entry,
        request: { cursor: otherSnapshotCursor, pageSize: 5, search: '' },
        resource: 'ITEMS',
        haystack: itemRowHaystack,
      });

      expect(page.rows[0]?.externalItemId).toBe('1000');
    });
  });

  describe('the store', () => {
    const snapshotWith = (id: string, syncStatus: 'COMPLETE' | 'INCOMPLETE' = 'COMPLETE') => {
      const snapshot = unwrapSnapshot(
        buildItemSnapshot({
          snapshotId: id,
          nowMs: 0,
          remoteItems: MOCK_CATALOG_ITEMS,
          links: [],
          moneyUnit: 'RIAL',
        }),
      );

      return { ...snapshot, meta: { ...snapshot.meta, syncStatus } };
    };

    it('evicts the least recently written snapshot instead of growing forever', async () => {
      const storage = createMemorySnapshotStorage();

      await store({ storage, key: 'a', snapshot: snapshotWith('a') });
      await store({ storage, key: 'b', snapshot: snapshotWith('b'), nowMs: 1 });
      await store({ storage, key: 'c', snapshot: snapshotWith('c'), nowMs: 2 });

      const index = await storage.readIndex();

      // Ceiling is two here because the default is four and three is under it; prove the
      // bound with an explicit ceiling instead.
      expect(Object.keys(index)).toHaveLength(3);

      const bounded = createMemorySnapshotStorage();

      for (const [offset, key] of ['a', 'b', 'c', 'd', 'e'].entries()) {
        await writeSnapshot({
          storage: bounded,
          key,
          nowMs: offset,
          maxEntries: 2,
          meta: snapshotWith(key).meta,
          itemRows: snapshotWith(key).itemRows,
          partyRows: [],
          itemSummary: {},
          partySummary: {},
        });
      }

      const boundedIndex = await bounded.readIndex();

      expect(Object.keys(boundedIndex).sort()).toEqual(['d', 'e']);
    });

    it('expires a snapshot so a stale catalog is never paged silently', async () => {
      const storage = createMemorySnapshotStorage();
      const entry = await store({
        storage,
        key: 'a',
        snapshot: snapshotWith('a'),
        nowMs: 0,
      });

      expect(getFreshSnapshotEntry(await storage.readIndex(), 'a', 10)).not.toBeNull();
      expect(
        getFreshSnapshotEntry(await storage.readIndex(), 'a', SNAPSHOT_TTL_MS + 1),
      ).toBeNull();
      expect(entry.expiresAtMs).toBe(SNAPSHOT_TTL_MS);
    });

    it('deletes a replaced snapshot so a refresh does not accumulate chunks', async () => {
      const client = createFakeKvClient();
      const storage = createKvSnapshotStorage({ client });

      await store({ storage, key: 'k', snapshot: snapshotWith('first') });
      const before = client.keys().length;
      await store({
        storage,
        key: 'k',
        snapshot: snapshotWith('second'),
        nowMs: 1,
      });

      const after = client.keys();
      const index = await storage.readIndex();

      // One index + one chunk before; one index + one chunk after. The first snapshot's
      // chunk is gone rather than left behind.
      expect(client.keys().length).toBe(before);
      expect(after.some((key) => key.includes('first'))).toBe(false);
      expect(after.some((key) => key.includes('second'))).toBe(true);
      expect(index.k?.snapshotId).toBe('second');
    });

    it('removes chunks left by an interrupted write so a crash does not leak', async () => {
      const client = createFakeKvClient();
      const storage = createKvSnapshotStorage({ client });

      await store({ storage, key: 'k', snapshot: snapshotWith('live') });

      // A write that died between its chunk writes and its index write: the chunk and its
      // registry entry exist, the index never learned the id, so nothing indexes it.
      await storage.writeChunk('k', 'stranded', 'ITEMS', 0, [{ id: 'orphan' }]);
      await storage.writeRegistry('k', {
        live: {
          itemRowCount: MOCK_CATALOG_ITEMS.length,
          partyRowCount: MOCK_PARTIES.length,
        },
        stranded: { itemRowCount: 1, partyRowCount: 0 },
      });

      expect(client.keys().some((key) => key.includes('stranded'))).toBe(true);

      await store({ storage, key: 'k', snapshot: snapshotWith('next'), nowMs: 1 });

      const keys = client.keys();

      expect(keys.some((key) => key.includes('stranded'))).toBe(false);
      expect(keys.some((key) => key.includes('live'))).toBe(false);
      expect(keys.some((key) => key.includes('next'))).toBe(true);
      expect((await storage.readRegistry('k')).stranded).toBeUndefined();
    });

    it('keeps the last healthy snapshot when a later read is incomplete', async () => {      const storage = createMemorySnapshotStorage();

      await store({ storage, key: 'a', snapshot: snapshotWith('healthy') });
      await store({
        storage,
        key: 'a',
        snapshot: snapshotWith('truncated', 'INCOMPLETE'),
        nowMs: 1,
      });

      const index = await storage.readIndex();
      const fallback = getFallbackEntry(index, 'a');

      // Freshness follows the newest read...
      expect(index.a?.snapshotId).toBe('truncated');
      // ...but a failure falls back to the newest WHOLE read, with its own row count.
      expect(fallback?.revision.meta.snapshotId).toBe('healthy');
      expect(fallback?.revision.itemRowCount).toBe(MOCK_CATALOG_ITEMS.length);
    });

    it('survives a process restart because it is not module memory', async () => {
      const client = createFakeKvClient();
      const first = createKvSnapshotStorage({ client });

      await store({ storage: first, key: 'k', snapshot: snapshotWith('persisted') });

      // A second storage over the same client is what a new invocation gets.
      const second = createKvSnapshotStorage({ client });
      const index = await second.readIndex();
      const entry = getFreshSnapshotEntry(index, 'k', 1);

      expect(entry?.snapshotId).toBe('persisted');

      const page = await readSnapshotPage({
        storage: second,
        key: 'k',
        revision: entry as NonNullable<typeof entry>,
        request: { cursor: null, pageSize: 5, search: '' },
        resource: 'ITEMS',
        haystack: itemRowHaystack,
      });

      expect(page.rows).toHaveLength(5);
      expect(page.totalKnown).toBe(MOCK_CATALOG_ITEMS.length);
    });

    it('names chunks by snapshot so an evicted snapshot can be deleted as a unit', async () => {
      const client = createFakeKvClient();
      const storage = createKvSnapshotStorage({ client });

      await store({ storage, key: 'k', snapshot: snapshotWith('one') });
      await store({ storage, key: 'k2', snapshot: snapshotWith('two') });

      const chunkKeys = client.keys().filter((key) => !key.endsWith('index'));

      expect(chunkKeys.some((key) => key.includes('one'))).toBe(true);
      expect(chunkKeys.some((key) => key.includes('two'))).toBe(true);
      // The index is one small value; rows never live in it.
      expect(client.getRaw('acct-snap:index')?.includes('1001')).toBe(false);
    });

    it('keeps one workspace snapshot invisible to another workspace', async () => {
      // The logic function hands each invocation its workspace-scoped `kv`. Two workspaces
      // therefore hold two stores; a snapshot must never answer from beside its workspace,
      // even when both use the same connection key shape.
      const workspaceA = createFakeKvClient();
      const workspaceB = createFakeKvClient();
      const storageA = createKvSnapshotStorage({ client: workspaceA });
      const storageB = createKvSnapshotStorage({ client: workspaceB });

      await store({ storage: storageA, key: 'conn-1|asan|ITEMS', snapshot: snapshotWith('a') });

      const indexB = await storageB.readIndex();

      expect(indexB).toEqual({});
      expect(await storageB.readRegistry('conn-1|asan|ITEMS')).toEqual({});
      expect(Object.keys(await storageA.readIndex())).toHaveLength(1);
    });
  });
});
