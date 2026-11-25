import { evaluateDocumentCurrencyForSave } from 'src/modules/quotation/utils/quotation-document-currency.util';

describe('quotation-document-currency.util', () => {
  it('accepts active IRR', () => {
    expect(
      evaluateDocumentCurrencyForSave({
        currencyCode: 'IRR',
        catalogIsActive: true,
      }),
    ).toEqual({ ok: true, currencyCode: 'IRR' });
  });

  it('refuses non-IRR in phase 1', () => {
    expect(
      evaluateDocumentCurrencyForSave({
        currencyCode: 'USD',
        catalogIsActive: true,
      }),
    ).toEqual({
      ok: false,
      code: 'OPERATIONAL_CURRENCY_MUST_BE_IRR',
      message: 'phase-1 quotations may only use IRR as the document currency',
    });
  });

  it('refuses inactive catalog currency', () => {
    expect(
      evaluateDocumentCurrencyForSave({
        currencyCode: 'IRR',
        catalogIsActive: false,
      }),
    ).toEqual({
      ok: false,
      code: 'CURRENCY_INACTIVE',
      message: 'currency "IRR" is inactive and cannot be used on a new draft',
    });
  });

  it('requires a currency code', () => {
    expect(
      evaluateDocumentCurrencyForSave({
        currencyCode: '  ',
        catalogIsActive: true,
      }),
    ).toMatchObject({ ok: false, code: 'CURRENCY_CODE_REQUIRED' });
  });
});
