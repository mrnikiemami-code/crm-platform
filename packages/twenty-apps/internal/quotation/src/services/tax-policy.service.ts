import {
  buildQuotationsUsingTaxPolicyQuery,
  buildTaxPoliciesQuery,
} from 'src/data/tax-policy-queries';
import { executeRecordGraphql } from 'src/data/record-api';
import { callTaxPolicyAction } from 'src/data/tax-policy-api';
import {
  parseBasisPointsText,
  type TaxPolicyCatalogEntry,
} from 'src/domain/money/tax-policy';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Reads the tax policy catalog of the workspace.
//
// WHY THE READ IS A PLAIN QUERY: a list must not create a row. The initial 9%
// policy is created only by the explicit bootstrap below, so opening the settings
// page or the draft form never writes.
//
// WHY THE WRITES GO TO THE SERVER: a rate is a financial decision, and the browser
// (or a logic function that failed to recover an identity) is not the authority for
// it. The server route owns the role check, the transaction, and the single default.
export type TaxPolicyDependencies = {
  execute?: (query: string) => Promise<Record<string, unknown>>;
};

export type TaxPolicyMutationDependencies = {
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

const readRows = (
  data: Record<string, unknown>,
  root: string,
): Record<string, unknown>[] => {
  const connection = asRecord(data[root]);
  const edges = connection?.edges;

  if (!Array.isArray(edges)) {
    return [];
  }

  return edges.flatMap((edge) => {
    const node = asRecord(asRecord(edge)?.node);

    return node === null ? [] : [node];
  });
};

export const parseTaxPolicyRecord = (
  node: Record<string, unknown>,
  position: number,
): TaxPolicyCatalogEntry | null => {
  const recordId = readText(node.id);
  const code = readText(node.code);
  const rate = parseBasisPointsText(readText(node.rateBasisPoints));

  // An unreadable row is skipped rather than guessed: a policy whose rate cannot
  // be read cannot be offered as a rate on a document.
  if (recordId === '' || code === '' || !rate.ok) {
    return null;
  }

  return {
    recordId,
    id: code,
    label: readText(node.name) || code,
    rateBasisPoints: rate.value,
    isExempt: readBoolean(node.isExempt, rate.value === BigInt(0)),
    isActive: readBoolean(node.isActive, true),
    isDefault: readBoolean(node.isDefault, false),
    position,
  };
};

export const loadTaxPolicies = async (
  dependencies: TaxPolicyDependencies = {},
): Promise<TaxPolicyCatalogEntry[]> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const data = await execute(buildTaxPoliciesQuery());

  return readRows(data, 'taxPolicies')
    .map((node, index) => parseTaxPolicyRecord(node, index))
    .filter((entry): entry is TaxPolicyCatalogEntry => entry !== null);
};

const parseServerPolicy = (
  value: unknown,
  position: number,
): TaxPolicyCatalogEntry | null => {
  const row = asRecord(value);

  if (row === null) {
    return null;
  }

  return parseTaxPolicyRecord(
    {
      id: row.recordId,
      code: row.code,
      name: row.name,
      rateBasisPoints: row.rateBasisPoints,
      isActive: row.isActive,
      isDefault: row.isDefault,
      isExempt: row.isExempt,
    },
    position,
  );
};

const describeServerResult = (
  data: Record<string, unknown>,
): Result<TaxPolicyCatalogEntry[]> => {
  const policies = Array.isArray(data.policies) ? data.policies : [];
  const entries = policies
    .map((policy, index) => parseServerPolicy(policy, index))
    .filter((entry): entry is TaxPolicyCatalogEntry => entry !== null);

  return accepted(entries);
};

const runServerAction = async (
  body: Record<string, unknown>,
  dependencies: TaxPolicyMutationDependencies,
): Promise<Result<TaxPolicyCatalogEntry[]>> => {
  const outcome = await callTaxPolicyAction({
    body,
    authorizationHeader: dependencies.authorizationHeader ?? null,
  });

  if (outcome.kind === 'REFUSED') {
    return refused(outcome.code, outcome.message);
  }

  return describeServerResult(outcome.data);
};

export type SaveTaxPolicyInput = {
  recordId: string | null;
  name: string;
  ratePercentText: string;
  isActive: boolean;
  isDefault: boolean;
  isExempt: boolean;
};

export const saveTaxPolicy = (
  input: SaveTaxPolicyInput,
  dependencies: TaxPolicyMutationDependencies = {},
): Promise<Result<TaxPolicyCatalogEntry[]>> =>
  runServerAction(
    {
      action: 'tax-policy-save',
      recordId: input.recordId,
      name: input.name,
      ratePercentText: input.ratePercentText,
      isActive: input.isActive,
      isDefault: input.isDefault,
      isExempt: input.isExempt,
    },
    dependencies,
  );

export const setDefaultTaxPolicy = (
  recordId: string,
  dependencies: TaxPolicyMutationDependencies = {},
): Promise<Result<TaxPolicyCatalogEntry[]>> =>
  runServerAction(
    { action: 'tax-policy-set-default', recordId },
    dependencies,
  );

export const deactivateTaxPolicy = (
  recordId: string,
  dependencies: TaxPolicyMutationDependencies = {},
): Promise<Result<TaxPolicyCatalogEntry[]>> =>
  runServerAction({ action: 'tax-policy-deactivate', recordId }, dependencies);

// The only path that creates the initial policy. Idempotent on the server, shown in
// the panel only when the catalog is empty.
export const bootstrapTaxPolicies = (
  dependencies: TaxPolicyMutationDependencies = {},
): Promise<Result<TaxPolicyCatalogEntry[]>> =>
  runServerAction({ action: 'tax-policy-bootstrap' }, dependencies);

// How many quotations name each policy, for the settings list. One query over the
// quotations, not one per policy: the number is evidence for the operator ("used in
// 3 documents"), never a reason to refuse a deactivation.
export const countQuotationsPerTaxPolicy = async (
  dependencies: TaxPolicyDependencies = {},
): Promise<Map<string, number>> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const data = await execute(buildQuotationsUsingTaxPolicyQuery());
  const counts = new Map<string, number>();

  for (const node of readRows(data, 'quotations')) {
    const code = readText(node.taxPolicy);

    if (code === '') {
      continue;
    }

    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return counts;
};
