import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';

// Serializes currency-catalog mutations with draft saves that will read currency
// accounting codes (WS2). Same fixed-first-statement pattern as TAX-008 so lock
// order cannot invert (Q-LOCK-2 dual keys).
const currencyCatalogLockKey = (workspaceId: string): string =>
  `quotation-currency-catalog:${workspaceId}`;

export const acquireCurrencyCatalogExclusiveLock = async (
  transactionScope: WorkspaceTransactionScope,
): Promise<void> => {
  await transactionScope.executeRawQuery(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [currencyCatalogLockKey(transactionScope.workspaceId)],
  );
};

export const acquireCurrencyCatalogReadLock = async (
  transactionScope: WorkspaceTransactionScope,
): Promise<void> => {
  await transactionScope.executeRawQuery(
    'SELECT pg_advisory_xact_lock_shared(hashtext($1))',
    [currencyCatalogLockKey(transactionScope.workspaceId)],
  );
};
