import { describe, expect, it, vi } from 'vitest';

import { searchCatalogItemsForPicker } from 'src/services/catalog-picker.service';

describe('searchCatalogItemsForPicker', () => {
  it('pages active items and attaches default-list prices without duplicates', async () => {
    const execute = vi.fn(async (query: string) => {
      if (query.includes('CatalogPageWithDefaultPriceList')) {
        return {
          catalogItems: {
            edges: [
              {
                cursor: 'c1',
                node: {
                  id: 'item-1',
                  name: 'پمپ',
                  kind: 'PRODUCT',
                  sku: 'P-1',
                  unit: 'عدد',
                  description: null,
                  isActive: true,
                },
              },
              {
                cursor: 'c1-dup',
                node: {
                  id: 'item-1',
                  name: 'پمپ',
                  kind: 'PRODUCT',
                  sku: 'P-1',
                  unit: 'عدد',
                  description: null,
                  isActive: true,
                },
              },
            ],
            pageInfo: { hasNextPage: true, endCursor: 'c1' },
          },
          priceLists: {
            edges: [{ cursor: 'pl', node: { id: 'list-1' } }],
          },
        };
      }

      if (query.includes('PricesForItemsOnList')) {
        return {
          prices: {
            edges: [
              {
                cursor: 'pr1',
                node: {
                  itemId: 'item-1',
                  unitPriceExact: '1500000.000000',
                  validFrom: null,
                  validTo: null,
                },
              },
            ],
          },
        };
      }

      throw new Error(`unexpected query: ${query.slice(0, 80)}`);
    });

    const page = await searchCatalogItemsForPicker(
      { search: 'پمپ', afterCursor: null },
      { execute },
    );

    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe('item-1');
    expect(page.items[0].unitPriceExact).toBe('1500000.000000');
    expect(page.items[0].priceAvailable).toBe(true);
    expect(page.hasNextPage).toBe(true);
    expect(page.endCursor).toBe('c1');
    expect(page.timings.combinedCatalogAndPriceList).toBe(true);
    // Combined catalog+priceList query, then prices.
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
