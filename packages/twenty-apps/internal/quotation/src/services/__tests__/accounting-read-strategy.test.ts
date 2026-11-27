import { describe, expect, it, vi } from 'vitest';

import {
  type RemoteCatalogItem,
  type RemoteParty,
} from 'src/domain/accounting/adapter-contract';
import { MockAccountingAdapter } from 'src/domain/accounting/adapters/mock/mock-adapter';
import { ASAN_CAPABILITIES } from 'src/domain/accounting/adapters/asan/asan-capabilities';
import { createKvSnapshotStorage, createMemorySnapshotStorage } from 'src/services/accounting-snapshot-storage';
import {
  loadItemMappingPage,
  loadPartyMappingPage,
  SnapshotRefusal,
} from 'src/services/accounting-mapping.service';
import { refused, type Result } from 'src/domain/shared/result';

// The two read strategies must be invisible to the screen and honest about the destination.
// These tests use the mock adapter only: no vendor call, no browser, no screenshot.

const execute = async () => ({});
const storage = () => createMemorySnapshotStorage();

const item = (index: number): RemoteCatalogItem => ({
  externalItemId: String(1_000 + index),
  code: String(1_000 + index),
  name: `کالای ${index}`,
  secondaryName: null,
  sellPriceUnits: 250_000,
  salesPriceUnits: [],
  stock: null,
  remoteVersion: `v-${index}`,
  isActive: true,
});

const party = (index: number): RemoteParty => ({
  externalPartyId: String(2_000 + index),
  code: String(2_000 + index),
  fullName: `مشتری ${index}`,
  mobile: null,
  nationalCode: null,
  remoteVersion: `p-${index}`,
});

const items = (count: number) => Array.from({ length: count }, (_, index) => item(index));

const request = (overrides: Partial<{ cursor: string | null; pageSize: number; search: string }> = {}) => ({
  cursor: null,
  pageSize: 10,
  search: '',
  ...overrides,
});

const itemInput = (adapter: MockAccountingAdapter, overrides: Partial<Parameters<typeof loadItemMappingPage>[0]> = {}) => ({
  connectionId: 'conn-1',
  adapterId: adapter.id,
  baseUrl: 'http://127.0.0.1:1',
  remoteUserId: '1',
  moneyUnit: 'RIAL' as const,
  adapter,
  request: request(),
  ...overrides,
});

const partyInput = (adapter: MockAccountingAdapter, overrides: Partial<Parameters<typeof loadPartyMappingPage>[0]> = {}) => ({
  connectionId: 'conn-1',
  adapterId: adapter.id,
  baseUrl: 'http://127.0.0.1:1',
  remoteUserId: '1',
  moneyUnit: 'RIAL' as const,
  adapter,
  request: request(),
  ...overrides,
});

// Fails the destination read on demand, so the "last healthy snapshot" path is exercised
// without a network.
class FlakyAdapter extends MockAccountingAdapter {
  failNextRead = false;

  override async listItems(): Promise<Result<RemoteCatalogItem[]>> {
    return this.failNextRead
      ? refused('TRANSPORT_ERROR', 'the destination is down')
      : super.listItems();
  }
}

// Sets an env override for one test and restores it afterwards, without wrapping the
// assertions in try/finally (a test body must be a straight line of assertions).
const withEnv = async <TValue>(
  name: string,
  value: string,
  body: () => Promise<TValue>,
): Promise<TValue> => {
  const previous = process.env[name];
  process.env[name] = value;

  try {
    return await body();
  } finally {
    if (previous === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  }
};

describe('remote read strategies', () => {
  it('declares Asan as REMOTE_UNPAGED, because its guide documents no cursor', () => {
    // AllProducts/AllCustomers take no parameters and LastProducts/LastCustomers take only
    // Count — "the last N". Declaring either as paged would be a false capability.
    expect(ASAN_CAPABILITIES.readStrategy).toBe('REMOTE_UNPAGED');
  });

  it('reads an unpaged destination once into a bounded snapshot and pages inside it', async () => {
    const adapter = new MockAccountingAdapter({
      items: items(60),
      readStrategy: 'REMOTE_UNPAGED',
    });

    const page = await loadItemMappingPage(itemInput(adapter), {
      execute,
      storage: createMemorySnapshotStorage(),
      newSnapshotId: () => 'snap-unpaged',
    });

    expect(page.rows).toHaveLength(10);
    expect(page.snapshot.readStrategy).toBe('REMOTE_UNPAGED');
    expect(page.snapshot.vendorPagination).toBe('NONE');
    expect(page.snapshot.syncStatus).toBe('COMPLETE');
    expect(page.snapshot.degradedReason).toBeNull();
    expect(page.totalKnown).toBe(60);
    expect(page.nextCursor).not.toBeNull();
  });

  it('returns server-confirmed page position for item and party snapshot jumps', async () => {
    const adapter = new MockAccountingAdapter({
      items: items(1300),
      parties: Array.from({ length: 1300 }, (_, index) => party(index)),
      readStrategy: 'REMOTE_UNPAGED',
    });
    const listItems = vi.spyOn(adapter, 'listItems');
    const listParties = vi.spyOn(adapter, 'listParties');
    const dependencies = { execute, storage: storage() };
    const firstItems = await loadItemMappingPage(itemInput(adapter), dependencies);
    const firstParties = await loadPartyMappingPage(partyInput(adapter), dependencies);
    const target = { cursor: null, pageSize: 25, search: '', pageNumber: 50 };
    const nextItems = await loadItemMappingPage(itemInput(adapter, {
      request: { ...target, snapshotId: firstItems.snapshot.snapshotId },
    }), dependencies);
    const nextParties = await loadPartyMappingPage(partyInput(adapter, {
      request: { ...target, snapshotId: firstParties.snapshot.snapshotId },
    }), dependencies);
    expect(nextItems.pageNumber).toBe(50);
    expect(nextParties.pageNumber).toBe(50);
    expect(nextItems.rows).toHaveLength(25);
    expect(nextParties.rows).toHaveLength(25);
    expect(nextItems.rows[0]?.externalItemId).toBe('2225');
    expect(nextParties.rows[0]?.externalPartyId).toBe('3225');
    expect(listItems).toHaveBeenCalledTimes(1);
    expect(listParties).toHaveBeenCalledTimes(1);
  });

  it('reuses the stored snapshot on a later invocation instead of re-reading the destination', async () => {
    const adapter = new MockAccountingAdapter({
      items: items(60),
      readStrategy: 'REMOTE_UNPAGED',
    });
    const listItems = vi.spyOn(adapter, 'listItems');

    // A key-value client over a Map: this is the same shape the logic function passes, and a
    // second storage over it is what a NEW invocation gets.
    const values = new Map<string, string>();
    const client = {
      get: async (key: string) => {
        const stored = values.get(key);

        return stored === undefined ? null : JSON.parse(stored);
      },
      set: async (key: string, value: unknown) => {
        values.set(key, JSON.stringify(value));
      },
      delete: async (key: string) => values.delete(key),
    };

    const firstInvocation = await loadItemMappingPage(itemInput(adapter), {
      execute,
      storage: createKvSnapshotStorage({ client }),
    });

    const secondInvocation = await loadItemMappingPage(
      itemInput(adapter, {
        request: request({ cursor: firstInvocation.nextCursor }),
      }),
      { execute, storage: createKvSnapshotStorage({ client }) },
    );

    // The destination was read exactly once across both invocations.
    expect(listItems).toHaveBeenCalledTimes(1);
    expect(firstInvocation.snapshot.reused).toBe(false);
    expect(secondInvocation.snapshot.reused).toBe(true);
    expect(secondInvocation.rows[0]?.code).not.toBe(
      firstInvocation.rows[0]?.code,
    );
  });

  it('reads a paged destination page by page, never the whole list', async () => {    const adapter = new MockAccountingAdapter({
      items: items(60),
      readStrategy: 'REMOTE_PAGED',
    });
    const listItems = vi.spyOn(adapter, 'listItems');

    const first = await loadItemMappingPage(itemInput(adapter), { execute, storage: storage() });

    // A paged destination must not be read whole, not even once.
    expect(listItems).not.toHaveBeenCalled();
    expect(first.rows).toHaveLength(10);
    expect(first.snapshot.readStrategy).toBe('REMOTE_PAGED');
    expect(first.snapshot.vendorPagination).toBe('CURSOR');
    expect(first.totalKnown).toBe(60);

    const seen = new Set(first.rows.map((row) => row.code));
    let cursor = first.nextCursor;
    let pages = 1;

    while (cursor !== null && pages < 10) {
      const next = await loadItemMappingPage(
        itemInput(adapter, { request: request({ cursor }) }),
        { execute, storage: storage() },
      );

      expect(next.rows.length).toBeLessThanOrEqual(10);
      next.rows.forEach((row) => seen.add(row.code));
      cursor = next.nextCursor;
      pages += 1;
    }

    expect(pages).toBe(6);
    expect(seen.size).toBe(60);
    expect(listItems).not.toHaveBeenCalled();
  });

  it('gives both strategies the same page shape, so the screen cannot tell them apart', async () => {
    const unpaged = new MockAccountingAdapter({
      items: items(30),
      readStrategy: 'REMOTE_UNPAGED',
    });
    const paged = new MockAccountingAdapter({
      items: items(30),
      readStrategy: 'REMOTE_PAGED',
    });

    const fromSnapshot = await loadItemMappingPage(itemInput(unpaged), {
      execute,
      storage: createMemorySnapshotStorage(),
    });
    const fromRemote = await loadItemMappingPage(itemInput(paged), { execute, storage: storage() });

    expect(Object.keys(fromRemote).sort()).toEqual(Object.keys(fromSnapshot).sort());
    expect(Object.keys(fromRemote.rows[0]).sort()).toEqual(
      Object.keys(fromSnapshot.rows[0]).sort(),
    );
    // The pager contract itself is identical: same page size, same "there is more" flag.
    expect(fromRemote.pageSize).toBe(fromSnapshot.pageSize);
    expect(fromRemote.hasNextPage).toBe(fromSnapshot.hasNextPage);
    expect(fromRemote.nextCursor === null).toBe(fromSnapshot.nextCursor === null);
  });

  it('searches a paged destination on the destination side', async () => {
    const adapter = new MockAccountingAdapter({
      items: items(200),
      readStrategy: 'REMOTE_PAGED',
    });

    const page = await loadItemMappingPage(
      itemInput(adapter, { request: request({ pageSize: 5, search: 'کالای 17' }) }),
      { execute, storage: storage() },
    );

    // 'کالای 17' matches 17, 170..179: 11 rows, of which one page of 5 is returned.
    expect(page.rows).toHaveLength(5);
    expect(page.rows.every((row) => row.name.includes('کالای 17'))).toBe(true);
    expect(page.totalKnown).toBe(11);
    expect(page.hasNextPage).toBe(true);
  });

  it('refuses a cursor the paged destination did not issue', async () => {
    const adapter = new MockAccountingAdapter({
      items: items(30),
      readStrategy: 'REMOTE_PAGED',
    });

    await expect(
      loadItemMappingPage(
        itemInput(adapter, { request: request({ cursor: 'not-a-cursor' }) }),
        { execute, storage: storage() },
      ),
    ).rejects.toBeInstanceOf(SnapshotRefusal);
  });

  it('refuses an unpaged destination above the hard maximum with an explicit error', async () => {
    const adapter = new MockAccountingAdapter({
      parties: Array.from({ length: 6 }, (_, index) => party(index)),
      readStrategy: 'REMOTE_UNPAGED',
    });

    await expect(
      withEnv('ACCOUNTING_REMOTE_SNAPSHOT_HARD_MAX', '5', () =>
        loadPartyMappingPage(partyInput(adapter), {
          execute,
          storage: createMemorySnapshotStorage(),
        }),
      ),
    ).rejects.toMatchObject({ code: 'REMOTE_DATASET_TOO_LARGE' });
  });

  it('serves the last healthy snapshot when the destination fails on refresh', async () => {
    const adapter = new FlakyAdapter({
      items: items(30),
      readStrategy: 'REMOTE_UNPAGED',
    });
    const store = createMemorySnapshotStorage();

    const healthy = await loadItemMappingPage(itemInput(adapter), { execute, storage: store });

    expect(healthy.rows).toHaveLength(10);
    expect(healthy.snapshot.degradedReason).toBeNull();

    adapter.failNextRead = true;

    const degraded = await loadItemMappingPage(
      itemInput(adapter, { refresh: true }),
      { execute, storage: store },
    );

    // The screen keeps working, with the rows it had, and says they may be older.
    expect(degraded.rows).toHaveLength(10);
    expect(degraded.snapshot.degradedReason).toContain('down');
    expect(degraded.snapshot.reused).toBe(true);
    expect(degraded.snapshot.syncStatus).toBe('COMPLETE');
  });

  it('reports an incomplete sync when only a bounded prefix was kept', async () => {
    const adapter = new MockAccountingAdapter({
      parties: Array.from({ length: 40 }, (_, index) => party(index)),
      readStrategy: 'REMOTE_UNPAGED',
    });

    const page = await withEnv('ACCOUNTING_REMOTE_SNAPSHOT_LIMIT', '12', () =>
      loadPartyMappingPage(partyInput(adapter), {
        execute,
        storage: createMemorySnapshotStorage(),
      }),
    );

    expect(page.snapshot.truncation).toMatchObject({
      kind: 'BOUNDED',
      taken: 12,
      limit: 12,
      declaredTotal: 40,
    });
    expect(page.snapshot.syncStatus).toBe('INCOMPLETE');
    expect(page.snapshot.incompleteReason).toBe('SNAPSHOT_LIMIT_REACHED');
    expect(page.totalKnown).toBe(12);
  });

  // A broken adapter must fail loudly. Falling back to listItems() would read the vendor's
  // whole table on every page request while the capability screen still claimed paging.
  it('refuses a paged adapter that has no item page reader, and never reads the whole list', async () => {
    const adapter = new MockAccountingAdapter({
      items: items(30),
      readStrategy: 'REMOTE_PAGED',
    });

    (adapter as unknown as { readItemPage?: unknown }).readItemPage = undefined;

    const listItems = vi.spyOn(adapter, 'listItems');

    await expect(
      loadItemMappingPage(itemInput(adapter), { execute, storage: storage() }),
    ).rejects.toMatchObject({ code: 'ADAPTER_CONTRACT_INCOMPLETE' });

    expect(listItems).not.toHaveBeenCalled();
  });

  it('refuses a paged adapter that has no party page reader, and never reads the whole list', async () => {
    const adapter = new MockAccountingAdapter({
      parties: Array.from({ length: 30 }, (_, index) => party(index)),
      readStrategy: 'REMOTE_PAGED',
    });

    (adapter as unknown as { readPartyPage?: unknown }).readPartyPage = undefined;

    const listParties = vi.spyOn(adapter, 'listParties');

    await expect(
      loadPartyMappingPage(partyInput(adapter), { execute, storage: storage() }),
    ).rejects.toMatchObject({ code: 'ADAPTER_CONTRACT_INCOMPLETE' });

    expect(listParties).not.toHaveBeenCalled();
  });
});



