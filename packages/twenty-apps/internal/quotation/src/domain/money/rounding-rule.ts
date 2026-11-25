import { accepted, refused, type Result } from 'src/domain/shared/result';
import { MICROS_PER_UNIT } from 'src/domain/money/micros';

// Named payable rounding rules: floor the document payable to an integer-rial step.
// Tax, duty, and Hamilton allocation stay untouched; only the final payable uses this.

export type RoundingRuleCatalogEntry = {
  recordId: string;
  // Stable code snapshotted on the quotation (not the mutable display name).
  id: string;
  label: string;
  // Positive whole IRR count. Arbitrary values (e.g. 99) are first-class.
  stepRials: bigint;
  isActive: boolean;
  isDefault: boolean;
  position: number;
};

export type RoundingRuleSnapshot = {
  code: string;
  name: string;
  stepRials: bigint;
  recordId: string | null;
};

// Legacy documents and callers that omit a rule keep whole-rial floor (step 1).
export const DEFAULT_ROUNDING_STEP_RIALS = 1n;

export const SEED_ROUNDING_RULE_STEPS = [
  10n,
  100n,
  1000n,
  10000n,
  100000n,
  1000000n,
] as const;

export const seedRoundingRuleLabel = (stepRials: bigint): string =>
  `مبنای ${stepRials.toString()} ریال`;

export const seedRoundingRuleCode = (stepRials: bigint): string =>
  `STEP_${stepRials.toString()}`;

// Positive integer rials only — zero, negative, fraction, or non-digits refused.
export const parseStepRialsText = (text: string): Result<bigint> => {
  const trimmed = text.trim().replace(/[,\u066C\u060C\s]/g, '');
  const persianDigits = trimmed.replace(/[\u06F0-\u06F9]/g, (digit) =>
    String(digit.charCodeAt(0) - 0x06f0),
  );

  if (!/^[1-9]\d{0,17}$/.test(persianDigits)) {
    return refused(
      'ROUNDING_STEP_INVALID',
      'مبنای رُند باید عدد صحیح مثبت برحسب ریال باشد',
    );
  }

  return accepted(BigInt(persianDigits));
};

export const validateRoundingStepRials = (stepRials: bigint): Result<bigint> => {
  if (stepRials <= 0n) {
    return refused(
      'ROUNDING_STEP_INVALID',
      'مبنای رُند باید عدد صحیح مثبت برحسب ریال باشد',
    );
  }

  return accepted(stepRials);
};

// payable = floor(raw / (S * 1e6)) * (S * 1e6); adjustment = payable − raw ≤ 0.
export const floorMicrosToStepRials = (
  micros: bigint,
  stepRials: bigint,
): Result<{ payableMicros: bigint; roundingMicros: bigint }> => {
  const step = validateRoundingStepRials(stepRials);

  if (!step.ok) {
    return step;
  }

  const stepMicros = step.value * MICROS_PER_UNIT;

  if (micros >= 0n) {
    const payableMicros = (micros / stepMicros) * stepMicros;

    return accepted({
      payableMicros,
      roundingMicros: payableMicros - micros,
    });
  }

  // Toward −∞ for credit-note safety (same spirit as whole-rial floor).
  if (micros % stepMicros === 0n) {
    return accepted({ payableMicros: micros, roundingMicros: 0n });
  }

  const payableMicros = (micros / stepMicros - 1n) * stepMicros;

  return accepted({
    payableMicros,
    roundingMicros: payableMicros - micros,
  });
};

// Positive pre-round that floors to zero must not become a free quotation.
export const assertPayableNotSilentlyZero = ({
  rawPayableMicros,
  payableMicros,
}: {
  rawPayableMicros: bigint;
  payableMicros: bigint;
}): Result<true> => {
  if (rawPayableMicros > 0n && payableMicros === 0n) {
    return refused(
      'PAYABLE_ROUNDED_TO_ZERO',
      'مبلغ پس از رُند کردن صفر می‌شود؛ مبنای کوچک‌تری انتخاب کنید یا مبلغ را افزایش دهید',
    );
  }

  return accepted(true);
};

export const selectDefaultRoundingRule = (
  entries: RoundingRuleCatalogEntry[],
): RoundingRuleCatalogEntry | null => {
  const active = entries.filter((entry) => entry.isActive);

  return (
    active.find((entry) => entry.isDefault) ??
    active[0] ??
    null
  );
};

export const findRoundingRuleByCode = (
  entries: RoundingRuleCatalogEntry[],
  code: string | null | undefined,
): RoundingRuleCatalogEntry | null => {
  if (code === null || code === undefined || code.trim() === '') {
    return null;
  }

  const normalized = code.trim();

  return entries.find((entry) => entry.id === normalized) ?? null;
};

export const toRoundingRuleSnapshot = (
  entry: RoundingRuleCatalogEntry,
): RoundingRuleSnapshot => ({
  code: entry.id,
  name: entry.label,
  stepRials: entry.stepRials,
  recordId: entry.recordId,
});
