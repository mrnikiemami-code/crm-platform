import {
  buildCatalogPageWithDefaultPriceListQuery,
  buildPricesForItemsOnListQuery,
  CATALOG_PICKER_PAGE_SIZE,
} from 'src/data/quotation-queries';
import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import {
  type PriceCandidate,
  selectCurrentPriceExact,
} from 'src/domain/catalog/price-snapshot';

export type CatalogPickerItem = {
  id: string;
  name: string;
  kind: CatalogItemKind;
  sku: string | null;
  unit: string;
  unitRecordId?: string | null;
  description: string | null;
  unitPriceExact: string | null;
  priceAvailable: boolean;
  priceMessage: string | null;
};

export type CatalogPickerTimings = {
  catalogItemsMs: number;
  priceListMs: number;
  pricesMs: number;
  totalMs: number;
  priceListCacheHit: boolean;
  combinedCatalogAndPriceList: boolean;
};

export type CatalogPickerPage = {
  items: CatalogPickerItem[];
  endCursor: string | null;
  hasNextPage: boolean;
  pageSize: number;
  timings: CatalogPickerTimings;
};

export type CatalogPickerDependencies = {
  execute: (query: string) => Promise<Record<string, unknown>>;
  nowMs?: () => number;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const readNullableString = (value: unknown): string | null => {
  const text = readString(value);

  return text === '' ? null : text;
};

const readEdges = (
  payload: Record<string, unknown>,
  connectionName: string,
): Array<{ cursor: string; node: Record<string, unknown> }> => {
  const connection = asRecord(payload[connectionName]);
  const edges = connection?.edges;

  if (!Array.isArray(edges)) {
    return [];
  }

  const rows: Array<{ cursor: string; node: Record<string, unknown> }> = [];

  for (const edge of edges) {
    const record = asRecord(edge);
    const node = asRecord(record?.node);

    if (node === null) {
      continue;
    }

    rows.push({
      cursor: readString(record?.cursor),
      node,
    });
  }

  return rows;
};

const readPageInfo = (
  payload: Record<string, unknown>,
  connectionName: string,
): { hasNextPage: boolean; endCursor: string | null } => {
  const connection = asRecord(payload[connectionName]);
  const pageInfo = asRecord(connection?.pageInfo);

  return {
    hasNextPage: pageInfo?.hasNextPage === true,
    endCursor: readNullableString(pageInfo?.endCursor),
  };
};

export const searchCatalogItemsForPicker = async (
  {
    search,
    afterCursor,
    pageSize = CATALOG_PICKER_PAGE_SIZE,
  }: {
    search: string;
    afterCursor: string | null;
    pageSize?: number;
  },
  dependencies: CatalogPickerDependencies,
): Promise<CatalogPickerPage> => {
  const nowMs = dependencies.nowMs ?? (() => Date.now());
  const totalStarted = nowMs();
  const limitedPageSize = Math.min(Math.max(pageSize, 1), CATALOG_PICKER_PAGE_SIZE);

  const combinedStarted = nowMs();
  const pagePayload = await dependencies.execute(
    buildCatalogPageWithDefaultPriceListQuery({
      search,
      afterCursor,
      first: limitedPageSize,
    }),
  );
  const combinedMs = nowMs() - combinedStarted;

  const edges = readEdges(pagePayload, 'catalogItems');
  const pageInfo = readPageInfo(pagePayload, 'catalogItems');
  const itemIds = edges.map((edge) => readString(edge.node.id)).filter(Boolean);
  const priceListEdge = readEdges(pagePayload, 'priceLists')[0];
  const priceListId = priceListEdge
    ? readString(priceListEdge.node.id) || null
    : null;

  let pricesMs = 0;
  const pricesByItemId = new Map<string, PriceCandidate[]>();

  if (priceListId !== null && itemIds.length > 0) {
    const pricesStarted = nowMs();
    const pricesPayload = await dependencies.execute(
      buildPricesForItemsOnListQuery({
        itemIds,
        priceListId,
      }),
    );
    pricesMs = nowMs() - pricesStarted;

    for (const edge of readEdges(pricesPayload, 'prices')) {
      const itemId = readString(edge.node.itemId);

      if (itemId === '') {
        continue;
      }

      const candidate: PriceCandidate = {
        unitPriceExact: readString(edge.node.unitPriceExact),
        validFrom: readNullableString(edge.node.validFrom),
        validTo: readNullableString(edge.node.validTo),
      };
      const current = pricesByItemId.get(itemId) ?? [];
      current.push(candidate);
      pricesByItemId.set(itemId, current);
    }
  }

  const seenIds = new Set<string>();
  const items: CatalogPickerItem[] = [];

  for (const edge of edges) {
    const id = readString(edge.node.id);

    if (id === '' || seenIds.has(id)) {
      continue;
    }

    seenIds.add(id);

    const kind =
      readString(edge.node.kind) === 'SERVICE' ? 'SERVICE' : 'PRODUCT';
    const priceResult = selectCurrentPriceExact(
      pricesByItemId.get(id) ?? [],
    );

    const unitRecord = asRecord(edge.node.unitRecord);
    const unitRecordId = unitRecord?.isActive === true ? readNullableString(unitRecord.id) : null;
    items.push({
      id,
      name: readString(edge.node.name),
      kind,
      sku: readNullableString(edge.node.sku),
      unit: unitRecordId ? readString(unitRecord?.name) : readString(edge.node.unit),
      unitRecordId,
      description: readNullableString(edge.node.description),
      unitPriceExact: priceResult.ok ? priceResult.value : null,
      priceAvailable: priceResult.ok,
      priceMessage: priceResult.ok ? null : priceResult.refusal.detail,
    });
  }

  return {
    items,
    endCursor: pageInfo.endCursor,
    hasNextPage: pageInfo.hasNextPage,
    pageSize: limitedPageSize,
    timings: {
      // Combined root query — wall time attributed once to both stages.
      catalogItemsMs: combinedMs,
      priceListMs: combinedMs,
      pricesMs,
      totalMs: nowMs() - totalStarted,
      priceListCacheHit: false,
      combinedCatalogAndPriceList: true,
    },
  };
};

// Kept for unit-test reset compatibility after earlier cache experiments.
export const clearDefaultPriceListCacheForTests = (): void => {
  // no-op: process cache removed; combined query is the durable optimization
};
