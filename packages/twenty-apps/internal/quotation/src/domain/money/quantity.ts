import { refused, accepted, type Result } from 'src/domain/shared/result';

// A quantity is an integer of a scaled unit, so 1.5 is stored as 1_500_000.
//
// WHY SIX DECIMALS: the architect raised the scale from three to six. Three covers grams
// and millimetres; six covers the fractional units service billing produces (a fraction of
// an hour) and, more importantly, matches the money scale, so a quantity can never be the
// reason a line total loses precision.
//
// WHY NOT A FLOAT: 0.1 + 0.2 !== 0.3, and a line of "0.1 hours" repeated ten times must be
// exactly one hour's worth of money.
export const QUANTITY_SCALE = 1_000_000n;

const MAX_FRACTION_DIGITS = 6;

// Persian and Arabic keyboards produce their own digits and their own separators, so an
// amount typed as ۱٫۵ must read as 1.5 rather than be refused. This is a local copy of a
// helper that also exists inside other apps: app packages are separately built bundles
// with no import path between them, so sharing would mean a dependency edge between two
// apps for eight lines.
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const toAsciiDigits = (input: string): string =>
  input.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(digit);

    return persianIndex >= 0
      ? String(persianIndex)
      : String(ARABIC_DIGITS.indexOf(digit));
  });

// U+066B is the Arabic decimal separator, U+066C the Arabic thousands separator, U+00A0 and
// U+202F are the spaces a Persian keyboard inserts. Grouping separators carry no value and
// are dropped; the decimal separator is normalised to a dot.
const GROUPING_SEPARATORS = /[\u066c\u060c,'\u00a0\u202f\s]/g;
const DECIMAL_SEPARATORS = /[\u066b.]/g;

const QUANTITY_PATTERN = /^(\d+)(?:\.(\d{1,6}))?$/;

export const parseQuantity = (input: string): Result<bigint> => {
  const normalized = toAsciiDigits(input)
    .replace(GROUPING_SEPARATORS, '')
    .replace(DECIMAL_SEPARATORS, '.');

  if (normalized === '') {
    return refused('QUANTITY_EMPTY', 'a line needs a quantity');
  }

  const match = QUANTITY_PATTERN.exec(normalized);

  if (match === null) {
    // A seventh decimal digit lands here on purpose: truncating it would change the amount,
    // and rounding it would need a rule the caller has not chosen.
    return refused(
      'QUANTITY_NOT_A_DECIMAL',
      `expected a non-negative decimal with at most ${MAX_FRACTION_DIGITS} fraction digits, received "${input.trim()}"`,
    );
  }

  const fraction = (match[2] ?? '').padEnd(MAX_FRACTION_DIGITS, '0');

  return accepted(BigInt(match[1]) * QUANTITY_SCALE + BigInt(fraction));
};

// The canonical stored form: always six fraction digits, so two records holding the same
// quantity cannot hold it in two spellings. This is what a snapshot records.
export const formatQuantityExact = (quantity: bigint): string => {
  const negative = quantity < 0n;
  const magnitude = negative ? -quantity : quantity;
  const units = magnitude / QUANTITY_SCALE;
  const fraction = (magnitude % QUANTITY_SCALE)
    .toString()
    .padStart(MAX_FRACTION_DIGITS, '0');

  return `${negative ? '-' : ''}${units}.${fraction}`;
};

// What a person reads: trailing zeros dropped, because "۱۲" is what was typed and
// "۱۲.۰۰۰۰۰۰" is noise on an invoice line.
export const formatQuantityForDisplay = (quantity: bigint): string => {
  const exact = formatQuantityExact(quantity);
  const trimmed = exact.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

  return trimmed === '-0' ? '0' : trimmed;
};

export const isCanonicalQuantityText = (text: string): boolean => {
  const parsed = parseQuantity(text);

  return parsed.ok && formatQuantityExact(parsed.value) === text;
};
