const PERSIAN_DIGIT_ZERO_CODE_POINT = 0x06f0;
const ARABIC_INDIC_DIGIT_ZERO_CODE_POINT = 0x0660;
const LOCALIZED_DIGIT_REGEX = /[\u06F0-\u06F9\u0660-\u0669]/g;

export const normalizeLocalizedDigitsToAscii = (value: string): string =>
  value.replace(LOCALIZED_DIGIT_REGEX, (digit) => {
    const codePoint = digit.charCodeAt(0);
    const zeroCodePoint =
      codePoint >= PERSIAN_DIGIT_ZERO_CODE_POINT
        ? PERSIAN_DIGIT_ZERO_CODE_POINT
        : ARABIC_INDIC_DIGIT_ZERO_CODE_POINT;

    return String(codePoint - zeroCodePoint);
  });
