import { executeRecordGraphql } from 'src/data/record-api';
import { callRoundingRuleAction } from 'src/data/rounding-rule-api';
import {
  buildQuotationsUsingRoundingRuleQuery,
  buildRoundingRulesQuery,
} from 'src/data/rounding-rule-queries';
import {
  parseStepRialsText,
  type RoundingRuleCatalogEntry,
} from 'src/domain/money/rounding-rule';
import { accepted, refused, type Result } from 'src/domain/shared/result';

export type RoundingRuleDependencies = {
  execute?: (query: string) => Promise<Record<string, unknown>>;
};

export type RoundingRuleMutationDependencies = {
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

export const parseRoundingRuleRecord = (
  node: Record<string, unknown>,
  position: number,
): RoundingRuleCatalogEntry | null => {
  const recordId = readText(node.id);
  const code = readText(node.code);
  const step = parseStepRialsText(readText(node.stepRials));

  if (recordId === '' || code === '' || !step.ok) {
    return null;
  }

  return {
    recordId,
    id: code,
    label: readText(node.name) || code,
    stepRials: step.value,
    isActive: readBoolean(node.isActive, true),
    isDefault: readBoolean(node.isDefault, false),
    position,
  };
};

export const loadRoundingRules = async (
  dependencies: RoundingRuleDependencies = {},
): Promise<RoundingRuleCatalogEntry[]> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const data = await execute(buildRoundingRulesQuery());

  return readRows(data, 'roundingRules')
    .map((node, index) => parseRoundingRuleRecord(node, index))
    .filter((entry): entry is RoundingRuleCatalogEntry => entry !== null);
};

const parseServerRule = (
  value: unknown,
  position: number,
): RoundingRuleCatalogEntry | null => {
  const row = asRecord(value);

  if (row === null) {
    return null;
  }

  return parseRoundingRuleRecord(
    {
      id: row.recordId,
      code: row.code,
      name: row.name,
      stepRials: row.stepRials,
      isActive: row.isActive,
      isDefault: row.isDefault,
    },
    position,
  );
};

const describeServerResult = (
  data: Record<string, unknown>,
): Result<RoundingRuleCatalogEntry[]> => {
  const rules = Array.isArray(data.rules) ? data.rules : [];
  const entries = rules
    .map((rule, index) => parseServerRule(rule, index))
    .filter((entry): entry is RoundingRuleCatalogEntry => entry !== null);

  return accepted(entries);
};

const runServerAction = async (
  body: Record<string, unknown>,
  dependencies: RoundingRuleMutationDependencies,
): Promise<Result<RoundingRuleCatalogEntry[]>> => {
  const outcome = await callRoundingRuleAction({
    body,
    authorizationHeader: dependencies.authorizationHeader ?? null,
  });

  if (outcome.kind === 'REFUSED') {
    return refused(outcome.code, outcome.message);
  }

  return describeServerResult(outcome.data);
};

export type SaveRoundingRuleInput = {
  recordId: string | null;
  name: string;
  stepRialsText: string;
  isActive: boolean;
  isDefault: boolean;
};

export const saveRoundingRule = (
  input: SaveRoundingRuleInput,
  dependencies: RoundingRuleMutationDependencies = {},
): Promise<Result<RoundingRuleCatalogEntry[]>> =>
  runServerAction(
    {
      action: 'rounding-rule-save',
      recordId: input.recordId,
      name: input.name,
      stepRialsText: input.stepRialsText,
      isActive: input.isActive,
      isDefault: input.isDefault,
    },
    dependencies,
  );

export const setDefaultRoundingRule = (
  recordId: string,
  dependencies: RoundingRuleMutationDependencies = {},
): Promise<Result<RoundingRuleCatalogEntry[]>> =>
  runServerAction(
    { action: 'rounding-rule-set-default', recordId },
    dependencies,
  );

export const deactivateRoundingRule = (
  recordId: string,
  dependencies: RoundingRuleMutationDependencies = {},
): Promise<Result<RoundingRuleCatalogEntry[]>> =>
  runServerAction(
    { action: 'rounding-rule-deactivate', recordId },
    dependencies,
  );

export const deleteRoundingRule = (
  recordId: string,
  dependencies: RoundingRuleMutationDependencies = {},
): Promise<Result<RoundingRuleCatalogEntry[]>> =>
  runServerAction({ action: 'rounding-rule-delete', recordId }, dependencies);

export const bootstrapRoundingRules = (
  dependencies: RoundingRuleMutationDependencies = {},
): Promise<Result<RoundingRuleCatalogEntry[]>> =>
  runServerAction({ action: 'rounding-rule-bootstrap' }, dependencies);

export const countQuotationsPerRoundingRule = async (
  dependencies: RoundingRuleDependencies = {},
): Promise<Map<string, number>> => {
  const execute = dependencies.execute ?? executeRecordGraphql;
  const data = await execute(buildQuotationsUsingRoundingRuleQuery());
  const counts = new Map<string, number>();

  for (const node of readRows(data, 'quotations')) {
    const code = readText(node.roundingRuleCode);

    if (code === '') {
      continue;
    }

    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return counts;
};
