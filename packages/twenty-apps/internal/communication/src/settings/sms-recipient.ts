// Recipient normalization for the SMS channel.
//
// The Person composer sends the exact stored number (no normalization, per the
// W5 scope), but the settings test-send accepts a free-typed number, so it is
// normalized and validated here. This is the same "is this a usable SMS
// destination" rule, applied once and reused.

const DIGITS_ONLY = /^[0-9]+$/;

/**
 * Normalizes a user-typed mobile number into the digits-only form the provider
 * expects. Accepted inputs (whitespace, dashes, parentheses and a leading `+`
 * are ignored):
 *   - `09120000000`      → `09120000000`
 *   - `+98 912 000 0000` → `989120000000`
 *   - `00989120000000`   → `989120000000`
 *
 * Returns `null` when the value cannot be a plausible SMS destination. The
 * rule is deliberately conservative: at least 8 digits, at most 15 (the ITU
 * E.164 maximum), digits only after cleanup.
 */
export const normalizeSmsRecipient = (
  raw: string | undefined,
): string | null => {
  if (typeof raw !== 'string') {
    return null;
  }

  const withoutSeparators = raw.replace(/[\s()\-.]/g, '');

  const withoutPlus = withoutSeparators.startsWith('+')
    ? withoutSeparators.slice(1)
    : withoutSeparators;

  // `00` is the international access prefix; strip it once.
  const digits = withoutPlus.startsWith('00')
    ? withoutPlus.slice(2)
    : withoutPlus;

  if (digits.length === 0 || !DIGITS_ONLY.test(digits)) {
    return null;
  }

  if (digits.length < 8 || digits.length > 15) {
    return null;
  }

  return digits;
};

/** Whether a non-empty message body is present (after trimming). */
export const isUsableMessageBody = (raw: string | undefined): boolean =>
  typeof raw === 'string' && raw.trim().length > 0;
