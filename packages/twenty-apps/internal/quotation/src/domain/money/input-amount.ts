import {
  irrMicrosToTomanMicros,
  type MoneyUnit,
} from 'src/domain/money/currency';
import { formatMicrosExact, parseMicrosExact } from 'src/domain/money/micros';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Compact decimal for form inputs (drop trailing zeros; keep at least one integer digit).
export const formatMicrosForInput = (
  irrMicros: bigint,
  unit: MoneyUnit,
): Result<string> => {
  const microsForUnit =
    unit === 'IRR' ? accepted(irrMicros) : irrMicrosToTomanMicros(irrMicros);

  if (!microsForUnit.ok) {
    return microsForUnit;
  }

  const exact = formatMicrosExact(microsForUnit.value);
  const [units, fraction = '000000'] = exact.split('.');
  const trimmedFraction = fraction.replace(/0+$/, '');

  return accepted(
    trimmedFraction.length === 0 ? units : `${units}.${trimmedFraction}`,
  );
};

export const irrExactToInputText = (
  unitPriceExactIrr: string,
  unit: MoneyUnit,
): Result<string> => {
  const micros = parseMicrosExact(unitPriceExactIrr);

  if (!micros.ok) {
    return refused('UNIT_PRICE_INVALID', 'قیمت کاتالوگ معتبر نیست');
  }

  return formatMicrosForInput(micros.value, unit);
};
