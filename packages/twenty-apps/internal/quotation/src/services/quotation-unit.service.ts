import { callTaxPolicyAction } from 'src/data/tax-policy-api';
import { accepted, refused, type Result } from 'src/domain/shared/result';

export type QuotationUnitView = {
  recordId: string;
  code: string;
  name: string;
  isActive: boolean;
  accountingCode: string;
  catalogItemCount: number;
};

export type QuotationUnitMutationDependencies = {
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

const parseUnit = (value: unknown): QuotationUnitView | null => {
  const row = asRecord(value);

  if (row === null) {
    return null;
  }

  const recordId = readText(row.recordId);
  const code = readText(row.code);

  if (recordId === '' || code === '') {
    return null;
  }

  return {
    recordId,
    code,
    name: readText(row.name) || code,
    isActive: readBoolean(row.isActive, true),
    accountingCode: readText(row.accountingCode),
    catalogItemCount:
      typeof row.catalogItemCount === 'number' ? row.catalogItemCount : 0,
  };
};

const describeServerResult = (
  data: Record<string, unknown>,
): Result<QuotationUnitView[]> => {
  const units = Array.isArray(data.units) ? data.units : [];
  const entries = units
    .map((unit) => parseUnit(unit))
    .filter((entry): entry is QuotationUnitView => entry !== null);

  return accepted(entries);
};

const runServerAction = async (
  body: Record<string, unknown>,
  dependencies: QuotationUnitMutationDependencies,
): Promise<Result<QuotationUnitView[]>> => {
  const outcome = await callTaxPolicyAction({
    body,
    authorizationHeader: dependencies.authorizationHeader ?? null,
  });

  if (outcome.kind === 'REFUSED') {
    return refused(outcome.code, outcome.message);
  }

  return describeServerResult(outcome.data);
};

export const listQuotationUnits = (
  dependencies: QuotationUnitMutationDependencies = {},
): Promise<Result<QuotationUnitView[]>> =>
  runServerAction({ action: 'quotation-unit-list' }, dependencies);

export const saveQuotationUnit = (
  input: {
    recordId: string | null;
    name: string;
    accountingCodeText: string;
    isActive: boolean;
  },
  dependencies: QuotationUnitMutationDependencies = {},
): Promise<Result<QuotationUnitView[]>> =>
  runServerAction(
    {
      action: 'quotation-unit-save',
      recordId: input.recordId,
      name: input.name,
      accountingCodeText: input.accountingCodeText,
      isActive: input.isActive,
    },
    dependencies,
  );

export const deactivateQuotationUnit = (
  recordId: string,
  dependencies: QuotationUnitMutationDependencies = {},
): Promise<Result<QuotationUnitView[]>> =>
  runServerAction(
    { action: 'quotation-unit-deactivate', recordId },
    dependencies,
  );