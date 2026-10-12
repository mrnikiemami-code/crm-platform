import { describe, expect, it } from 'vitest';

import {
  isConfigurationFailure,
  isDocumentedFailureCode,
  parseRazpayamakFailureCode,
  sanitizeProviderDetail,
} from 'src/providers/razpayamak/razpayamak-failure';

// The complete documented numeric vocabulary. The negative request/IP codes
// (108..111) MUST parse with their sign.
const DOCUMENTED: { input: string; providerCode: number; code: string }[] = [
  { input: '-111', providerCode: -111, code: 'INVALID_REQUESTER_IP' },
  { input: '-110', providerCode: -110, code: 'API_KEY_REQUIRED' },
  { input: '-109', providerCode: -109, code: 'ALLOWED_IP_NOT_CONFIGURED' },
  { input: '-108', providerCode: -108, code: 'IP_BLOCKED' },
  { input: '0', providerCode: 0, code: 'INVALID_CREDENTIALS' },
  { input: '2', providerCode: 2, code: 'INSUFFICIENT_CREDIT' },
  { input: '3', providerCode: 3, code: 'DAILY_LIMIT_REACHED' },
  { input: '4', providerCode: 4, code: 'VOLUME_LIMIT_REACHED' },
  { input: '5', providerCode: 5, code: 'INVALID_SENDER' },
  { input: '6', providerCode: 6, code: 'PROVIDER_MAINTENANCE' },
  { input: '7', providerCode: 7, code: 'FILTERED_WORD' },
  { input: '9', providerCode: 9, code: 'PUBLIC_LINE_NOT_ALLOWED' },
  { input: '10', providerCode: 10, code: 'INACTIVE_USER' },
  { input: '11', providerCode: 11, code: 'NOT_SENT' },
  { input: '12', providerCode: 12, code: 'INCOMPLETE_DOCUMENTS' },
  { input: '14', providerCode: 14, code: 'MESSAGE_CONTAINS_LINK' },
  { input: '15', providerCode: 15, code: 'OPT_OUT_MISSING' },
  { input: '16', providerCode: 16, code: 'RECIPIENT_NOT_FOUND' },
  { input: '17', providerCode: 17, code: 'EMPTY_MESSAGE' },
  { input: '18', providerCode: 18, code: 'INVALID_MOBILE' },
];

describe('parseRazpayamakFailureCode', () => {
  it.each(DOCUMENTED)(
    'parses documented code $input (with sign) as $code',
    ({ input, providerCode, code }) => {
      expect(parseRazpayamakFailureCode(input)).toEqual({ code, providerCode });
      expect(parseRazpayamakFailureCode(providerCode)).toEqual({
        code,
        providerCode,
      });
    },
  );

  it('maps an unknown numeric code to a safe UNKNOWN_PROVIDER_ERROR', () => {
    expect(parseRazpayamakFailureCode('999')).toEqual({
      code: 'UNKNOWN_PROVIDER_ERROR',
      providerCode: 999,
    });
  });

  it('returns null for a missing or non-numeric value', () => {
    expect(parseRazpayamakFailureCode(undefined)).toBeNull();
    expect(parseRazpayamakFailureCode('abc')).toBeNull();
  });
});

describe('isDocumentedFailureCode', () => {
  it('recognizes every documented failure code, including negatives', () => {
    for (const code of [
      -111, -110, -109, -108, 0, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16,
      17, 18,
    ]) {
      expect(isDocumentedFailureCode(code)).toBe(true);
      expect(isDocumentedFailureCode(String(code))).toBe(true);
    }
  });

  it('does NOT treat a real recID as a failure code', () => {
    expect(isDocumentedFailureCode('34439078')).toBe(false);
    expect(isDocumentedFailureCode(999001)).toBe(false);
    expect(isDocumentedFailureCode('1')).toBe(false);
  });

  it('returns false for a missing or non-numeric value', () => {
    expect(isDocumentedFailureCode(undefined)).toBe(false);
    expect(isDocumentedFailureCode('abc')).toBe(false);
  });
});

describe('isConfigurationFailure', () => {
  it('flags credential/IP problems as configuration failures', () => {
    expect(isConfigurationFailure('INVALID_CREDENTIALS')).toBe(true);
    expect(isConfigurationFailure('IP_BLOCKED')).toBe(true);
    expect(isConfigurationFailure('INVALID_SENDER')).toBe(true);
  });

  it('does not flag per-message problems', () => {
    expect(isConfigurationFailure('EMPTY_MESSAGE')).toBe(false);
    expect(isConfigurationFailure('RECIPIENT_NOT_FOUND')).toBe(false);
  });
});

describe('sanitizeProviderDetail', () => {
  it('strips control characters, trims and caps length', () => {
    expect(sanitizeProviderDetail('ok\u0000text')).toBe('ok text');
    expect(sanitizeProviderDetail('  spaced  ')).toBe('spaced');
    expect(sanitizeProviderDetail('x'.repeat(500), 10)).toHaveLength(10);
  });

  it('returns undefined for empty or non-string input', () => {
    expect(sanitizeProviderDetail(undefined)).toBeUndefined();
    expect(sanitizeProviderDetail('   ')).toBeUndefined();
  });
});
