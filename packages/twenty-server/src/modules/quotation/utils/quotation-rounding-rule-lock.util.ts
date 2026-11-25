import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';

// Serializes catalog mutations with draft saves that read the selected rule.
const roundingRuleLockKey = (workspaceId: string): string =>
  `quotation-rounding-rule:${workspaceId}`;

export const acquireRoundingRuleExclusiveLock = async (
  transactionScope: WorkspaceTransactionScope,
): Promise<void> => {
  await transactionScope.executeRawQuery(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [roundingRuleLockKey(transactionScope.workspaceId)],
  );
};

export const acquireRoundingRuleReadLock = async (
  transactionScope: WorkspaceTransactionScope,
): Promise<void> => {
  await transactionScope.executeRawQuery(
    'SELECT pg_advisory_xact_lock_shared(hashtext($1))',
    [roundingRuleLockKey(transactionScope.workspaceId)],
  );
};
