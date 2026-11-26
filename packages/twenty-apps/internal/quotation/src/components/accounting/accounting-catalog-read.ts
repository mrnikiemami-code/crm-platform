import {
  type AppRouteResponse,
  callQuotationCurrenciesNestAction,
  callTaxPoliciesNestAction,
} from 'src/components/quotation-api';
import {
  type CurrencyCatalogView,
  type TaxPolicyView,
  readCurrencies,
  readTaxPolicies,
} from 'src/components/accounting/accounting-shared';

// Nest-authorized catalog reads for Accounting Settings. Same wrappers as Financial
// Settings; /s logic-function routes are not an authority for mapping UI.

export type CatalogReadKind = 'tax' | 'currency';

export type CatalogReadStatus =
  | 'loading'
  | 'ready_nonempty'
  | 'ready_empty'
  | 'error';

export type CatalogReadState<TRow> = {
  status: CatalogReadStatus;
  rows: TRow[];
  stale: boolean;
  errorMessage: string | null;
};

export const emptyCatalogState = <TRow,>(): CatalogReadState<TRow> => ({
  status: 'loading',
  rows: [],
  stale: false,
  errorMessage: null,
});

const TAX_LOAD_ERROR =
  'فهرست سیاست‌های مالیات از سرور خوانده نشد. نگاشت وابسته تا بازخوانی موفق قفل است.';
const CURRENCY_LOAD_ERROR =
  'فهرست ارزها از سرور خوانده نشد. نگاشت وابسته تا بازخوانی موفق قفل است.';

export const parseTaxCatalogResponse = (
  response: AppRouteResponse,
): { ok: true; rows: TaxPolicyView[] } | { ok: false; message: string } => {
  if (!response.ok || response.data.success !== true) {
    return { ok: false, message: TAX_LOAD_ERROR };
  }

  if (!('policies' in response.data)) {
    return { ok: false, message: TAX_LOAD_ERROR };
  }

  const rows = readTaxPolicies(response.data.policies);

  return { ok: true, rows };
};

export const parseCurrencyCatalogResponse = (
  response: AppRouteResponse,
):
  | { ok: true; rows: CurrencyCatalogView[] }
  | { ok: false; message: string } => {
  if (!response.ok || response.data.success !== true) {
    return { ok: false, message: CURRENCY_LOAD_ERROR };
  }

  if (!('currencies' in response.data)) {
    return { ok: false, message: CURRENCY_LOAD_ERROR };
  }

  const rows = readCurrencies(response.data.currencies);

  return { ok: true, rows };
};

const applySuccessfulRows = <TRow,>(
  previous: CatalogReadState<TRow>,
  rows: TRow[],
): CatalogReadState<TRow> => ({
  status: rows.length === 0 ? 'ready_empty' : 'ready_nonempty',
  rows,
  stale: false,
  errorMessage: null,
});

const applyFailedRead = <TRow,>(
  previous: CatalogReadState<TRow>,
  message: string,
): CatalogReadState<TRow> => {
  const hadReadyRows =
    previous.status === 'ready_nonempty' || previous.status === 'ready_empty';

  if (hadReadyRows && previous.rows.length >= 0) {
    return {
      status: 'error',
      rows: previous.rows,
      stale: true,
      errorMessage: message,
    };
  }

  return {
    status: 'error',
    rows: [],
    stale: false,
    errorMessage: message,
  };
};

export const mergeTaxCatalogResult = (
  previous: CatalogReadState<TaxPolicyView>,
  result: Awaited<ReturnType<typeof parseTaxCatalogResponse>>,
): CatalogReadState<TaxPolicyView> =>
  result.ok
    ? applySuccessfulRows(previous, result.rows)
    : applyFailedRead(previous, result.message);

export const mergeCurrencyCatalogResult = (
  previous: CatalogReadState<CurrencyCatalogView>,
  result: Awaited<ReturnType<typeof parseCurrencyCatalogResponse>>,
): CatalogReadState<CurrencyCatalogView> =>
  result.ok
    ? applySuccessfulRows(previous, result.rows)
    : applyFailedRead(previous, result.message);

export const loadTaxCatalogFromNest = async (): Promise<
  Awaited<ReturnType<typeof parseTaxCatalogResponse>>
> => {
  try {
    const response = await callTaxPoliciesNestAction({ action: 'list' });
    return parseTaxCatalogResponse(response);
  } catch {
    return { ok: false, message: TAX_LOAD_ERROR };
  }
};

export const loadCurrencyCatalogFromNest = async (): Promise<
  Awaited<ReturnType<typeof parseCurrencyCatalogResponse>>
> => {
  try {
    const response = await callQuotationCurrenciesNestAction({ action: 'list' });
    return parseCurrencyCatalogResponse(response);
  } catch {
    return { ok: false, message: CURRENCY_LOAD_ERROR };
  }
};

export const catalogBlocksMappingEdits = (
  state: CatalogReadState<unknown>,
): boolean => state.status === 'loading' || state.status === 'error';
