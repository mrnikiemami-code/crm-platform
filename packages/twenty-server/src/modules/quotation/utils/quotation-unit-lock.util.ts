import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';

// Lock order after tax and currency (Goal 040 U01). Same advisory pattern as currency.
const unitCatalogLockKey = (workspaceId: string): string =>
  `quotation-unit-catalog:${workspaceId}`;

export const acquireQuotationUnitCatalogExclusiveLock = async (
  transactionScope: WorkspaceTransactionScope,
): Promise<void> => {
  await transactionScope.executeRawQuery(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [unitCatalogLockKey(transactionScope.workspaceId)],
  );
};

export const acquireQuotationUnitCatalogReadLock = async (
  transactionScope: WorkspaceTransactionScope,
): Promise<void> => {
  await transactionScope.executeRawQuery(
    'SELECT pg_advisory_xact_lock_shared(hashtext($1))',
    [unitCatalogLockKey(transactionScope.workspaceId)],
  );
};