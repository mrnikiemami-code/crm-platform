import { describe, expect, it } from 'vitest';

import {
  assertPhase1DocumentCurrency,
  emptyTotalsByCurrency,
  MULTI_CURRENCY_DOCUMENTS,
  OPERATIONAL_DOCUMENT_CURRENCY_CODE,
  selectInitialDocumentCurrencyCode,
} from 'src/domain/money/document-currency';

describe('document currency (WS4)', () => {
  it('keeps MULTI_CURRENCY_DOCUMENTS off in phase 1', () => {
    expect(MULTI_CURRENCY_DOCUMENTS).toBe(false);
  });

  it('defaults empty currency to IRR', () => {
    const result = assertPhase1DocumentCurrency(null);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(OPERATIONAL_DOCUMENT_CURRENCY_CODE);
    }
  });

  it('accepts IRR', () => {
    const result = assertPhase1DocumentCurrency('irr');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('IRR');
    }
  });

  it('refuses non-IRR while the multi-currency flag is off', () => {
    const result = assertPhase1DocumentCurrency('USD');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal.code).toBe('OPERATIONAL_CURRENCY_MUST_BE_IRR');
    }
  });

  it('selects the workspace default for a new draft', () => {
    expect(
      selectInitialDocumentCurrencyCode({
        entries: [
          { code: 'IRR', isDefault: true, isActive: true },
          { code: 'USD', isDefault: false, isActive: true },
        ],
        currentCode: 'IRR',
        keepCurrent: false,
      }),
    ).toBe('IRR');
  });

  it('never auto-selects USD when it is the only active default', () => {
    expect(
      selectInitialDocumentCurrencyCode({
        entries: [{ code: 'USD', isDefault: true, isActive: true }],
        currentCode: 'USD',
        keepCurrent: false,
      }),
    ).toBe('IRR');
  });

  it('never keeps a non-IRR current code in phase 1', () => {
    expect(
      selectInitialDocumentCurrencyCode({
        entries: [
          { code: 'USD', isDefault: true, isActive: true },
          { code: 'IRR', isDefault: false, isActive: false },
        ],
        currentCode: 'USD',
        keepCurrent: true,
      }),
    ).toBe('IRR');
  });

  it('still returns IRR when the catalog is empty', () => {
    expect(
      selectInitialDocumentCurrencyCode({
        entries: [],
        currentCode: '',
        keepCurrent: false,
      }),
    ).toBe('IRR');
  });

  it('exposes an empty totalsByCurrency stub with no FX data', () => {
    expect(emptyTotalsByCurrency()).toEqual({});
  });
});
