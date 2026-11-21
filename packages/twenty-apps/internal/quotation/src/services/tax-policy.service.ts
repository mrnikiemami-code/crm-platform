import {
  buildCreateTaxPolicyMutation,
  buildQuotationsUsingTaxPolicyQuery,
  buildTaxPoliciesQuery,
  buildUpdateTaxPolicyMutation,
} from 'src/data/tax-policy-queries';
import { executeRecordGraphql } from 'src/data/record-api';
import { type GraphqlValue } from 'src/data/graphql-literal';
import {
  LEGACY_TAX_POLICIES,
  buildTaxPolicyDefinition,
  parseBasisPointsText,
  parsePercentToBasisPoints,
  type TaxPolicyCatalogEntry,
  type TaxPolicyDefinition,
} from 'src/domain/money/tax-policy';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// The tax settings service. It owns the three invariants a policy list cannot
// express on its own: exactly one default, a zero rate is the only exemption, and a
// policy that documents already reference is deactivated rather than destroyed.
//
// WHY `list` MAY WRITE: a workspace that has never opened these settings still has
// to quote, and the rate in force there is the 9% policy the app has used since S1.
// Seeding that one row (from the same definition the legacy documents were sealed
// with) is what keeps "no hardcoded rate" true: the rate is read from the row, not
// from the code path that happens to run first.

export type TaxPolicyDependencies = {
  execute?: (query: string) => Promise<Record<string, unknown>>;
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
    isExempt: readBoolean(node.isExempt, rate.value === 0n),
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

const policyColumns = (
  definition: TaxPolicyDefinition,
  {
    isActive,
    isDefault,
  }: { isActive: boolean; isDefault: boolean },
): Record<string, GraphqlValue> => ({
  name: definition.label,
  code: definition.id,
  rateBasisPoints: definition.rateBasisPoints.toString(),
  isActive,
  isDefault,
  isExempt: definition.isExempt,
});

// The initial policy of a workspace that has none. Written once, from the same 9%
// definition the sealed legacy documents used, and marked as the default so a new
// quotation starts at the rate already in force.
const ensureBaselinePolicy = async (
  entries: TaxPolicyCatalogEntry[],
  execute: (query: string) => Promise<Record<string, unknown>>,
): Promise<TaxPolicyCatalogEntry[]> => {
  if (entries.length > 0) {
    return entries;
  }

  const baseline = LEGACY_TAX_POLICIES[0];

  await execute(
    buildCreateTaxPolicyMutation(
      policyColumns(baseline, { isActive: true, isDefault: true }),
    ),
  );

  return loadTaxPolicies({ execute });
};

export const loadTaxPoliciesWithBaseline = async (
  dependencies: TaxPolicyDependencies = {},
): Promise<TaxPolicyCatalogEntry[]> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const entries = await loadTaxPolicies({ execute });

  return ensureBaselinePolicy(entries, execute);
};

// A new policy needs a code that documents can carry forever. It is derived from
// the rate so it is stable and readable, and suffixed only when that rate is
// already taken by another policy.
const nextPolicyCode = (
  entries: readonly TaxPolicyCatalogEntry[],
  rateBasisPoints: bigint,
): string => {
  const base = `TAX_${rateBasisPoints.toString()}`;
  const taken = new Set(entries.map((entry) => entry.id));

  if (!taken.has(base)) {
    return base;
  }

  let suffix = 2;

  while (taken.has(`${base}_${suffix}`)) {
    suffix += 1;
  }

  return `${base}_${suffix}`;
};

export type SaveTaxPolicyInput = {
  recordId: string | null;
  name: string;
  ratePercentText: string;
  isActive: boolean;
  isDefault: boolean;
  isExempt: boolean;
};

export const saveTaxPolicy = async (
  input: SaveTaxPolicyInput,
  dependencies: TaxPolicyDependencies = {},
): Promise<Result<TaxPolicyCatalogEntry[]>> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const entries = await loadTaxPoliciesWithBaseline({ execute });
  const existing =
    input.recordId === null
      ? null
      : (entries.find((entry) => entry.recordId === input.recordId) ?? null);

  if (input.recordId !== null && existing === null) {
    return refused('TAX_POLICY_NOT_FOUND', 'سیاست مالیات پیدا نشد');
  }

  const rate = parsePercentToBasisPoints(input.ratePercentText);

  if (!rate.ok) {
    return rate;
  }

  const wasDefault = existing?.isDefault === true;

  // Turning the default off without naming a replacement would leave a workspace
  // with no starting rate, so the deactivation is refused while it is the default.
  if (wasDefault && !input.isActive) {
    return refused(
      'TAX_POLICY_DEFAULT_MUST_STAY_ACTIVE',
      'سیاست پیش‌فرض را نمی‌توان غیرفعال کرد؛ ابتدا سیاست پیش‌فرض دیگری انتخاب کنید',
    );
  }

  if (input.isDefault && !input.isActive) {
    return refused(
      'TAX_POLICY_DEFAULT_MUST_BE_ACTIVE',
      'سیاست پیش‌فرض باید فعال باشد',
    );
  }

  const code = existing?.id ?? nextPolicyCode(entries, rate.value);
  const definition = buildTaxPolicyDefinition({
    code,
    label: input.name,
    rateBasisPoints: rate.value,
    isExempt: input.isExempt,
  });

  if (!definition.ok) {
    return definition;
  }

  const shouldBeDefault = input.isDefault || wasDefault;
  const columns = policyColumns(definition.value, {
    isActive: input.isActive,
    isDefault: shouldBeDefault,
  });

  // Exactly one default: every other flagged policy is cleared before the chosen
  // one is written, so a failed second write cannot leave two defaults behind.
  if (shouldBeDefault) {
    for (const entry of entries) {
      if (entry.isDefault && entry.recordId !== existing?.recordId) {
        await execute(
          buildUpdateTaxPolicyMutation(entry.recordId, { isDefault: false }),
        );
      }
    }
  }

  if (existing === null) {
    await execute(buildCreateTaxPolicyMutation(columns));
  } else {
    await execute(
      buildUpdateTaxPolicyMutation(existing.recordId, columns),
    );
  }

  const updated = await loadTaxPolicies({ execute });
  const hasDefault = updated.some((entry) => entry.isDefault);

  // A first policy that nobody flagged as default still needs a starting rate.
  if (!hasDefault && updated.length > 0) {
    await execute(
      buildUpdateTaxPolicyMutation(updated[0].recordId, { isDefault: true }),
    );

    return accepted(await loadTaxPolicies({ execute }));
  }

  return accepted(updated);
};

export const setDefaultTaxPolicy = async (
  recordId: string,
  dependencies: TaxPolicyDependencies = {},
): Promise<Result<TaxPolicyCatalogEntry[]>> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const entries = await loadTaxPoliciesWithBaseline({ execute });
  const chosen = entries.find((entry) => entry.recordId === recordId);

  if (chosen === undefined) {
    return refused('TAX_POLICY_NOT_FOUND', 'سیاست مالیات پیدا نشد');
  }

  if (!chosen.isActive) {
    return refused(
      'TAX_POLICY_DEFAULT_MUST_BE_ACTIVE',
      'سیاست غیرفعال را نمی‌توان پیش‌فرض کرد',
    );
  }

  for (const entry of entries) {
    if (entry.isDefault && entry.recordId !== recordId) {
      await execute(
        buildUpdateTaxPolicyMutation(entry.recordId, { isDefault: false }),
      );
    }
  }

  await execute(buildUpdateTaxPolicyMutation(recordId, { isDefault: true }));

  return accepted(await loadTaxPolicies({ execute }));
};

// Deactivation, never destruction. A policy that a quotation already names must
// stay readable in that document's history; stopping new use is what "not in the
// list" means here, and it is the only removal this settings page offers.
export const deactivateTaxPolicy = async (
  recordId: string,
  dependencies: TaxPolicyDependencies = {},
): Promise<Result<TaxPolicyCatalogEntry[]>> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const entries = await loadTaxPoliciesWithBaseline({ execute });
  const chosen = entries.find((entry) => entry.recordId === recordId);

  if (chosen === undefined) {
    return refused('TAX_POLICY_NOT_FOUND', 'سیاست مالیات پیدا نشد');
  }

  if (chosen.isDefault) {
    return refused(
      'TAX_POLICY_IS_DEFAULT',
      'سیاست پیش‌فرض را ابتدا با انتخاب سیاست دیگری جابه‌جا کنید',
    );
  }

  const activeOthers = entries.filter(
    (entry) => entry.isActive && entry.recordId !== recordId,
  );

  if (activeOthers.length === 0) {
    return refused(
      'TAX_POLICY_LAST_ACTIVE',
      'حداقل یک سیاست مالیات فعال لازم است',
    );
  }

  // There is no destroy here on purpose. This is the only removal the settings page
  // offers, because a quotation that names this policy must stay readable forever.
  await execute(buildUpdateTaxPolicyMutation(recordId, { isActive: false }));

  return accepted(await loadTaxPolicies({ execute }));
};

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
