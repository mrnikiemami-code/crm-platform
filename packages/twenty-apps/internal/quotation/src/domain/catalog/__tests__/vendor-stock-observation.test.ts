import { describe, expect, it } from 'vitest';

import {
  observeStockByVerifiedStores,
  observeTotalStock,
  observeVendorSerials,
} from 'src/domain/catalog/vendor-stock-observation';

describe('vendor stock and serial observation', () => {
  it('refuses stock-by-store without verified store identity', () => {
    expect(
      observeStockByVerifiedStores({
        observation: { stockByPosition: [0, 4] },
        stores: [],
      }).ok,
    ).toBe(false);
  });

  it('maps positional stock only through verified stores and keeps explicit zero', () => {
    const mapped = observeStockByVerifiedStores({
      observation: { stockByPosition: [0, 4] },
      stores: [
        {
          position: 1,
          externalStorageId: 'store-1',
          storeName: 'انبار مرکزی',
        },
        {
          position: 2,
          externalStorageId: 'store-2',
          storeName: 'انبار فرعی',
        },
      ],
    });

    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.value[0]).toMatchObject({
        quantity: 0,
        isExplicitZero: true,
        storeName: 'انبار مرکزی',
      });
      expect(mapped.value[1].quantity).toBe(4);
    }
  });

  it('collects serials for observation only', () => {
    expect(
      observeVendorSerials({
        serial: 'A-1',
        serials: ['A-2', 'A-1', ''],
      }).serials,
    ).toEqual(['A-1', 'A-2']);
    expect(observeTotalStock({ stock: 0 })).toBe(0);
    expect(observeTotalStock({ stock: null })).toBeNull();
  });
});
