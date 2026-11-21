import { describe, expect, it } from 'vitest';

import {
  buildTaxPolicyDefinition,
  formatBasisPointsAsPercent,
  parsePercentToBasisPoints,
  selectDefaultTaxPolicy,
  type TaxPolicyCatalogEntry,
} from 'src/domain/money/tax-policy';

const basisPointsOf = (text: string): bigint => {
  const result = parsePercentToBasisPoints(text);

  if (!result.ok) {
    throw new Error(`expected success, got ${result.refusal.code}`);
  }

  return result.value;
};

const refusalCodeOf = (text: string): string => {
  const result = parsePercentToBasisPoints(text);

  if (result.ok) {
    throw new Error(`expected a refusal, got ${result.value.toString()}`);
  }

  return result.refusal.code;
};

describe('parsePercentToBasisPoints', () => {
  it('parses ascii whole percentages', () => {
    expect(basisPointsOf('0')).toBe(0n);
    expect(basisPointsOf('9')).toBe(900n);
    expect(basisPointsOf('10')).toBe(1000n);
  });

  it('parses ascii decimal percentages', () => {
    expect(basisPointsOf('10.5')).toBe(1050n);
    expect(basisPointsOf('10.25')).toBe(1025n);
  });

  // The regression this test exists for: the momayyez used to be stripped,
  // which turned 10.5 into 105 and refused a perfectly valid rate.
  it('parses Persian decimal percentages written with the momayyez', () => {
    expect(basisPointsOf('۱۰٫۵')).toBe(1050n);
    expect(basisPointsOf('۹٫۵')).toBe(950n);
    expect(basisPointsOf('۱۰٫۲۵')).toBe(1025n);
  });

  it('parses Persian digits with an ascii dot or comma', () => {
    expect(basisPointsOf('۱۰.۵')).toBe(1050n);
    expect(basisPointsOf('۱۰,۵')).toBe(1050n);
  });

  it('ignores surrounding whitespace and the percent sign', () => {
    expect(basisPointsOf(' ۹٪ ')).toBe(900n);
    expect(basisPointsOf('10.5%')).toBe(1050n);
  });

  it('refuses a third fraction digit instead of rounding it', () => {
    expect(refusalCodeOf('10.555')).toBe('TAX_RATE_INVALID');
  });

  it('refuses a rate above one hundred percent', () => {
    expect(refusalCodeOf('101')).toBe('TAX_RATE_OUT_OF_RANGE');
  });

  it('refuses empty input', () => {
    expect(refusalCodeOf('   ')).toBe('TAX_RATE_REQUIRED');
  });
});

describe('formatBasisPointsAsPercent', () => {
  it('formats whole and decimal basis points without trailing zeros', () => {
    expect(formatBasisPointsAsPercent(0n)).toBe('0');
    expect(formatBasisPointsAsPercent(900n)).toBe('9');
    expect(formatBasisPointsAsPercent(1000n)).toBe('10');
    expect(formatBasisPointsAsPercent(1050n)).toBe('10.5');
    expect(formatBasisPointsAsPercent(1025n)).toBe('10.25');
  });
});

describe('buildTaxPolicyDefinition', () => {
  it('accepts a zero rate only when it is marked exempt', () => {
    expect(
      buildTaxPolicyDefinition({
        code: 'EXEMPT',
        label: 'معاف',
        rateBasisPoints: 0n,
        isExempt: true,
      }).ok,
    ).toBe(true);

    expect(
      buildTaxPolicyDefinition({
        code: 'EXEMPT',
        label: 'معاف',
        rateBasisPoints: 0n,
        isExempt: false,
      }).ok,
    ).toBe(false);
  });
});

describe('selectDefaultTaxPolicy', () => {
  const entry = (
    id: string,
    overrides: Partial<TaxPolicyCatalogEntry>,
  ): TaxPolicyCatalogEntry => ({
    id,
    label: id,
    rateBasisPoints: 900n,
    isExempt: false,
    recordId: `record-${id}`,
    isActive: true,
    isDefault: false,
    position: 0,
    ...overrides,
  });

  it('prefers the flagged default policy', () => {
    const selected = selectDefaultTaxPolicy([
      entry('A', { position: 0 }),
      entry('B', { isDefault: true, position: 1 }),
    ]);

    expect(selected?.id).toBe('B');
  });

  it('never selects an inactive policy', () => {
    const selected = selectDefaultTaxPolicy([
      entry('A', { isDefault: true, isActive: false }),
      entry('B', { position: 1 }),
    ]);

    expect(selected?.id).toBe('B');
  });
});
