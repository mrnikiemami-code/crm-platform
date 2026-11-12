// Money entry, kept as pure functions so the exact same formatting and parsing
// can be asserted in a test instead of being trusted in the JSX.
//
// The rule the UI must honour: the user SEES a grouped amount, the logic
// receives a plain integer. Nothing here decides what an amount means — the
// plan layer still rejects negatives and non-numbers.

const THOUSANDS_SEPARATOR = '\u066c'; // Arabic thousands separator, used in Persian

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

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

export const extractDigits = (input: string): string =>
  toAsciiDigits(input).replace(/[^\d]/g, '');

/**
 * Groups digits for display. An empty entry stays empty (not "0"), so the field
 * can be blank without pretending a zero amount was entered.
 */
export const formatAmountForDisplay = (input: string): string => {
  const digits = extractDigits(input).replace(/^0+(?=\d)/, '');

  if (digits.length === 0) {
    return '';
  }

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
};

/**
 * The value handed to the registration logic: a plain integer, or `null` when
 * the field is empty. `0` is a real amount and is preserved.
 */
export const parseAmountToNumber = (input: string): number | null => {
  const digits = extractDigits(input);

  if (digits.length === 0) {
    return null;
  }

  const value = Number(digits);

  return Number.isSafeInteger(value) ? value : null;
};
