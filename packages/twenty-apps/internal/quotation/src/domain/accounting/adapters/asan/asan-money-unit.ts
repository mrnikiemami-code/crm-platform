import { formatMicrosExact } from 'src/domain/money/micros';
import { accepted, refused, type Result } from 'src/domain/shared/result';
import { type AccountingMoneyUnit } from 'src/domain/accounting/adapter-contract';
import { MICROS_PER_ASAN_UNIT } from 'src/domain/accounting/adapters/asan/asan-factor';

// Amounts cross this boundary in the vendor's own whole unit, and the unit is a
// CONFIGURATION, not a constant. The Asan guide prints plain integers and never states
// whether they mean rial or toman, so a factor-of-ten guess would under- or over-charge
// every line by 10x. `UNCONFIRMED` therefore refuses every conversion instead of assuming.
export const RIAL_PER_ASAN_UNIT: Record<
  Exclude<AccountingMoneyUnit, 'UNCONFIRMED'>,
  bigint
> = {
  RIAL: 1n,
  TOMAN: 10n,
};

const microsPerUnit = (unit: AccountingMoneyUnit): Result<bigint> => {
  if (unit === 'UNCONFIRMED') {
    return refused(
      'MONEY_UNIT_UNCONFIRMED',
      'the vendor amount unit is not confirmed; amounts must not be converted yet',
    );
  }

  return accepted(MICROS_PER_ASAN_UNIT * RIAL_PER_ASAN_UNIT[unit]);
};

// CRM micros -> whole vendor units. A fractional vendor unit is refused rather than
// rounded: rounding changes what the customer is asked to pay, and there is no rounding
// rule at this layer a caller could have chosen deliberately.
export const crmMicrosToAsanUnits = (
  micros: bigint,
  unit: AccountingMoneyUnit,
): Result<number> => {
  const perUnit = microsPerUnit(unit);

  if (!perUnit.ok) {
    return perUnit;
  }

  if (micros % perUnit.value !== 0n) {
    return refused(
      'AMOUNT_NOT_WHOLE_UNIT',
      'this amount has a fraction of the vendor unit and cannot be sent without rounding',
    );
  }

  const units = micros / perUnit.value;

  if (
    units > BigInt(Number.MAX_SAFE_INTEGER) ||
    units < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return refused(
      'AMOUNT_OUT_OF_RANGE',
      'this amount exceeds what a JSON number can carry exactly',
    );
  }

  return accepted(Number(units));
};

// Whole vendor units -> CRM micros. Used when importing a price read from the vendor, so
// the stored exact text is produced from one checked conversion rather than from a float.
export const asanUnitsToCrmMicros = (
  units: number,
  unit: AccountingMoneyUnit,
): Result<bigint> => {
  const perUnit = microsPerUnit(unit);

  if (!perUnit.ok) {
    return perUnit;
  }

  if (!Number.isSafeInteger(units)) {
    return refused(
      'AMOUNT_NOT_A_DECIMAL',
      'the vendor price is not a whole amount',
    );
  }

  const micros = BigInt(units) * perUnit.value;

  return accepted(micros);
};

export const formatCrmMicrosForVendor = (
  micros: bigint,
  unit: AccountingMoneyUnit,
): string => {
  const units = crmMicrosToAsanUnits(micros, unit);

  if (units.ok) {
    return `${units.value.toLocaleString('fa-IR')} ${moneyUnitLabel(unit)}`;
  }

  return `${formatMicrosExact(micros)} ریال (واحد مقصد تأیید نشده)`;
};

export const moneyUnitLabel = (unit: AccountingMoneyUnit): string => {
  switch (unit) {
    case 'RIAL':
      return 'ریال';
    case 'TOMAN':
      return 'تومان';
    default:
      return 'تأییدنشده';
  }
};
