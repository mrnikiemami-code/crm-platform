// WS4 phase-1 operational currency gate. Mirrors the app Money Domain rule:
// MULTI_CURRENCY_DOCUMENTS is off, so only IRR may be saved on a draft.

export const OPERATIONAL_DOCUMENT_CURRENCY_CODE = 'IRR';

export const MULTI_CURRENCY_DOCUMENTS = false;

export type DocumentCurrencyDecision =
  | { ok: true; currencyCode: string }
  | { ok: false; code: string; message: string };

export const evaluateDocumentCurrencyForSave = ({
  currencyCode,
  catalogIsActive,
}: {
  currencyCode: string | null | undefined;
  catalogIsActive: boolean | null | undefined;
}): DocumentCurrencyDecision => {
  const code = (currencyCode ?? '').trim().toUpperCase();

  if (code === '') {
    return {
      ok: false,
      code: 'CURRENCY_CODE_REQUIRED',
      message: 'document currencyCode is required',
    };
  }

  if (!/^[A-Z]{3}$/.test(code)) {
    return {
      ok: false,
      code: 'CURRENCY_CODE_INVALID',
      message: 'document currencyCode must be a 3-letter ISO code',
    };
  }

  if (!MULTI_CURRENCY_DOCUMENTS && code !== OPERATIONAL_DOCUMENT_CURRENCY_CODE) {
    return {
      ok: false,
      code: 'OPERATIONAL_CURRENCY_MUST_BE_IRR',
      message: 'phase-1 quotations may only use IRR as the document currency',
    };
  }

  if (catalogIsActive === false) {
    return {
      ok: false,
      code: 'CURRENCY_INACTIVE',
      message: `currency "${code}" is inactive and cannot be used on a new draft`,
    };
  }

  return { ok: true, currencyCode: code };
};
