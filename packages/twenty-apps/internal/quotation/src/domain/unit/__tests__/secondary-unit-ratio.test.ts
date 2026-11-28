import { describe, expect, it } from 'vitest';

import {
  convertSecondaryQuantityToPrimary,
  resolveSecondaryUnitRatio,
} from 'src/domain/unit/secondary-unit-ratio';

describe('secondary unit ratio', () => {
  it('accepts an exact positive integer ProductUnitCount', () => {
    const result = resolveSecondaryUnitRatio({
      secondaryUnitName: 'بسته',
      unitCount: 12,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        secondaryUnitName: 'بسته',
        primaryPerSecondary: 12,
      });
    }
  });

  it('refuses fractional or missing ratios instead of inventing them', () => {
    expect(
      resolveSecondaryUnitRatio({
        secondaryUnitName: 'بسته',
        unitCount: 1.5,
      }).ok,
    ).toBe(false);
    expect(
      resolveSecondaryUnitRatio({
        secondaryUnitName: 'بسته',
        unitCount: null,
      }).ok,
    ).toBe(false);
  });

  it('converts secondary quantity only with a verified ratio', () => {
    const converted = convertSecondaryQuantityToPrimary({
      secondaryQuantity: 2,
      observation: { secondaryUnitName: 'بسته', unitCount: 12 },
    });

    expect(converted.ok).toBe(true);
    if (converted.ok) {
      expect(converted.value).toBe(24);
    }
  });
});
