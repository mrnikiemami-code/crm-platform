import { accepted, refused, type Result } from 'src/domain/shared/result';

// WS4 document currency (ISO 4217). Distinct from MoneyUnit (IRR/TOMAN display scale).
//
// Phase 1: operational amounts are IRR only. Phase 2 may allow other catalog codes
// behind MULTI_CURRENCY_DOCUMENTS — never silently convert between currencies.

export const OPERATIONAL_DOCUMENT_CURRENCY_CODE = 'IRR' as const;

// Feature flag: when false, every draft/revision must use IRR and lines inherit it.
// Do not enable without architect grant + FX/totals-by-currency implementation.
export const MULTI_CURRENCY_DOCUMENTS = false;

export type DocumentCurrencyCode = string;

// Reserved for phase 2: document totals bucketed by ISO currency. Empty while the
// flag is off; never populated by FX conversion in phase 1.
export type TotalsByCurrency = Record<
  string,
  {
    netExact: string;
    taxExact: string;
    totalExact: string;
  }
>;

export const emptyTotalsByCurrency = (): TotalsByCurrency => ({});

export const normalizeDocumentCurrencyCode = (
  value: string | null | undefined,
): string => (value ?? '').trim().toUpperCase();

export const assertPhase1DocumentCurrency = (
  currencyCode: string | null | undefined,
): Result<typeof OPERATIONAL_DOCUMENT_CURRENCY_CODE> => {
  const code = normalizeDocumentCurrencyCode(currencyCode);

  if (code === '') {
    return accepted(OPERATIONAL_DOCUMENT_CURRENCY_CODE);
  }

  if (!MULTI_CURRENCY_DOCUMENTS && code !== OPERATIONAL_DOCUMENT_CURRENCY_CODE) {
    return refused(
      'OPERATIONAL_CURRENCY_MUST_BE_IRR',
      'در این فاز فقط ارز ریال ایران (IRR) برای پیش‌فاکتور مجاز است',
    );
  }

  if (!/^[A-Z]{3}$/.test(code)) {
    return refused('CURRENCY_CODE_INVALID', 'کد ارز سند معتبر نیست');
  }

  return accepted(
    code as typeof OPERATIONAL_DOCUMENT_CURRENCY_CODE,
  );
};

export const selectInitialDocumentCurrencyCode = ({
  entries,
  currentCode,
  keepCurrent,
}: {
  entries: Array<{ code: string; isDefault: boolean; isActive: boolean }>;
  currentCode: string;
  keepCurrent: boolean;
}): string => {
  const normalizedCurrent = normalizeDocumentCurrencyCode(currentCode);

  // Phase 1: never adopt a non-IRR current/default/fallback — even if the catalog
  // is incomplete, corrupted, or marks USD as default.
  if (!MULTI_CURRENCY_DOCUMENTS) {
    if (
      keepCurrent &&
      normalizedCurrent === OPERATIONAL_DOCUMENT_CURRENCY_CODE
    ) {
      return OPERATIONAL_DOCUMENT_CURRENCY_CODE;
    }

    const activeIrr = entries.find(
      (entry) =>
        entry.isActive &&
        entry.code.toUpperCase() === OPERATIONAL_DOCUMENT_CURRENCY_CODE,
    );

    if (activeIrr !== undefined) {
      return OPERATIONAL_DOCUMENT_CURRENCY_CODE;
    }

    return OPERATIONAL_DOCUMENT_CURRENCY_CODE;
  }

  if (keepCurrent && normalizedCurrent !== '') {
    return normalizedCurrent;
  }

  const active = entries.filter((entry) => entry.isActive);
  const defaultEntry =
    active.find((entry) => entry.isDefault) ??
    active.find(
      (entry) =>
        entry.code.toUpperCase() === OPERATIONAL_DOCUMENT_CURRENCY_CODE,
    ) ??
    active[0];

  if (defaultEntry !== undefined) {
    return defaultEntry.code.toUpperCase();
  }

  return OPERATIONAL_DOCUMENT_CURRENCY_CODE;
};
