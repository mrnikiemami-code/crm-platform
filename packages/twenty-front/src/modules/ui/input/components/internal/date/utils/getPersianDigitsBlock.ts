import { normalizeLocalizedDigitsToAscii } from '@/localization/utils/jalali/normalizeLocalizedDigitsToAscii';
import { isDefined } from 'twenty-shared/utils';

const PERSIAN_DIGIT_DEFINITIONS = { '0': /[\u06F0-\u06F9]/ };

const canCompleteWithinRange = ({
  typedDigits,
  length,
  from,
  to,
}: {
  typedDigits: string;
  length: number;
  from: number;
  to: number;
}) => {
  for (let candidate = from; candidate <= to; candidate++) {
    if (candidate.toString().padStart(length, '0').startsWith(typedDigits)) {
      return true;
    }
  }

  return false;
};

// IMask's MaskedRange only understands ASCII digits, so Persian-digit blocks
// bound each field by checking that the digits typed so far can still become
// a number within the range.
export const getPersianDigitsBlock = ({
  length,
  from,
  to,
}: {
  length: number;
  from?: number;
  to?: number;
}) => ({
  mask: '0'.repeat(length),
  definitions: PERSIAN_DIGIT_DEFINITIONS,
  ...(isDefined(from) && isDefined(to)
    ? {
        validate: (_value: string, masked: { unmaskedValue: string }) =>
          canCompleteWithinRange({
            typedDigits: normalizeLocalizedDigitsToAscii(masked.unmaskedValue),
            length,
            from,
            to,
          }),
      }
    : {}),
});
