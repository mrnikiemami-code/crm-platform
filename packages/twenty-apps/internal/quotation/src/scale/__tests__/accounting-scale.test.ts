import { describe, expect, it } from 'vitest';

import type { Result } from 'src/domain/shared/result';
import type { ItemImportRow } from 'src/domain/accounting/import-plan';
import type { PagedRows } from 'src/domain/accounting/pagination';
import {
  buildItemSnapshot,
  buildPartySnapshot,
  itemRowHaystack,
  type DestinationSnapshot,
} from 'src/services/accounting-destination-snapshot.service';
import {
  createMemorySnapshotStorage,
  readSnapshotPage,
  writeSnapshot,
} from 'src/services/accounting-snapshot-storage';
import { searchCustomersForPicker } from 'src/services/customer-picker.service';

// Scale suite. Excluded from the default run because it holds a 1,000,000-row index in
// memory; run it with `CRM129_SCALE=1 npx vitest run src/scale`.
//
// It measures the CONTRACT at scale, not Postgres: the database side is proven by
// scripts/scale-harness.cjs against a real 1,000,000-row table. What these tests add is that
// the application never asks for more than a page and never accumulates rows as it walks.
const ENABLED = process.env.CRM129_SCALE === '1';

const unwrapSnapshot = (
  result: Result<DestinationSnapshot>,
): DestinationSnapshot => {
  if (!result.ok) {
    throw new Error(`expected a snapshot, got ${result.refusal.code}`);
  }

  return result.value;
};

describe.skipIf(!ENABLED)('accounting scale contract', () => {
  it('pages a 100,000-item destination inside a bounded snapshot', async () => {
    const remoteItems = Array.from({ length: 100_000 }, (_, index) => ({
      externalItemId: String(index + 1),
      code: String(100_000 + index),
      name: `کالای ${index}`,
      secondaryName: null,
      sellPriceUnits: 1_000_000,
      salesPriceUnits: [],
      stock: null,
      remoteVersion: `v-${index}`,
      isActive: true,
    }));

    const heapBefore = process.memoryUsage().heapUsed;
    const buildStarted = performance.now();
    const snapshot = unwrapSnapshot(
      buildItemSnapshot({
        snapshotId: 'scale-items',
        nowMs: 0,
        remoteItems,
        links: [],
        moneyUnit: 'RIAL',
      }),
    );
    const buildMs = performance.now() - buildStarted;
    const heapAfter = process.memoryUsage().heapUsed;

    expect(snapshot.meta.truncation).toEqual({
      kind: 'BOUNDED',
      taken: 20_000,
      limit: 20_000,
      declaredTotal: 100_000,
    });
    // Truncation is reported as an incomplete sync, not as a full destination.
    expect(snapshot.meta.syncStatus).toBe('INCOMPLETE');

    const storage = createMemorySnapshotStorage();
    const entry = await writeSnapshot({
      storage,
      key: 'scale-items',
      nowMs: 0,
      meta: snapshot.meta,
      itemRows: snapshot.itemRows,
      partyRows: [],
      itemSummary: snapshot.itemSummary,
      partySummary: {},
    });

    const pageDurations: number[] = [];
    let cursor: string | null = null;
    let pages = 0;
    let rowsOnLastPage = 0;

    do {
      const started = performance.now();
      const page: PagedRows<ItemImportRow> = await readSnapshotPage<ItemImportRow>({
        storage,
        key: entry.key,
        revision: entry,
        request: { cursor, pageSize: 25, search: '' },
        resource: 'ITEMS',
        haystack: itemRowHaystack,
      });
      pageDurations.push(performance.now() - started);

      expect(page.rows.length).toBeLessThanOrEqual(25);
      rowsOnLastPage = page.rows.length;
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor !== null && pages < 1_000);

    console.log(
      JSON.stringify({
        suite: 'destination-snapshot',
        remoteItems: remoteItems.length,
        kept: snapshot.itemRows.length,
        buildMs: Number(buildMs.toFixed(1)),
        snapshotHeapMb: Number(((heapAfter - heapBefore) / 1024 / 1024).toFixed(1)),
        pages,
        pagesPerSecond: Number((pages / (pageDurations.reduce((a, b) => a + b, 0) / 1000)).toFixed(0)),
        slowestPageMs: Number(Math.max(...pageDurations).toFixed(3)),
        rowsOnLastPage,
      }),
    );
  });

  it('refuses a 1,000,000-customer unpaged destination instead of holding it', () => {
    const remoteParties = Array.from({ length: 1_000_000 }, (_, index) => ({
      externalPartyId: String(index + 1),
      code: String(index + 1),
      fullName: `مشتری ${index}`,
      mobile: null,
      nationalCode: null,
      remoteVersion: `p-${index}`,
    }));

    const started = performance.now();
    const built = buildPartySnapshot({
      snapshotId: 'scale-oversize',
      nowMs: 0,
      remoteParties,
      links: [],
      limit: 20_000,
      hardMax: 100_000,
    });
    const elapsedMs = performance.now() - started;

    expect(built.ok).toBe(false);

    if (built.ok) {
      throw new Error('expected the oversized destination to be refused');
    }

    expect(built.refusal.code).toBe('REMOTE_DATASET_TOO_LARGE');
    // The refusal must not have built 1,000,000 import rows: a guard that only fails after
    // planning is a guard that already spent the memory it was protecting.
    expect(elapsedMs).toBeLessThan(2_000);

    console.log(
      JSON.stringify({
        suite: 'unpaged-oversize',
        parties: remoteParties.length,
        refusedInMs: Math.round(elapsedMs),
      }),
    );
  });

  it('walks 1,000,000 CRM customers one page at a time without accumulating rows', async () => {
    const TOTAL = 1_000_000;
    const PAGE = 25;
    // A stand-in for the server: it holds no rows, only the arithmetic of an indexed
    // table. Every request returns one page, exactly as the real GraphQL connection does.
    const requests: { first: number; after: string | null }[] = [];
    const execute = async (query: string) => {
      const first = Number.parseInt(/first: (\d+)/.exec(query)?.[1] ?? '0', 10);
      const afterMatch = /after: "([^"]+)"/.exec(query);
      const after = afterMatch === null ? null : afterMatch[1];
      const offset = after === null ? 0 : Number.parseInt(after, 10);

      requests.push({ first, after });

      const count = Math.max(0, Math.min(first, TOTAL - offset));
      const edges = Array.from({ length: count }, (_, index) => {
        const position = offset + index;

        return {
          cursor: String(position + 1),
          node: {
            id: `person-${position}`,
            name: {
              firstName: `مشتری ${position}`,
              lastName: `خانواده ${position}`,
            },
            jobTitle: null,
            emails: { primaryEmail: null },
          },
        };
      });

      return {
        people: {
          edges,
          pageInfo: {
            hasNextPage: offset + count < TOTAL,
            endCursor: edges.length === 0 ? null : edges[edges.length - 1].cursor,
          },
        },
      };
    };

    const started = performance.now();
    let cursor: string | null = null;
    let pages = 0;
    let rowsSeen = 0;
    let maxRowCount = 0;

    do {
      const page = await searchCustomersForPicker(
        { customerType: 'PERSON', search: '', afterCursor: cursor, pageSize: PAGE },
        { execute },
      );

      maxRowCount = Math.max(maxRowCount, page.rows.length);
      rowsSeen += page.rows.length;
      cursor = page.endCursor;
      pages += 1;

      // A page that grew with the dataset would fail here on the first iteration.
      expect(page.rows.length).toBeLessThanOrEqual(PAGE);
    } while (cursor !== null && pages < 40_001);

    const elapsedMs = performance.now() - started;

    expect(rowsSeen).toBe(TOTAL);
    expect(requests.length).toBe(pages);

    // Every single request asked for a page, never for the table.
    expect(requests.every((request) => request.first <= PAGE)).toBe(true);
    expect(maxRowCount).toBeLessThanOrEqual(PAGE);

    console.log(
      JSON.stringify({
        suite: 'crm-customers',
        total: TOTAL,
        pages,
        requests: requests.length,
        rowsSeen,
        maxRowsInOneResponse: maxRowCount,
        elapsedMs: Math.round(elapsedMs),
      }),
    );
  });
});
