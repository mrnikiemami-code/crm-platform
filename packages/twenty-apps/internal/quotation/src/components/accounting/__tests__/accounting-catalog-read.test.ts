import { describe, expect, it, vi } from 'vitest';

const { callTaxPoliciesNestActionMock, callQuotationCurrenciesNestActionMock } =
  vi.hoisted(() => ({
    callTaxPoliciesNestActionMock: vi.fn(),
    callQuotationCurrenciesNestActionMock: vi.fn(),
  }));

vi.mock('src/components/quotation-api', () => ({
  callTaxPoliciesNestAction: callTaxPoliciesNestActionMock,
  callQuotationCurrenciesNestAction: callQuotationCurrenciesNestActionMock,
}));

import {
  catalogBlocksMappingEdits,
  emptyCatalogState,
  loadCurrencyCatalogFromNest,
  loadTaxCatalogFromNest,
  mergeCurrencyCatalogResult,
  mergeTaxCatalogResult,
  parseCurrencyCatalogResponse,
  parseTaxCatalogResponse,
  type CatalogReadState,
} from 'src/components/accounting/accounting-catalog-read';
import type {
  CurrencyCatalogView,
  TaxPolicyView,
} from 'src/components/accounting/accounting-shared';

const taxRow = (code: string): TaxPolicyView => ({
  code,
  name: code,
  ratePercent: '9',
  dutyRatePercent: '0',
  totalRatePercent: '9',
  rateBasisPoints: '900',
  dutyRateBasisPoints: '0',
  totalRateBasisPoints: '900',
  isActive: true,
  isDefault: false,
  isExempt: false,
});

const currencyRow = (code: string): CurrencyCatalogView => ({
  code,
  name: code,
  isActive: true,
  isDefault: code === 'IRR',
});

describe('parseTaxCatalogResponse', () => {
  it('rejects HTTP failure and success!==true as error, not empty', () => {
    expect(
      parseTaxCatalogResponse({
        ok: false,
        status: 500,
        data: { success: false, message: 'boom' },
      }),
    ).toEqual({
      ok: false,
      message: expect.stringContaining('مالیات'),
    });

    expect(
      parseTaxCatalogResponse({
        ok: true,
        status: 200,
        data: { success: false, message: 'denied' },
      }),
    ).toMatchObject({ ok: false });
  });

  it('rejects a 200 body without policies as error', () => {
    expect(
      parseTaxCatalogResponse({
        ok: true,
        status: 200,
        data: { success: true },
      }),
    ).toMatchObject({ ok: false });
  });

  it('accepts a genuine empty policies array as ok with zero rows', () => {
    expect(
      parseTaxCatalogResponse({
        ok: true,
        status: 200,
        data: { success: true, policies: [] },
      }),
    ).toEqual({ ok: true, rows: [] });
  });

  it('normalizes valid policy rows', () => {
    const result = parseTaxCatalogResponse({
      ok: true,
      status: 200,
      data: {
        success: true,
        policies: [
          {
            code: 'STD',
            name: 'استاندارد',
            ratePercent: '9',
            dutyRatePercent: '0',
            totalRatePercent: '9',
            rateBasisPoints: '900',
            dutyRateBasisPoints: '0',
            totalRateBasisPoints: '900',
            isActive: true,
            isDefault: true,
            isExempt: false,
          },
        ],
      },
    });

    expect(result).toMatchObject({
      ok: true,
      rows: [{ code: 'STD', name: 'استاندارد', isDefault: true }],
    });
  });
});

describe('parseCurrencyCatalogResponse', () => {
  it('rejects malformed success body as error', () => {
    expect(
      parseCurrencyCatalogResponse({
        ok: true,
        status: 200,
        data: { success: true },
      }),
    ).toMatchObject({ ok: false });
  });

  it('accepts genuine empty currencies', () => {
    expect(
      parseCurrencyCatalogResponse({
        ok: true,
        status: 200,
        data: { success: true, currencies: [] },
      }),
    ).toEqual({ ok: true, rows: [] });
  });
});

describe('merge catalog results', () => {
  it('marks ready_empty vs ready_nonempty distinctly', () => {
    const previous = emptyCatalogState<TaxPolicyView>();

    expect(mergeTaxCatalogResult(previous, { ok: true, rows: [] })).toEqual({
      status: 'ready_empty',
      rows: [],
      stale: false,
      errorMessage: null,
    });

    expect(
      mergeTaxCatalogResult(previous, { ok: true, rows: [taxRow('STD')] }),
    ).toMatchObject({ status: 'ready_nonempty', stale: false });
  });

  it('keeps prior rows as stale display on later error', () => {
    const ready: CatalogReadState<CurrencyCatalogView> = {
      status: 'ready_nonempty',
      rows: [currencyRow('IRR')],
      stale: false,
      errorMessage: null,
    };

    const failed = mergeCurrencyCatalogResult(ready, {
      ok: false,
      message: 'down',
    });

    expect(failed).toEqual({
      status: 'error',
      rows: [currencyRow('IRR')],
      stale: true,
      errorMessage: 'down',
    });
    expect(catalogBlocksMappingEdits(failed)).toBe(true);
  });

  it('blocks edits while loading', () => {
    expect(catalogBlocksMappingEdits(emptyCatalogState())).toBe(true);
  });
});

describe('Nest loaders', () => {
  it('loadTaxCatalogFromNest uses callTaxPoliciesNestAction list only', async () => {
    callTaxPoliciesNestActionMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { success: true, policies: [] },
    });

    await expect(loadTaxCatalogFromNest()).resolves.toEqual({
      ok: true,
      rows: [],
    });
    expect(callTaxPoliciesNestActionMock).toHaveBeenCalledWith({ action: 'list' });
  });

  it('loadCurrencyCatalogFromNest uses callQuotationCurrenciesNestAction list only', async () => {
    callQuotationCurrenciesNestActionMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        success: true,
        currencies: [{ code: 'IRR', name: 'ریال', isActive: true }],
      },
    });

    await expect(loadCurrencyCatalogFromNest()).resolves.toMatchObject({
      ok: true,
      rows: [{ code: 'IRR' }],
    });
    expect(callQuotationCurrenciesNestActionMock).toHaveBeenCalledWith({
      action: 'list',
    });
  });

  it('thrown Nest calls become error results, not empty catalogs', async () => {
    callTaxPoliciesNestActionMock.mockRejectedValueOnce(new Error('offline'));
    callQuotationCurrenciesNestActionMock.mockRejectedValueOnce(
      new Error('offline'),
    );

    await expect(loadTaxCatalogFromNest()).resolves.toMatchObject({ ok: false });
    await expect(loadCurrencyCatalogFromNest()).resolves.toMatchObject({
      ok: false,
    });
  });
});
