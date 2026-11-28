import { buildIrrPriceListsForPickerQuery } from 'src/data/quotation-queries';
import { executeRecordGraphql } from 'src/data/record-api';

export type IrrPriceListOption = { id: string; name: string; isDefault: boolean };
export const loadIrrPriceListOptions = async (): Promise<IrrPriceListOption[]> => {
  const rows: IrrPriceListOption[] = [];
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let after: string | null = null;
  for (;;) {
    const result = await executeRecordGraphql(buildIrrPriceListsForPickerQuery(after));
    const page = result.priceLists as { edges?: { node?: Record<string, unknown> }[]; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } } | undefined;
    if (!Array.isArray(page?.edges) || typeof page.pageInfo?.hasNextPage !== 'boolean') throw new Error('Incomplete price lists');
    for (const edge of page.edges) {
      const row = edge.node;
      if (!row || typeof row.id !== 'string' || !row.id || typeof row.name !== 'string' || !row.name.trim() || row.currencyCode !== 'IRR' || ids.has(row.id)) throw new Error('Invalid price list identity');
      ids.add(row.id); rows.push({ id: row.id, name: row.name.trim(), isDefault: row.isDefault === true });
    }
    if (!page.pageInfo.hasNextPage) return rows;
    const next = page.pageInfo.endCursor;
    if (!next || cursors.has(next) || cursors.size >= 20) throw new Error('Incomplete price lists');
    cursors.add(next); after = next;
  }
};
