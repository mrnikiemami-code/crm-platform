import { describe, expect, it } from 'vitest';

import { MICROS_PER_UNIT } from 'src/domain/money/micros';
import {
  assertPayableNotSilentlyZero,
  floorMicrosToStepRials,
  parseStepRialsText,
  selectDefaultRoundingRule,
  type RoundingRuleCatalogEntry,
} from 'src/domain/money/rounding-rule';

const unwrap = <TValue>(
  result: { ok: true; value: TValue } | { ok: false; refusal: { code: string } },
): TValue => {
  if (!result.ok) {
    throw new Error(`expected success, got ${result.refusal.code}`);
  }

  return result.value;
};

const rials = (amount: bigint): bigint => amount * MICROS_PER_UNIT;

describe('parseStepRialsText', () => {
  it('accepts arbitrary positive integers including 99', () => {
    expect(unwrap(parseStepRialsText('99'))).toBe(99n);
    expect(unwrap(parseStepRialsText('۱۰۰۰'))).toBe(1000n);
    expect(unwrap(parseStepRialsText('1,000'))).toBe(1000n);
  });

  it('refuses zero, negative, fraction, and empty', () => {
    expect(parseStepRialsText('0').ok).toBe(false);
    expect(parseStepRialsText('-10').ok).toBe(false);
    expect(parseStepRialsText('10.5').ok).toBe(false);
    expect(parseStepRialsText('').ok).toBe(false);
  });
});

describe('floorMicrosToStepRials', () => {
  it('matches architect examples for 99, 100, and 1000', () => {
    const s99 = unwrap(floorMicrosToStepRials(rials(11025n), 99n));
    expect(s99.payableMicros).toBe(rials(10989n));
    expect(s99.roundingMicros).toBe(rials(-36n));

    const s100 = unwrap(floorMicrosToStepRials(rials(10025n), 100n));
    expect(s100.payableMicros).toBe(rials(10000n));
    expect(s100.roundingMicros).toBe(rials(-25n));

    const s1000 = unwrap(floorMicrosToStepRials(rials(218035n), 1000n));
    expect(s1000.payableMicros).toBe(rials(218000n));
    expect(s1000.roundingMicros).toBe(rials(-35n));
  });

  it('floors with sub-rial micros without float', () => {
    const raw = 10_025n * MICROS_PER_UNIT + 500_000n;
    const result = unwrap(floorMicrosToStepRials(raw, 100n));

    expect(result.payableMicros).toBe(rials(10000n));
    expect(result.roundingMicros).toBe(-(25n * MICROS_PER_UNIT + 500_000n));
  });

  it('keeps step=1 as whole-rial floor', () => {
    const raw = 1_000n * MICROS_PER_UNIT + 400_000n;
    const result = unwrap(floorMicrosToStepRials(raw, 1n));

    expect(result.payableMicros).toBe(rials(1000n));
    expect(result.roundingMicros).toBe(-400_000n);
  });

  it('refuses invalid steps', () => {
    expect(floorMicrosToStepRials(rials(100n), 0n).ok).toBe(false);
    expect(floorMicrosToStepRials(rials(100n), -5n).ok).toBe(false);
  });
});

describe('assertPayableNotSilentlyZero', () => {
  it('refuses positive raw that floors to zero', () => {
    const result = assertPayableNotSilentlyZero({
      rawPayableMicros: rials(50n),
      payableMicros: 0n,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal.code).toBe('PAYABLE_ROUNDED_TO_ZERO');
    }
  });

  it('allows true zero documents', () => {
    expect(
      assertPayableNotSilentlyZero({
        rawPayableMicros: 0n,
        payableMicros: 0n,
      }).ok,
    ).toBe(true);
  });
});

describe('selectDefaultRoundingRule', () => {
  it('prefers the active default', () => {
    const entries: RoundingRuleCatalogEntry[] = [
      {
        recordId: 'a',
        id: 'STEP_10',
        label: '10',
        stepRials: 10n,
        isActive: true,
        isDefault: false,
        position: 0,
      },
      {
        recordId: 'b',
        id: 'STEP_1000',
        label: '1000',
        stepRials: 1000n,
        isActive: true,
        isDefault: true,
        position: 1,
      },
    ];

    expect(selectDefaultRoundingRule(entries)?.id).toBe('STEP_1000');
  });
});
