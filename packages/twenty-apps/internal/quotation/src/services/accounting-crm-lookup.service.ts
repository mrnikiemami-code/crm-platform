import { buildMappingCrmItemsQuery, MAPPING_LOOKUP_MAX_IDS } from 'src/data/mapping-queries';
import { selectCurrentPriceExact } from 'src/domain/catalog/price-snapshot';
import { executeRecordGraphql } from 'src/data/record-api';
import {
  buildCrmItemIndex,
  type CrmItemIndex,
  type CrmItemMatch,
} from 'src/domain/accounting/mapping-page';

// Batched, bounded CRM reads for the mapping screens.
//
// Every function here takes a LIST OF KEYS THAT CAME FROM A PAGE and splits it into chunks
// of at most `MAPPING_LOOKUP_MAX_IDS`. That is the whole point: a destination with 100 000
// products never produces one query with 100 000 SKUs, and a page of 25 never produces 25
// queries.

export type CrmLookupDependencies = {
  execute?: (query: string) => Promise<Record<string, unknown>>;
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
  root: string,
): Record<string, unknown>[] => {
  const connection = asRecord(payload[root]);
  const edges = connection?.edges;

  if (!Array.isArray(edges)) {
    return [];
  }

  return edges.flatMap((edge) => {
    const node = asRecord(asRecord(edge)?.node);

    return node === null ? [] : [node];
  });
};

// Compare only prices from the workspace's default IRR list on today's date.
const readItemPriceMicros = (node: Record<string, unknown>, priceListId: string | null): string | null => {
  if (priceListId === null) return null;
  const prices = readEdges(node, 'prices').flatMap((price) => {
    if (readString(asRecord(price.priceList)?.id) !== priceListId) return [];
    return [{ unitPriceExact: readString(price.unitPriceExact), validFrom: readNullableString(price.validFrom), validTo: readNullableString(price.validTo) }];
  });
  const current = selectCurrentPriceExact(prices);
  return current.ok ? current.value : null;
};

export const readCrmItemMatches = (
  payload: Record<string, unknown>,
): CrmItemMatch[] =>
  readEdges(payload, 'catalogItems').flatMap((node) => {
    const id = readString(node.id);

    if (id === '') {
      return [];
    }

    return [
      {
        id,
        name: readString(node.name),
        sku: readNullableString(node.sku),
        ...(asRecord(node.unitRecord)?.isActive === true && readNullableString(asRecord(node.unitRecord)?.id) ? { unitRecordId: readNullableString(asRecord(node.unitRecord)?.id) } : {}),
        priceMicros: readItemPriceMicros(node, readNullableString(readEdges(payload, 'priceLists')[0]?.id)),
      },
    ];
  });

const chunk = <TValue>(values: TValue[], size: number): TValue[][] => {
  const chunks: TValue[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
};

const dedupe = (values: string[]): string[] => {
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim();

    if (trimmed !== '') {
      seen.add(trimmed);
    }
  }

  return [...seen];
};

export const loadCrmItemIndex = async (
  {
    skus,
    ids,
  }: {
    skus: string[];
    ids: string[];
  },
  dependencies: CrmLookupDependencies = {},
): Promise<CrmItemIndex> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const uniqueSkus = dedupe(skus);
  const uniqueIds = dedupe(ids);
  const matches: CrmItemMatch[] = [];
  const arms = Math.max(
    chunk(uniqueSkus, MAPPING_LOOKUP_MAX_IDS).length,
    chunk(uniqueIds, MAPPING_LOOKUP_MAX_IDS).length,
  );

  for (let arm = 0; arm < arms; arm += 1) {
    const skuChunk = chunk(uniqueSkus, MAPPING_LOOKUP_MAX_IDS)[arm] ?? [];
    const idChunk = chunk(uniqueIds, MAPPING_LOOKUP_MAX_IDS)[arm] ?? [];

    if (skuChunk.length === 0 && idChunk.length === 0) {
      continue;
    }

    const payload = await execute(
      buildMappingCrmItemsQuery({
        skus: skuChunk,
        ids: idChunk,
        priceListId: null,
      }),
    );

    matches.push(...readCrmItemMatches(payload));
  }

  return buildCrmItemIndex(matches);
};
