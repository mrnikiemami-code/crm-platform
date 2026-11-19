import {
  buildActiveCatalogItemsPageQuery,
  buildDefaultPriceListQuery,
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
  description: string | null;
  unitPriceExact: string | null;
  priceAvailable: boolean;
  priceMessage: string | null;
};

export type CatalogPickerPage = {
  items: CatalogPickerItem[];
  endCursor: string | null;
  hasNextPage: boolean;
  pageSize: number;
};

export type CatalogPickerDependencies = {
  execute: (query: string) => Promise<Record<string, unknown>>;
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

const resolveDefaultPriceListId = async (
  execute: CatalogPickerDependencies['execute'],
): Promise<string | null> => {
  const preferred = await execute(buildDefaultPriceListQuery());
  const preferredEdge = readEdges(preferred, 'priceLists')[0];

  return preferredEdge ? readString(preferredEdge.node.id) || null : null;
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
  const limitedPageSize = Math.min(Math.max(pageSize, 1), CATALOG_PICKER_PAGE_SIZE);
  const pagePayload = await dependencies.execute(
    buildActiveCatalogItemsPageQuery({
      search,
      afterCursor,
      first: limitedPageSize,
    }),
  );

  const edges = readEdges(pagePayload, 'catalogItems');
  const pageInfo = readPageInfo(pagePayload, 'catalogItems');
  const itemIds = edges.map((edge) => readString(edge.node.id)).filter(Boolean);

  const priceListId = await resolveDefaultPriceListId(dependencies.execute);
  const pricesByItemId = new Map<string, PriceCandidate[]>();

  if (priceListId !== null && itemIds.length > 0) {
    const pricesPayload = await dependencies.execute(
      buildPricesForItemsOnListQuery({ itemIds, priceListId }),
    );

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

    items.push({
      id,
      name: readString(edge.node.name),
      kind,
      sku: readNullableString(edge.node.sku),
      unit: readString(edge.node.unit) || (kind === 'SERVICE' ? 'ساعت' : 'عدد'),
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
  };
};
