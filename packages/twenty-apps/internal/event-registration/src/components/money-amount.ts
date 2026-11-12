// Money entry, kept as pure functions so the exact same reading of a typed
// amount can be asserted in a test instead of trusted in the JSX.
//
// THE RULE: what the user typed is either understood exactly or refused. A
// character that has no place in a whole-toman amount is NEVER dropped, because
// dropping it changes the number: "125000.00" would become 12,500,000 (the two
// decimals merged into the amount) and "12.5" would become 125. Both are silent
// corruption of a financial figure, so `parseAmountInput` reports them instead.

const THOUSANDS_SEPARATOR = '\u066c'; // Arabic thousands separator, used in Persian

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Characters that only group digits and carry no value of their own. */
const GROUPING_SEPARATORS = new RegExp(`[${THOUSANDS_SEPARATOR},'\\u060C\\s]`, 'g');

/** Characters that mean "this amount has a fractional part". */
const FRACTION_MARKERS = /[.\u066B]/;

/** Persian and Arabic-Indic digits typed on a Persian keyboard become ASCII. */
export const toAsciiDigits = (input: string): string =>
  input.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(digit);

    if (persianIndex >= 0) {
      return String(persianIndex);
    }

    return String(ARABIC_DIGITS.indexOf(digit));
  });

/**
 * ASCII digits become Persian ones. Used for stored text — a record title is a
 * Persian document, unlike an entry field where the user's own digits are kept.
 */
export const toPersianDigits = (input: string): string =>
  input.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);

export type AmountProblem = 'NOT_DIGITS' | 'DECIMAL_NOT_ALLOWED' | 'TOO_LARGE';

/** The one meaning an amount entry can have. */
export type AmountInput =
  | { kind: 'EMPTY' }
  | { kind: 'INVALID'; reason: AmountProblem }
  | { kind: 'AMOUNT'; value: number };

const readPureDigits = (input: string): AmountInput => {
  const ascii = toAsciiDigits(input).trim();

  if (ascii.length === 0) {
    return { kind: 'EMPTY' };
  }

  // A fractional part is its own refusal: merging it would multiply the amount
  // by a power of ten, and rounding it would discard money the user typed.
  if (FRACTION_MARKERS.test(ascii)) {
    return { kind: 'INVALID', reason: 'DECIMAL_NOT_ALLOWED' };
  }

  const digits = ascii.replace(GROUPING_SEPARATORS, '');

  if (digits.length === 0) {
    return { kind: 'EMPTY' };
  }

  if (!/^\d+$/.test(digits)) {
    return { kind: 'INVALID', reason: 'NOT_DIGITS' };
  }

  const value = Number(digits);

  if (!Number.isSafeInteger(value)) {
    return { kind: 'INVALID', reason: 'TOO_LARGE' };
  }

  return { kind: 'AMOUNT', value };
};

/**
 * Reads a typed amount. Never guesses: anything that is not whole tomans comes
 * back as `INVALID` with the reason, so the caller can say so instead of
 * writing a different number than the one on screen.
 */
export const parseAmountInput = (input: string): AmountInput =>
  readPureDigits(input);

/**
 * Groups digits for display. It runs on every keystroke, so it must be able to
 * reject: when the entry cannot be read (a decimal point, a letter, a minus)
 * the PREVIOUS text is kept and the reason is reported by `parseAmountInput`.
 */
export const formatAmountForDisplay = (input: string): string => {
  const digits = toAsciiDigits(input)
    .replace(GROUPING_SEPARATORS, '')
    .replace(/^0+(?=\d)/, '');

  if (digits.length === 0 || !/^\d+$/.test(digits)) {
    return '';
  }

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
};

/** A stored amount, as the Persian UI shows it: `۱۲۵٬۰۰۰`. */
export const formatTomanForDisplay = (value: number): string =>
  toPersianDigits(formatAmountForDisplay(String(Math.trunc(value))));
