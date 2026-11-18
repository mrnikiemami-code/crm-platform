import { accepted, refused, type Result } from 'src/domain/shared/result';

// Quantities are integers of a milli-unit, so 1.5 kg is 1500.
//
// WHY NOT A FLOAT: 0.1 + 0.2 !== 0.3, and a line of "0.1 hours" repeated ten times
// must be exactly one hour's worth of money. WHY THREE DECIMALS AND NOT SIX:
// quantities people type in a quotation are lengths, weights, hours and counts;
// three decimals covers grams and millimetres, and a tighter scale keeps the
// intermediate product small enough to stay readable when debugging.
export const QUANTITY_SCALE = 1000n;

const MAX_FRACTION_DIGITS = 3;

// Persian and Arabic keyboards produce their own digits and their own separators,
// so an amount typed as ۱٫۵ must read as 1.5 rather than be refused. This is a
// local copy of a helper that also exists inside the event-registration app: app
// packages are separately built bundles with no import path between them, so
// sharing would mean adding a dependency edge between two apps for eight lines.
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const toAsciiDigits = (input: string): string =>
  input.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(digit);

    return persianIndex >= 0
      ? String(persianIndex)
      : String(ARABIC_DIGITS.indexOf(digit));
  });

// U+066B is the Arabic decimal separator, U+066C the Arabic thousands separator,
// U+00A0 and U+202F are the spaces a Persian keyboard inserts. Grouping separators
// carry no value and are dropped; the decimal separator is normalised to a dot.
const GROUPING_SEPARATORS = /[\u066c\u060c,'\u00a0\u202f\s]/g;
const DECIMAL_SEPARATORS = /[\u066b.]/g;

const QUANTITY_PATTERN = /^(\d+)(?:\.(\d{1,3}))?$/;

export const parseQuantityMilli = (input: string): Result<bigint> => {
  const normalized = toAsciiDigits(input)
    .replace(GROUPING_SEPARATORS, '')
    .replace(DECIMAL_SEPARATORS, '.');

  if (normalized === '') {
    return refused('QUANTITY_EMPTY', 'a line needs a quantity');
  }

  const match = QUANTITY_PATTERN.exec(normalized);

  if (match === null) {
    // A fourth decimal digit lands here on purpose: truncating it would change the
    // amount, and rounding it would need a rule the caller has not chosen.
    return refused(
      'QUANTITY_NOT_A_DECIMAL',
      `expected a non-negative decimal with at most ${MAX_FRACTION_DIGITS} fraction digits, received "${input.trim()}"`,
    );
  }

  const fraction = (match[2] ?? '').padEnd(MAX_FRACTION_DIGITS, '0');

  return accepted(BigInt(match[1]) * QUANTITY_SCALE + BigInt(fraction));
};

// The form the UI shows: Persian digits, the Arabic thousands separator, and no
// trailing zeros on the fraction.
export const formatQuantityMilli = (quantityMilli: bigint): string => {
  const negative = quantityMilli < 0n;
  const magnitude = negative ? -quantityMilli : quantityMilli;
  const units = magnitude / QUANTITY_SCALE;
  const fraction = (magnitude % QUANTITY_SCALE)
    .toString()
    .padStart(MAX_FRACTION_DIGITS, '0')
    .replace(/0+$/, '');

  return `${negative ? '-' : ''}${units}${fraction === '' ? '' : `.${fraction}`}`;
};
