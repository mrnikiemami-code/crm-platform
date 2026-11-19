import { accepted, refused, type Result } from 'src/domain/shared/result';

// Shared money-figure text rules for typed amounts (unit price, fixed discounts).
// Digits may be Persian, Arabic-Indic, or ASCII. Thousands separators are validated,
// never guessed. Calculations must parse through this path — never Number/parseFloat.

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const THOUSANDS_SEPARATOR = '\u066c';
const DECIMAL_SEPARATOR = '\u066b';

export const toAsciiDigits = (input: string): string =>
  input.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(digit);

    return persianIndex >= 0
      ? String(persianIndex)
      : String(ARABIC_DIGITS.indexOf(digit));
  });

export const toPersianDigits = (input: string): string =>
  input.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);

const countDigits = (input: string): number =>
  (toAsciiDigits(input).match(/\d/g) ?? []).length;

// Map caret so it stays after the same number of digits when separators appear/disappear.
export const restoreCaretAfterDigitCount = (
  formatted: string,
  digitCountBeforeCaret: number,
): number => {
  if (digitCountBeforeCaret <= 0) {
    return 0;
  }

  let seen = 0;

  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d|[۰-۹٠-٩]/.test(formatted[index] ?? '')) {
      seen += 1;

      if (seen >= digitCountBeforeCaret) {
        return index + 1;
      }
    }
  }

  return formatted.length;
};

export const digitCountBeforeIndex = (
  text: string,
  caretIndex: number,
): number => countDigits(text.slice(0, Math.max(0, caretIndex)));

const stripSpaces = (input: string): string =>
  input.replace(/[\u00a0\u202f\s]/g, '');

// Integer grouping: ungrouped digits, or leftmost 1–3 digits then groups of exactly 3.
const GROUPED_INTEGER = /^\d{1,3}([,\u066c]\d{3})+$/;
const PLAIN_INTEGER = /^\d+$/;

const normalizeGroupingSeparators = (integerPart: string): string =>
  integerPart.replace(/\u066c/g, ',');

export const stripValidatedIntegerGrouping = (
  integerPart: string,
): Result<string> => {
  const trimmed = integerPart.trim();

  if (trimmed === '') {
    return refused('AMOUNT_NOT_A_DECIMAL', 'integer part is required');
  }

  if (/[^\d,\u066c]/.test(trimmed)) {
    return refused(
      'AMOUNT_NOT_A_DECIMAL',
      'integer part contains unexpected characters',
    );
  }

  if (PLAIN_INTEGER.test(trimmed)) {
    return accepted(trimmed.replace(/^0+(?=\d)/, '') || '0');
  }

  const commaForm = normalizeGroupingSeparators(trimmed);

  if (!GROUPED_INTEGER.test(commaForm)) {
    return refused(
      'AMOUNT_GROUPING_INVALID',
      'thousands grouping must be groups of three digits',
    );
  }

  const digits = commaForm.replace(/,/g, '').replace(/^0+(?=\d)/, '') || '0';

  return accepted(digits);
};

export type NormalizedMoneyFigure = {
  // ASCII digits with optional `.` fraction (1–6 digits), no grouping.
  asciiCompact: string;
  // True when the typed text ended with a decimal separator and no fraction yet.
  trailingDecimal: boolean;
};

// Incomplete-but-honest typing states (empty / trailing decimal) are refused for
// persistence, but `normalizeMoneyFigureText` exposes them so the input can keep
// caret-friendly intermediate display without guessing values.
export const normalizeMoneyFigureText = (
  input: string,
): Result<NormalizedMoneyFigure> => {
  const stripped = stripSpaces(input.trim());

  if (stripped === '') {
    return refused('AMOUNT_EMPTY', 'an amount is required');
  }

  const ascii = toAsciiDigits(stripped);
  const decimalMatches = ascii.match(/[.\u066b]/g) ?? [];

  if (decimalMatches.length > 1) {
    return refused(
      'AMOUNT_NOT_A_DECIMAL',
      'expected at most one decimal separator',
    );
  }

  const decimalIndex = Math.max(ascii.indexOf('.'), ascii.indexOf('\u066b'));
  const trailingDecimal =
    decimalIndex >= 0 && decimalIndex === ascii.length - 1;

  const integerRaw =
    decimalIndex >= 0 ? ascii.slice(0, decimalIndex) : ascii;
  const fractionRaw =
    decimalIndex >= 0 && !trailingDecimal ? ascii.slice(decimalIndex + 1) : '';

  if (fractionRaw.length > 6) {
    return refused(
      'AMOUNT_NOT_A_DECIMAL',
      'expected at most 6 fraction digits',
    );
  }

  if (fractionRaw !== '' && !/^\d+$/.test(fractionRaw)) {
    return refused('AMOUNT_NOT_A_DECIMAL', 'fraction must be digits only');
  }

  const integerDigits = stripValidatedIntegerGrouping(integerRaw);

  if (!integerDigits.ok) {
    return integerDigits;
  }

  if (trailingDecimal) {
    return accepted({
      asciiCompact: `${integerDigits.value}.`,
      trailingDecimal: true,
    });
  }

  const asciiCompact =
    fractionRaw === ''
      ? integerDigits.value
      : `${integerDigits.value}.${fractionRaw}`;

  return accepted({ asciiCompact, trailingDecimal: false });
};

export const formatAsciiCompactForPeopleInput = (asciiCompact: string): string => {
  const trailingDecimal = asciiCompact.endsWith('.');
  const body = trailingDecimal ? asciiCompact.slice(0, -1) : asciiCompact;
  const [integerPart = '0', fractionPart = ''] = body.split('.');
  const digits = integerPart.replace(/^0+(?=\d)/, '') || '0';
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);
  const persianInteger = toPersianDigits(grouped);

  if (trailingDecimal) {
    return `${persianInteger}${DECIMAL_SEPARATOR}`;
  }

  if (fractionPart === '') {
    return persianInteger;
  }

  return `${persianInteger}${DECIMAL_SEPARATOR}${toPersianDigits(fractionPart)}`;
};

export type MoneyInputChangeResult = {
  displayText: string;
  caretIndex: number;
  // Present only when the figure is complete enough to parse into micros.
  asciiCompact: string | null;
};

export const applyMoneyInputChange = ({
  nextRawText,
  caretIndex,
}: {
  nextRawText: string;
  caretIndex: number;
}): MoneyInputChangeResult => {
  const normalized = normalizeMoneyFigureText(nextRawText);

  if (!normalized.ok) {
    // Keep what the person typed (digit-script preserved) so they can repair it;
    // domain parse will refuse until the figure is valid.
    return {
      displayText: nextRawText,
      caretIndex: Math.min(caretIndex, nextRawText.length),
      asciiCompact: null,
    };
  }

  const digitsBefore = digitCountBeforeIndex(
    nextRawText,
    Math.min(caretIndex, nextRawText.length),
  );
  const displayText = formatAsciiCompactForPeopleInput(
    normalized.value.asciiCompact,
  );
  const nextCaret = restoreCaretAfterDigitCount(displayText, digitsBefore);

  return {
    displayText,
    caretIndex: nextCaret,
    asciiCompact: normalized.value.trailingDecimal
      ? null
      : normalized.value.asciiCompact,
  };
};
