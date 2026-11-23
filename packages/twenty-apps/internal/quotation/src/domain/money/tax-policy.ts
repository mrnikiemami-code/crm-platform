import {
  BASIS_POINTS_PER_PERCENT,
  isBasisPointsInRange,
} from 'src/domain/money/arithmetic';
import { toAsciiDigits } from 'src/domain/money/money-input-text';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Tax policies are workspace data, not code. The registry below is only the
// LEGACY baseline: it keeps documents sealed with `IR_VAT_9` readable and gives a
// fresh workspace its initial 9% policy, which is the rate already in use since
// S1. Every other rate is a record an administrator creates in the tax settings.
//
// WHY THE LEGACY RATE STAYS 900 HERE: silently changing the built-in 9% to any
// other figure would change what a customer is charged without a decision. The
// configured policy record wins whenever it exists; this is the fallback.

export type TaxPolicyDefinition = {
  // The stable code stored on a quotation and inside a sealed snapshot, for
  // example `IR_VAT_9`. Never the record id: a policy row may be re-created or
  // renamed, the documents that reference it must not follow.
  id: string;
  label: string;
  // Basis points: 900 = 9.00%. Integer, because a percentage stored as 0.09 is
  // a float and a float is exactly what the money domain refuses.
  //
  // `rateBasisPoints` is the TAX component only. A policy is one decision with two
  // components — tax (مالیات) and duty (عوارض) — and they are kept apart because a
  // destination may receive one, the other, both, or only their sum. Storing the sum
  // as the tax rate would lose which component a document actually carried.
  rateBasisPoints: bigint;
  dutyRateBasisPoints: bigint;
  isExempt: boolean;
};

// Tax + duty. This is the rate a destination that accepts one aggregate figure
// receives; it is never written back as `rateBasisPoints`.
export const totalRateBasisPoints = (
  policy: Pick<TaxPolicyDefinition, 'rateBasisPoints' | 'dutyRateBasisPoints'>,
): bigint => policy.rateBasisPoints + policy.dutyRateBasisPoints;

export const LEGACY_TAX_POLICY_ID = 'IR_VAT_9';

export const LEGACY_TAX_POLICIES: readonly TaxPolicyDefinition[] = [
  {
    id: LEGACY_TAX_POLICY_ID,
    label: 'مالیات بر ارزش افزوده ۹٪',
    rateBasisPoints: 900n,
    // The legacy rate was a single 9% tax figure with no separate duty, so a sealed
    // document that names it must keep reading as 9% tax and 0% duty.
    dutyRateBasisPoints: 0n,
    isExempt: false,
  },
];

export const DEFAULT_TAX_POLICY_ID = LEGACY_TAX_POLICY_ID;

export const findLegacyTaxPolicy = (
  policyId: string | null | undefined,
): TaxPolicyDefinition | null =>
  LEGACY_TAX_POLICIES.find(
    (policy) => policy.id === (policyId ?? '').trim(),
  ) ?? null;

export const resolveTaxPolicy = (
  policyId: string | null | undefined,
): Result<TaxPolicyDefinition> => {
  const normalized = (policyId ?? '').trim();

  if (normalized === '') {
    return refused(
      'TAX_POLICY_REQUIRED',
      'سیاست مالیات الزامی است (مثلاً IR_VAT_9)',
    );
  }

  const policy = findLegacyTaxPolicy(normalized);

  if (policy === null) {
    return refused(
      'TAX_POLICY_UNKNOWN',
      `سیاست مالیات «${normalized}» در فهرست معتبر نیست`,
    );
  }

  return accepted(policy);
};

// A configured policy row, as the settings page reads it from the workspace.
export type TaxPolicyCatalogEntry = TaxPolicyDefinition & {
  recordId: string;
  isActive: boolean;
  isDefault: boolean;
  position: number;
};
// Percent text -> basis points. Two fraction digits of a percent are the limit
// (10.5% = 1050 bp); a third digit is refused rather than rounded, because a
// rounded rate is a different rate.
export const parsePercentToBasisPoints = (
  text: string,
): Result<bigint> => {
  // Persian and Arabic digits are how this text is actually typed; the separator
  // can be the Persian decimal mark. Normalized here so every caller parses the
  // same way instead of each screen inventing its own cleanup.
  //
  // WHY THE MOMAYYEZ BECOMES A DOT INSTEAD OF BEING STRIPPED: removing the
  // separator concatenates the digits (`۱۰٫۵` -> `105`), which silently turns
  // 10.5% into 105% and is then refused as out of range. Every separator a
  // person may type as a decimal mark is folded to `.` before the shape check.
  const normalized = toAsciiDigits(text)
    .replace(/[\u066b\u060c,]/g, '.')
    .replace(/[\u066c\u00a0\u202f\s٪%]/g, '');

  if (normalized === '') {
    return refused('TAX_RATE_REQUIRED', 'درصد مالیات را وارد کنید');
  }

  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(normalized);

  if (match === null) {
    return refused(
      'TAX_RATE_INVALID',
      'درصد مالیات باید عددی با حداکثر دو رقم اعشار باشد (مثلاً ۹ یا ۱۰٫۵)',
    );
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? '').padEnd(2, '0'));
  // 1% = 100 bp, so one fraction digit of a percent is 10 bp.
  const basisPoints = whole * BASIS_POINTS_PER_PERCENT + fraction;

  if (!isBasisPointsInRange(basisPoints)) {
    return refused(
      'TAX_RATE_OUT_OF_RANGE',
      'درصد مالیات باید بین ۰ و ۱۰۰ باشد',
    );
  }

  return accepted(basisPoints);
};

export const parseBasisPointsText = (
  text: string,
): Result<bigint> => {
  const normalized = text.trim();

  if (!/^\d{1,5}$/.test(normalized)) {
    return refused(
      'TAX_RATE_INVALID',
      'نرخ ذخیره‌شدهٔ سیاست مالیات خوانده نشد',
    );
  }

  const basisPoints = BigInt(normalized);

  return isBasisPointsInRange(basisPoints)
    ? accepted(basisPoints)
    : refused(
        'TAX_RATE_OUT_OF_RANGE',
        'نرخ ذخیره‌شدهٔ سیاست مالیات خارج از بازهٔ معتبر است',
      );
};

// Basis points -> the percent a person reads: 1050 -> "10.5", 1000 -> "10".
export const formatBasisPointsAsPercent = (basisPoints: bigint): string => {
  const whole = basisPoints / BASIS_POINTS_PER_PERCENT;
  const fraction = basisPoints % BASIS_POINTS_PER_PERCENT;

  if (fraction === 0n) {
    return whole.toString();
  }

  const padded = fraction.toString().padStart(2, '0').replace(/0$/, '');

  return `${whole.toString()}.${padded}`;
};

export const buildTaxPolicyDefinition = ({
  code,
  label,
  rateBasisPoints,
  dutyRateBasisPoints,
  isExempt,
}: {
  code: string;
  label: string;
  rateBasisPoints: bigint;
  dutyRateBasisPoints?: bigint;
  isExempt: boolean;
}): Result<TaxPolicyDefinition> => {
  const normalizedCode = code.trim();
  const normalizedLabel = label.trim();
  const dutyRate = dutyRateBasisPoints ?? 0n;

  if (normalizedCode === '') {
    return refused('TAX_POLICY_CODE_REQUIRED', 'کد سیاست مالیات الزامی است');
  }

  if (normalizedLabel === '') {
    return refused('TAX_POLICY_NAME_REQUIRED', 'نام سیاست مالیات را وارد کنید');
  }

  if (!isBasisPointsInRange(rateBasisPoints)) {
    return refused(
      'TAX_RATE_OUT_OF_RANGE',
      'درصد مالیات باید بین ۰ و ۱۰۰ باشد',
    );
  }

  // Each component is a percentage, and so is their sum: two valid components whose
  // sum exceeds 100% would price a document above its own net.
  if (
    !isBasisPointsInRange(dutyRate) ||
    rateBasisPoints + dutyRate > BigInt(10000)
  ) {
    return refused(
      'DUTY_RATE_OUT_OF_RANGE',
      'درصد عوارض باید بین ۰ و ۱۰۰ باشد و جمع مالیات و عوارض از ۱۰۰٪ بیشتر نشود',
    );
  }

  // An exempt policy carries neither component: a policy that is both "exempt" and
  // 9% would let an operator claim an exemption the arithmetic does not reflect.
  const hasNoRate = rateBasisPoints === 0n && dutyRate === 0n;

  if (isExempt !== hasNoRate) {
    return refused(
      'TAX_POLICY_EXEMPTION_MISMATCH',
      isExempt
        ? 'سیاست معاف باید نرخ صفر داشته باشد'
        : 'سیاست با نرخ صفر باید معاف علامت بخورد',
    );
  }

  return accepted({
    id: normalizedCode,
    label: normalizedLabel,
    rateBasisPoints,
    dutyRateBasisPoints: dutyRate,
    isExempt,
  });
};

// The policy a new quotation starts with: the flagged default when it is usable,
// otherwise the first active one, otherwise the legacy baseline. Never "the first
// row in the table", because a row's position is not a business decision.
export const selectDefaultTaxPolicy = (
  entries: readonly TaxPolicyCatalogEntry[],
): TaxPolicyCatalogEntry | null => {
  const active = entries.filter((entry) => entry.isActive);
  const flagged = active.find((entry) => entry.isDefault);

  return flagged ?? active[0] ?? null;
};

export const resolveTaxPolicyFromCatalog = (
  policyId: string | null | undefined,
  entries: readonly TaxPolicyCatalogEntry[],
): Result<TaxPolicyCatalogEntry> => {
  const normalized = (policyId ?? '').trim();

  if (normalized === '') {
    return refused('TAX_POLICY_REQUIRED', 'سیاست مالیات الزامی است');
  }

  const entry = entries.find((candidate) => candidate.id === normalized);

  if (entry === undefined) {
    return refused(
      'TAX_POLICY_UNKNOWN',
      `سیاست مالیات «${normalized}» در تنظیمات مالیات تعریف نشده است`,
    );
  }

  // An issued document keeps its own sealed numbers; this check only guards a
  // NEW save, so a policy deactivated later never rewrites history.
  if (!entry.isActive) {
    return refused(
      'TAX_POLICY_INACTIVE',
      `سیاست مالیات «${entry.label}» غیرفعال است`,
    );
  }

  return accepted(entry);
};
