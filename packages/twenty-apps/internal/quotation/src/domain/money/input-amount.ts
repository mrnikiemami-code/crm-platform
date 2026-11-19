import {
  irrMicrosToTomanMicros,
  type MoneyUnit,
} from 'src/domain/money/currency';
import {
  formatAsciiCompactForPeopleInput,
  normalizeMoneyFigureText,
} from 'src/domain/money/money-input-text';
import { formatMicrosExact, parseMicrosExact } from 'src/domain/money/micros';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Compact ASCII decimal for form math (drop trailing zeros; keep at least one integer digit).
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

// People-facing input fill: Persian digits + thousands grouping + trimmed fraction.
export const formatMicrosForPeopleInput = (
  irrMicros: bigint,
  unit: MoneyUnit,
): Result<string> => {
  const compact = formatMicrosForInput(irrMicros, unit);

  if (!compact.ok) {
    return compact;
  }

  return accepted(formatAsciiCompactForPeopleInput(compact.value));
};

export const irrExactToInputText = (
  unitPriceExactIrr: string,
  unit: MoneyUnit,
): Result<string> => {
  const micros = parseMicrosExact(unitPriceExactIrr);

  if (!micros.ok) {
    return refused('UNIT_PRICE_INVALID', 'قیمت کاتالوگ معتبر نیست');
  }

  return formatMicrosForPeopleInput(micros.value, unit);
};

// Invariant helper: parse(format(value)) === value for complete figures.
export const assertMoneyInputRoundTrip = (
  peopleOrAsciiText: string,
): Result<string> => {
  const normalized = normalizeMoneyFigureText(peopleOrAsciiText);

  if (!normalized.ok || normalized.value.trailingDecimal) {
    return refused(
      'AMOUNT_NOT_A_DECIMAL',
      'round-trip requires a complete money figure',
    );
  }

  const reformatted = formatAsciiCompactForPeopleInput(
    normalized.value.asciiCompact,
  );
  const again = normalizeMoneyFigureText(reformatted);

  if (!again.ok || again.value.trailingDecimal) {
    return refused('AMOUNT_NOT_A_DECIMAL', 'reformat failed to parse');
  }

  if (again.value.asciiCompact !== normalized.value.asciiCompact) {
    return refused(
      'AMOUNT_ROUND_TRIP_MISMATCH',
      `parse(format(x)) diverged: ${normalized.value.asciiCompact} vs ${again.value.asciiCompact}`,
    );
  }

  return accepted(again.value.asciiCompact);
};

