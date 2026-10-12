import { describe, expect, it } from 'vitest';

import {
  isDeliveredState,
  parseRazpayamakDeliveryStatus,
} from 'src/providers/razpayamak/razpayamak-delivery';

// The documented `GetDeliveries2` status vocabulary.
const MATRIX: { code: number; state: string }[] = [
  { code: 0, state: 'IN_TRANSIT' },
  { code: 1, state: 'DELIVERED' },
  { code: 2, state: 'NOT_DELIVERED' },
  { code: 3, state: 'FAILED' },
  { code: 5, state: 'FAILED' },
  { code: 8, state: 'IN_TRANSIT' },
  { code: 16, state: 'NOT_DELIVERED' },
  { code: 35, state: 'FAILED' },
  { code: 100, state: 'UNKNOWN' },
  { code: 200, state: 'SENT' },
  { code: 300, state: 'FAILED' },
  { code: 400, state: 'PENDING' },
  { code: 500, state: 'FAILED' },
];

describe('parseRazpayamakDeliveryStatus', () => {
  it.each(MATRIX)('maps status $code to $state', ({ code, state }) => {
    expect(parseRazpayamakDeliveryStatus(code)).toEqual({
      state,
      providerCode: code,
    });
    expect(parseRazpayamakDeliveryStatus(String(code))).toEqual({
      state,
      providerCode: code,
    });
  });

  it('treats only code 1 as a delivery confirmation', () => {
    expect(isDeliveredState('DELIVERED')).toBe(true);
    expect(isDeliveredState('SENT')).toBe(false);
    expect(isDeliveredState('IN_TRANSIT')).toBe(false);
    expect(isDeliveredState('UNKNOWN')).toBe(false);
  });

  it('maps an unmapped code to UNKNOWN, never a delivery claim', () => {
    expect(parseRazpayamakDeliveryStatus(7777)).toEqual({
      state: 'UNKNOWN',
      providerCode: 7777,
    });
  });

  it('reports a missing or non-numeric status as LOOKUP_FAILED', () => {
    expect(parseRazpayamakDeliveryStatus(undefined)).toEqual({
      state: 'LOOKUP_FAILED',
    });
    expect(parseRazpayamakDeliveryStatus('abc')).toEqual({
      state: 'LOOKUP_FAILED',
    });
  });
});
