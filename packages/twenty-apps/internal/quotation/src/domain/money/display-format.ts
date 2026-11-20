// People-facing money text: Persian digits, thousands grouping, trimmed fraction.
// Storage stays `formatMicrosExact` (six fraction digits, ASCII).
import { MONEY_UNIT_LABELS } from 'src/domain/money/currency';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const THOUSANDS_SEPARATOR = '\u066c';
const DECIMAL_SEPARATOR = '\u066b';
const DECIMAL_AMOUNT = /^(-)?(\d+)(?:\.(\d{1,6}))?$/;

export const toPersianDigits = (input: string): string =>
  input.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);

const formatIntegerWithThousands = (integerPart: string): string => {
  const negative = integerPart.startsWith('-');
  const digits = (negative ? integerPart.slice(1) : integerPart).replace(
    /^0+(?=\d)/,
    '',
  );

  if (digits.length === 0) {
    return negative ? '-0' : '0';
  }

  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);

  return negative ? `-${grouped}` : grouped;
};

const trimTrailingFractionZeros = (fraction: string): string =>
  fraction.replace(/0+$/, '');

export const formatExactDecimalForPeople = (exact: string): string => {
  const trimmed = exact.trim();
  const match = DECIMAL_AMOUNT.exec(trimmed);

  if (match === null) {
    return toPersianDigits(trimmed);
  }

  const negative = match[1] === '-';
  const fraction = trimTrailingFractionZeros(match[3] ?? '');
  const integerFormatted = formatIntegerWithThousands(
    `${negative ? '-' : ''}${match[2]}`,
  );

  if (fraction.length === 0) {
    return toPersianDigits(integerFormatted);
  }

  return `${toPersianDigits(integerFormatted)}${DECIMAL_SEPARATOR}${toPersianDigits(fraction)}`;
};

// The unit is always stated: an unlabelled number is ambiguous between rial and
// toman, and this app stores rial only.
export const resolveCurrencyLabel = (
  currencyCode: string | null | undefined,
): string => {
  const trimmed = currencyCode?.trim() ?? '';

  if (trimmed === '' || trimmed.toUpperCase() === 'IRR') {
    return MONEY_UNIT_LABELS.IRR;
  }

  return trimmed;
};

export const formatExactAmountWithCurrency = (
  exact: string,
  currencyCode: string | null | undefined,
): string =>
  `${formatExactDecimalForPeople(exact)} ${resolveCurrencyLabel(currencyCode)}`.trim();
