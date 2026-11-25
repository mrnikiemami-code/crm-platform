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

  it('exposes an empty totalsByCurrency stub with no FX data', () => {
    expect(emptyTotalsByCurrency()).toEqual({});
  });
});
