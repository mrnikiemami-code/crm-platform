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
  // The old route constants remain stable call-site identifiers, not HTTP URLs
  // for accounting. There is no Functions fallback for these operations.
  if (path === ACCOUNTING_CONNECTION_ROUTE) {
    return callAccountingConnectionNestAction(body);
  }
  if (path === ACCOUNTING_IMPORT_ROUTE || path === ACCOUNTING_OUTBOUND_ROUTE) {
    return callAccountingOperationNestAction(path, body);
  }

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

// Nest quotation UI actions. Dev /s logic-function GraphQL fails when the worker
// image drifts from the DB; Nest still enforces workspace role + settings authority.
const callQuotationNestAction = async (
  actionMap: Record<string, string>,
  body: Record<string, unknown>,
  deadlineMs = REQUEST_DEADLINE_MS,
): Promise<AppRouteResponse> => {
  const apiBase = (process.env.TWENTY_API_URL ?? '').trim().replace(/\/$/, '');
  const token =
    process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;
  const appAction =
    typeof body.action === 'string' && body.action.trim() !== ''
      ? body.action.trim()
      : 'list';
  const nestAction = actionMap[appAction] ?? appAction;

  if (apiBase === '' || !token) {
    throw new Error('API configuration missing');
  }

  const response = await fetch(`${apiBase}/rest/quotation/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, action: nestAction }),
    signal: AbortSignal.timeout(deadlineMs),
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

const ROUNDING_APP_ACTION_TO_NEST: Record<string, string> = {
  list: 'rounding-rule-list',
  bootstrap: 'rounding-rule-bootstrap',
  save: 'rounding-rule-save',
  'set-default': 'rounding-rule-set-default',
  deactivate: 'rounding-rule-deactivate',
  delete: 'rounding-rule-delete',
};

const TAX_APP_ACTION_TO_NEST: Record<string, string> = {
  list: 'tax-policy-list',
  bootstrap: 'tax-policy-bootstrap',
  save: 'tax-policy-save',
  'set-default': 'tax-policy-set-default',
  deactivate: 'tax-policy-deactivate',
  delete: 'tax-policy-delete',
};

const CURRENCY_APP_ACTION_TO_NEST: Record<string, string> = {
  list: 'quotation-currency-list',
  bootstrap: 'quotation-currency-bootstrap',
  save: 'quotation-currency-save',
  'set-default': 'quotation-currency-set-default',
};

export const callRoundingRulesNestAction = (
  body: Record<string, unknown>,
): Promise<AppRouteResponse> =>
  callQuotationNestAction(ROUNDING_APP_ACTION_TO_NEST, body);

export const callTaxPoliciesNestAction = (
  body: Record<string, unknown>,
): Promise<AppRouteResponse> =>
  callQuotationNestAction(TAX_APP_ACTION_TO_NEST, body);

export const callQuotationCurrenciesNestAction = (
  body: Record<string, unknown>,
): Promise<AppRouteResponse> =>
  callQuotationNestAction(CURRENCY_APP_ACTION_TO_NEST, body);

// The accounting connection previously called the Logic Function /s route, which is not
// served by the Dev worker. The Nest controller already owns these six operations and
// performs the workspace/role checks. Never silently fall back to /s for financial writes.
const ACCOUNTING_CONNECTION_APP_ACTION_TO_NEST: Record<string, string> = {
  list: 'accounting-connection-list',
  save: 'accounting-connection-save',
  test: 'accounting-connection-test',
  'set-default': 'accounting-connection-set-default',
  deactivate: 'accounting-connection-deactivate',
  reactivate: 'accounting-connection-reactivate',
};

export const callAccountingConnectionNestAction = (
  body: Record<string, unknown>,
): Promise<AppRouteResponse> => {
  const action = typeof body.action === 'string' ? body.action : '';

  if (!Object.prototype.hasOwnProperty.call(ACCOUNTING_CONNECTION_APP_ACTION_TO_NEST, action)) {
    return Promise.resolve({
      ok: false,
      status: 400,
      data: {
        success: false,
        code: 'INVALID_INPUT',
        message: 'عملیات اتصال حسابداری معتبر نیست.',
      },
    });
  }

  return callQuotationNestAction(ACCOUNTING_CONNECTION_APP_ACTION_TO_NEST, body);
};

const ACCOUNTING_IMPORT_ACTIONS: Record<string, string> = {
  'preview-items-page': 'accounting-import-preview-items-page',
  'preview-parties-page': 'accounting-import-preview-parties-page',
  'search-party-candidates': 'accounting-import-search-party-candidates',
  'preview-items': 'accounting-import-preview-items',
  'apply-items': 'accounting-import-apply-items',
  'preview-parties': 'accounting-import-preview-parties',
  'apply-parties': 'accounting-import-apply-parties',
};
const ACCOUNTING_OUTBOUND_ACTIONS: Record<string, string> = {
  'operations': 'accounting-outbound-operations',
  'preview-item-push': 'accounting-outbound-preview-item-push',
  'execute-item-push': 'accounting-outbound-execute-item-push',
  'preview-quotation-export': 'accounting-outbound-preview-quotation-export',
  'execute-quotation-export': 'accounting-outbound-execute-quotation-export',
  'list-exportable-quotations': 'accounting-outbound-list-exportable-quotations',
};

export const callAccountingOperationNestAction = (
  path: string,
  body: Record<string, unknown>,
): Promise<AppRouteResponse> => {
  const actions = path === ACCOUNTING_IMPORT_ROUTE
    ? ACCOUNTING_IMPORT_ACTIONS
    : path === ACCOUNTING_OUTBOUND_ROUTE ? ACCOUNTING_OUTBOUND_ACTIONS : null;
  const action = typeof body.action === 'string' ? body.action : '';
  if (actions === null || !Object.prototype.hasOwnProperty.call(actions, action)) {
    return Promise.resolve({
      ok: false,
      status: 400,
      data: { success: false, code: 'INVALID_INPUT', message: 'عملیات حسابداری معتبر نیست.' },
    });
  }
  return callQuotationNestAction(actions, body, 70_000);
};

export const SAVE_CATALOG_ROUTE = '/quotation/save-catalog-item';
export const SAVE_DRAFT_ROUTE = '/quotation/save-draft';
export const SEARCH_CATALOG_ROUTE = '/quotation/search-catalog-items';
export const SEARCH_CUSTOMERS_ROUTE = '/quotation/search-customers';
export const ACCOUNTING_CONNECTION_ROUTE = '/quotation/accounting-connection';
export const ACCOUNTING_IMPORT_ROUTE = '/quotation/accounting-import';
export const ACCOUNTING_OUTBOUND_ROUTE = '/quotation/accounting-outbound';
export const TAX_POLICIES_ROUTE = '/quotation/tax-policies';
export const ROUNDING_RULES_ROUTE = '/quotation/rounding-rules';
export const QUOTATION_CURRENCIES_ROUTE = '/quotation/currencies';
