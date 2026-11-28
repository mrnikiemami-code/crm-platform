import { describe, expect, it } from 'vitest';

import { mapVendorPriceTiersToPriceLists } from 'src/domain/catalog/vendor-price-tier-mapping';

describe('vendor price tier mapping', () => {
  it('requires explicit price-list bindings and preserves explicit zero', () => {
    const refused = mapVendorPriceTiersToPriceLists({
      observation: { priceUnitsByPosition: ['0', '1500'] },
      bindings: [],
    });

    expect(refused.ok).toBe(false);

    const mapped = mapVendorPriceTiersToPriceLists({
      observation: { priceUnitsByPosition: ['0', '1500'] },
      bindings: [
        { position: 1, priceListId: 'list-a' },
        { position: 2, priceListId: 'list-b' },
      ],
    });

    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.value[0]).toMatchObject({
        amountUnitsText: '0',
        isExplicitZero: true,
        priceListId: 'list-a',
      });
      expect(mapped.value[1]).toMatchObject({
        amountUnitsText: '1500',
        isExplicitZero: false,
      });
    }
  });

  it('treats missing positional slots as null rather than zero', () => {
    const mapped = mapVendorPriceTiersToPriceLists({
      observation: { priceUnitsByPosition: ['10'] },
      bindings: [
        { position: 1, priceListId: 'list-a' },
        { position: 2, priceListId: 'list-b' },
      ],
    });

    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.value[1].amountUnitsText).toBeNull();
      expect(mapped.value[1].isExplicitZero).toBe(false);
    }
  });
});
