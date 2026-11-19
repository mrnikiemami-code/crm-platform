import { isNonEmptyString } from '@sniptt/guards';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const THOUSANDS_SEPARATOR = '\u066c';
const DECIMAL_SEPARATOR = '\u066b';
const ZERO_EXACT_AMOUNT = '0.000000';

const JALALI_DATE_FORMATTER = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

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

// Exact storage strings carry six fraction digits; invoices show trimmed decimals.
const trimTrailingFractionZeros = (fraction: string): string =>
  fraction.replace(/0+$/, '');

export const formatExactAmountForDisplay = (exact: string): string => {
  const trimmed = exact.trim();
  const match = DECIMAL_AMOUNT.exec(trimmed);

  if (match === null) {
    return toPersianDigits(trimmed);
  }

  const negative = match[1] === '-';
  const fractionRaw = match[3] ?? '';
  const fraction = trimTrailingFractionZeros(fractionRaw);
  const integerFormatted = formatIntegerWithThousands(
    `${negative ? '-' : ''}${match[2]}`,
  );
  if (fraction.length === 0) {
    return toPersianDigits(integerFormatted);
  }

  return `${toPersianDigits(integerFormatted)}${DECIMAL_SEPARATOR}${toPersianDigits(fraction)}`;
};

export const formatExactAmountWithCurrency = (
  exact: string,
  currencyLabel: string,
): string =>
  `${formatExactAmountForDisplay(exact)} ${currencyLabel}`.trim();

export const isSignificantExactAmount = (exact: string | null | undefined): boolean =>
  isNonEmptyString(exact) && exact.trim() !== '' && exact.trim() !== ZERO_EXACT_AMOUNT;

export const formatJalaliDateFromInstant = (isoInstant: string): string | null => {
  const instant = new Date(isoInstant);

  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  const parts = JALALI_DATE_FORMATTER.formatToParts(instant);
  const read = (type: 'year' | 'month' | 'day'): string | undefined =>
    parts.find((part) => part.type === type)?.value;

  const year = read('year');
  const month = read('month');
  const day = read('day');

  if (
    year === undefined ||
    month === undefined ||
    day === undefined
  ) {
    return null;
  }

  return toPersianDigits(`${year}/${month}/${day}`);
};

export const resolveCurrencyLabel = (currencyCode: string | null | undefined): string => {
  if (currencyCode?.trim().toUpperCase() === 'IRR') {
    return 'ریال';
  }

  if (isNonEmptyString(currencyCode)) {
    return currencyCode.trim();
  }

  return 'ریال';
};