import { describe, expect, it } from 'vitest';

import {
  MOCK_CATALOG_ITEMS,
  MOCK_OPERATION_HISTORY_SAMPLES,
  MOCK_PARTIES,
  MOCK_TAX_RATE_SAMPLES,
} from 'src/domain/accounting/adapters/mock/mock-dataset';

// The UAT fixture is itself a contract: if one of these shapes disappears, a person testing
// the import screen silently loses a case they were told to check.
describe('mock UAT dataset', () => {
  it('carries at least 30 catalog items and every warning shape the preview can show', () => {
    expect(MOCK_CATALOG_ITEMS.length).toBeGreaterThanOrEqual(30);

    const codes = MOCK_CATALOG_ITEMS.map((item) => item.code);
    expect(new Set(codes).size).toBeLessThan(codes.length);
    expect(MOCK_CATALOG_ITEMS.some((item) => item.sellPriceUnits === null)).toBe(
      true,
    );
    expect(MOCK_CATALOG_ITEMS.some((item) => item.isActive === false)).toBe(true);
    expect(codes.some((code) => !/^\d+$/.test(code))).toBe(true);

    const names = MOCK_CATALOG_ITEMS.map((item) => item.name);
    expect(new Set(names).size).toBeLessThan(names.length);
  });

  it('carries at least 20 parties with duplicates and missing national codes', () => {
    expect(MOCK_PARTIES.length).toBeGreaterThanOrEqual(20);

    const ids = MOCK_PARTIES.map((party) => party.externalPartyId);
    expect(new Set(ids).size).toBeLessThan(ids.length);

    const nationalCodes = MOCK_PARTIES.map((party) => party.nationalCode).filter(
      (code): code is string => code !== null,
    );
    expect(new Set(nationalCodes).size).toBeLessThan(nationalCodes.length);
    expect(MOCK_PARTIES.some((party) => party.nationalCode === null)).toBe(true);
  });

  it('covers the four UAT tax rates', () => {
    expect([...MOCK_TAX_RATE_SAMPLES]).toEqual([0, 9, 10, 10.5]);
  });

  it('shows a success, a retryable failure and a manual-review outcome', () => {
    const states = MOCK_OPERATION_HISTORY_SAMPLES.map((sample) => sample.state);

    expect(states).toContain('SUCCEEDED');
    expect(states).toContain('FAILED_RETRYABLE');
    expect(states).toContain('FAILED_FINAL');
    expect(states).toContain('MANUAL_EXPORT_REQUIRED');
  });
});
