import { describe, expect, it } from 'vitest';

import {
  isUsableMessageBody,
  normalizeSmsRecipient,
} from 'src/settings/sms-recipient';

describe('normalizeSmsRecipient', () => {
  it.each([
    ['09120000000', '09120000000'],
    ['+98 912 000 0000', '989120000000'],
    ['00989120000000', '989120000000'],
    ['0912-000-0000', '09120000000'],
    ['(0912) 000 0000', '09120000000'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeSmsRecipient(input)).toBe(expected);
  });

  it.each([['abc'], [''], ['123'], ['+98'], ['12345678901234567890'], ['۱۲۳']])(
    'rejects %j',
    (input) => {
      expect(normalizeSmsRecipient(input)).toBeNull();
    },
  );

  it('rejects a non-string', () => {
    expect(normalizeSmsRecipient(undefined)).toBeNull();
  });
});

describe('isUsableMessageBody', () => {
  it('accepts non-empty text and rejects blank text', () => {
    expect(isUsableMessageBody('سلام')).toBe(true);
    expect(isUsableMessageBody('   ')).toBe(false);
    expect(isUsableMessageBody('')).toBe(false);
    expect(isUsableMessageBody(undefined)).toBe(false);
  });
});
