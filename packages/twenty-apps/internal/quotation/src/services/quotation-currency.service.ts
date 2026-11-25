import { callTaxPolicyAction } from 'src/data/tax-policy-api';
import { accepted, refused, type Result } from 'src/domain/shared/result';

export type QuotationCurrencyView = {
  recordId: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  accountingCode: string;
};

export type QuotationCurrencyMutationDependencies = {
  authorizationHeader?: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const parseCurrency = (value: unknown): QuotationCurrencyView | null => {
  const row = asRecord(value);

  if (row === null) {
    return null;
  }

  const recordId = readText(row.recordId);
  const code = readText(row.code).toUpperCase();

  if (recordId === '' || code === '') {
    return null;
  }

  return {
    recordId,
    code,
    name: readText(row.name) || code,
    isDefault: readBoolean(row.isDefault, false),
    isActive: readBoolean(row.isActive, true),
    accountingCode: readText(row.accountingCode),
  };
};

const describeServerResult = (
  data: Record<string, unknown>,
): Result<QuotationCurrencyView[]> => {
  const currencies = Array.isArray(data.currencies) ? data.currencies : [];
  const entries = currencies
    .map((currency) => parseCurrency(currency))
    .filter((entry): entry is QuotationCurrencyView => entry !== null);

  return accepted(entries);
};

const runServerAction = async (
  body: Record<string, unknown>,
  dependencies: QuotationCurrencyMutationDependencies,
): Promise<Result<QuotationCurrencyView[]>> => {
  // Reuses the same REST transport as tax settings; action names are distinct.
  const outcome = await callTaxPolicyAction({
    body,
    authorizationHeader: dependencies.authorizationHeader ?? null,
  });

  if (outcome.kind === 'REFUSED') {
    return refused(outcome.code, outcome.message);
  }

  return describeServerResult(outcome.data);
};

export const listQuotationCurrencies = (
  dependencies: QuotationCurrencyMutationDependencies = {},
): Promise<Result<QuotationCurrencyView[]>> =>
  runServerAction({ action: 'quotation-currency-list' }, dependencies);

export const bootstrapQuotationCurrencies = (
  dependencies: QuotationCurrencyMutationDependencies = {},
): Promise<Result<QuotationCurrencyView[]>> =>
  runServerAction({ action: 'quotation-currency-bootstrap' }, dependencies);

export const saveQuotationCurrency = (
  input: {
    recordId: string;
    name: string;
    accountingCodeText: string;
    isActive: boolean;
    isDefault: boolean;
  },
  dependencies: QuotationCurrencyMutationDependencies = {},
): Promise<Result<QuotationCurrencyView[]>> =>
  runServerAction(
    {
      action: 'quotation-currency-save',
      recordId: input.recordId,
      name: input.name,
      accountingCodeText: input.accountingCodeText,
      isActive: input.isActive,
      isDefault: input.isDefault,
    },
    dependencies,
  );

export const setDefaultQuotationCurrency = (
  recordId: string,
  dependencies: QuotationCurrencyMutationDependencies = {},
): Promise<Result<QuotationCurrencyView[]>> =>
  runServerAction(
    { action: 'quotation-currency-set-default', recordId },
    dependencies,
  );
