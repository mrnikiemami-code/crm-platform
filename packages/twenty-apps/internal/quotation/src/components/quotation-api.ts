// Front-component side of the app routes. Same pattern as event-registration:
// platform injects TWENTY_FUNCTIONS_URL; /s on API host is legacy fallback only.

export type AppRouteResponse = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
};

const REQUEST_DEADLINE_MS = 30_000;

export const resolveFunctionsBaseUrl = (
  functionsUrl: string | undefined,
  apiBaseUrl: string | undefined,
): string | null => {
  const supported = functionsUrl ?? process.env.TWENTY_FUNCTIONS_URL;

  if (typeof supported === 'string' && supported.trim().length > 0) {
    return supported.trim().replace(/\/$/, '');
  }

  const legacyHost = apiBaseUrl ?? process.env.TWENTY_API_URL;

  if (typeof legacyHost === 'string' && legacyHost.trim().length > 0) {
    return `${legacyHost.trim().replace(/\/$/, '')}/s`;
  }

  return null;
};

export const callAppRoute = async (
  path: string,
  body: Record<string, unknown>,
): Promise<AppRouteResponse> => {
  const baseUrl = resolveFunctionsBaseUrl(undefined, undefined);
  const token =
    process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;

  if (baseUrl === null || !token) {
    throw new Error('API configuration missing');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
  });

  const text = await response.text();
  const parsed: unknown = text.length > 0 ? JSON.parse(text) : {};

  return {
    ok: response.ok,
    status: response.status,
    data:
      parsed !== null && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {},
  };
};

export const SAVE_CATALOG_ROUTE = '/quotation/save-catalog-item';
export const SAVE_DRAFT_ROUTE = '/quotation/save-draft';
export const SEARCH_CATALOG_ROUTE = '/quotation/search-catalog-items';
export const SEARCH_CUSTOMERS_ROUTE = '/quotation/search-customers';
export const ACCOUNTING_CONNECTION_ROUTE = '/quotation/accounting-connection';
export const ACCOUNTING_IMPORT_ROUTE = '/quotation/accounting-import';
export const ACCOUNTING_OUTBOUND_ROUTE = '/quotation/accounting-outbound';
export const TAX_POLICIES_ROUTE = '/quotation/tax-policies';
export const QUOTATION_CURRENCIES_ROUTE = '/quotation/currencies';
