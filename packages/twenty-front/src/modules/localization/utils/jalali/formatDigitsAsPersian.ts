import { normalizeLocalizedDigitsToAscii } from '@/localization/utils/jalali/normalizeLocalizedDigitsToAscii';

const PERSIAN_DIGIT_ZERO_CODE_POINT = 0x06f0;
const ASCII_DIGIT_REGEX = /[0-9]/g;

export const formatDigitsAsPersian = (value: string): string =>
  normalizeLocalizedDigitsToAscii(value).replace(ASCII_DIGIT_REGEX, (digit) =>
    String.fromCharCode(PERSIAN_DIGIT_ZERO_CODE_POINT + Number(digit)),
  );
