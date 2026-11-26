import {
  type ItemImportDecision,
  type ItemImportRow,
} from 'src/domain/accounting/import-plan';
import { formatMicrosExact, parseMicrosExact } from 'src/domain/money/micros';

// Fills a PAGE of destination rows with the CRM side of the comparison.
//
// WHY THIS IS A SEPARATE STEP FROM PLANNING: the plan (duplicates, numeric ids, price units)
// belongs to the whole destination snapshot. What a row can ATTACH to belongs to the CRM,
// and resolving that for 20 000 rows to show 25 is the very scan this task removes. So the
// page is planned first, its SKUs and linked ids are looked up in one batched query, and
// only the rows on screen are enriched.
//
// Everything here is pure: the caller has already done the one query.

export type CrmItemMatch = {
  id: string;
  name: string;
  sku: string | null;
  priceMicros: string | null;
};

export type CrmItemIndex = {
  bySku: Map<string, CrmItemMatch[]>;
  byId: Map<string, CrmItemMatch>;
};

const emptyIndex = (): CrmItemIndex => ({
  bySku: new Map(),
  byId: new Map(),
});

const pushSku = (
  index: CrmItemIndex,
  sku: string,
  match: CrmItemMatch,
): void => {
  const current = index.bySku.get(sku) ?? [];
  current.push(match);
  index.bySku.set(sku, current);
};

export const buildCrmItemIndex = (matches: CrmItemMatch[]): CrmItemIndex => {
  const index = emptyIndex();

  for (const match of matches) {
    index.byId.set(match.id, match);

    const sku = match.sku?.trim() ?? '';

    if (sku !== '') {
      pushSku(index, sku, match);
    }
  }

  return index;
};

// The destination page names the SKUs and linked ids worth asking about. Both arms are
// deduplicated and capped, so the query stays proportional to the page and not the catalog.
export const collectItemLookupKeys = (
  rows: ItemImportRow[],
): { skus: string[]; ids: string[] } => {
  const skus = new Set<string>();
  const ids = new Set<string>();

  for (const row of rows) {
    const sku = row.code.trim();

    if (sku !== '') {
      skus.add(sku);
    }

    if (row.existingLinkId !== null && row.suggestedInternalItemId !== null) {
      ids.add(row.suggestedInternalItemId);
    }
  }

  return { skus: [...skus], ids: [...ids] };
};

const priceDifference = (
  destinationPriceMicros: string | null,
  crmPriceMicros: string | null,
): string | null => {
  if (destinationPriceMicros === null || crmPriceMicros === null) {
    return null;
  }

  const destination = parseMicrosExact(destinationPriceMicros);
  const crm = parseMicrosExact(crmPriceMicros);

  return destination.ok && crm.ok
    ? formatMicrosExact(destination.value - crm.value)
    : null;
};

export const enrichItemPage = ({
  rows,
  index,
}: {
  rows: ItemImportRow[];
  index: CrmItemIndex;
}): ItemImportRow[] =>
  rows.map((row) => {
    // An existing link wins: it is the mapping that is actually stored, and offering a
    // different CRM item next to it would invite a person to "confirm" a change that is
    // really an overwrite.
    const comparable =
      row.existingLinkId !== null && row.suggestedInternalItemId !== null
        ? (index.byId.get(row.suggestedInternalItemId) ?? null)
        : null;

    const matches = row.existingLinkId !== null ? [] : (index.bySku.get(row.code.trim()) ?? []);
    const suggestion = comparable ?? (matches.length === 1 ? matches[0] : null);
    const crmPriceMicros = suggestion?.priceMicros ?? null;
    const difference = priceDifference(row.priceMicros, crmPriceMicros);
    const decision: ItemImportDecision =
      row.decision === 'DUPLICATE_REMOTE_CODE' ? row.decision :
      row.existingLinkId !== null
        ? comparable === null ? 'LINK_AMBIGUOUS'
          : row.decision === 'REMOTE_CHANGED' || row.name.trim() !== comparable.name.trim() ||
            (row.priceMicros !== null && (difference === null || difference !== formatMicrosExact(0n)))
            ? 'REMOTE_CHANGED' : 'IN_SYNC'
        : matches.length === 1 ? 'LINK_SUGGESTED' : matches.length > 1 ? 'LINK_AMBIGUOUS' : 'CREATE';

    return {
      ...row,
      decision,
      suggestedInternalItemId:
        decision === 'DUPLICATE_REMOTE_CODE' ? null : (suggestion?.id ?? null),
      suggestedInternalItemName:
        decision === 'DUPLICATE_REMOTE_CODE' ? null : (suggestion?.name ?? null),
      crmPriceMicros,
      priceDifferenceMicros:
        decision === 'DUPLICATE_REMOTE_CODE'
          ? null
          : priceDifference(row.priceMicros, crmPriceMicros),
    };
  });

// The counts a person acts on. Deliberately NOT one bucket per internal decision name: a
// business screen says "۳۳ مورد وصل نشده", not "CREATE: 30, LINK_SUGGESTED: 3". The
// internal name still travels with each row for apply.
export type ItemMappingSummary = {
  linked: number;
  unlinked: number;
  blocked: number;
  needsAttention: number;
};

// The full decision histogram, for callers that still speak the internal vocabulary (the
// apply path and its tests). The business summary above is what a screen shows.
export const countItemDecisions = (
  rows: ItemImportRow[],
): Record<ItemImportDecision, number> => {
  const counts: Record<ItemImportDecision, number> = {
    CREATE: 0,
    LINK_SUGGESTED: 0,
    LINK_AMBIGUOUS: 0,
    IN_SYNC: 0,
    REMOTE_CHANGED: 0,
    DUPLICATE_REMOTE_CODE: 0,
  };

  for (const row of rows) {
    counts[row.decision] += 1;
  }

  return counts;
};

export const summarizeItemDecisions = (
  rows: ItemImportRow[],
): ItemMappingSummary => {
  const summary: ItemMappingSummary = {
    linked: 0,
    unlinked: 0,
    blocked: 0,
    needsAttention: 0,
  };

  for (const row of rows) {
    if (row.decision === 'IN_SYNC' || row.decision === 'REMOTE_CHANGED') {
      summary.linked += 1;
    } else if (row.decision === 'DUPLICATE_REMOTE_CODE') {
      summary.blocked += 1;
    } else {
      summary.unlinked += 1;
    }

    if (row.warnings.length > 0) {
      summary.needsAttention += 1;
    }
  }

  return summary;
};

// A destination customer is attached to a CRM person/company chosen explicitly. There is no
// fuzzy auto-match: a wrong attachment sends a real customer's quotation to another
// customer's accounting record. The picker's response is only carried through.
export type PartyCandidatePage = {
  rows: { id: string; label: string; detail: string | null }[];
  hasNextPage: boolean;
  endCursor: string | null;
  totalKnown: number | null;
};
