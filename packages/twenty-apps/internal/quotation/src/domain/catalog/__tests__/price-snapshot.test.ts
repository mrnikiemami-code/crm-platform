import { describe, expect, it } from 'vitest';

import {
  isPriceValidOnDay,
  selectCurrentCatalogPrice,
  selectCurrentPriceExact,
} from 'src/domain/catalog/price-snapshot';

describe('price snapshot selection', () => {
  it('prefers the currently valid default-list price', () => {
    const result = selectCurrentPriceExact(
      [
        {
          unitPriceExact: '100.000000',
          validFrom: '2020-01-01',
          validTo: '2020-12-31',
        },
        {
          unitPriceExact: '250.000000',
          validFrom: '2021-01-01',
          validTo: null,
        },
      ],
      '2026-11-19',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBe('250.000000');
  });

  it('refuses when no valid price exists', () => {
    const result = selectCurrentPriceExact(
      [
        {
          unitPriceExact: '100.000000',
          validFrom: '2020-01-01',
          validTo: '2020-12-31',
        },
      ],
      '2026-11-19',
    );

    expect(result.ok).toBe(false);
  });

  it('returns price identity metadata for the chosen row', () => {
    const result = selectCurrentCatalogPrice(
      [
        {
          id: 'price-1',
          unitPriceExact: '250.000000',
          validFrom: '2021-01-01',
          validTo: null,
        },
      ],
      '2026-11-19',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toEqual({
      unitPriceExact: '250.000000',
      priceId: 'price-1',
      validFrom: '2021-01-01',
    });
  });

  it('treats open windows as valid', () => {
    expect(
      isPriceValidOnDay(
        { unitPriceExact: '1.000000', validFrom: null, validTo: null },
        '2026-11-19',
      ),
    ).toBe(true);
  });
});
