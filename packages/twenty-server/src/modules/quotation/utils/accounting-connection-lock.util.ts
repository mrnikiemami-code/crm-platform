import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';

// Serializes "exactly one workspace default destination" mutations. Clearing the previous
// default and setting the next are two statements; without this lock two concurrent
// set-default requests can interleave and leave two defaults behind.
const accountingConnectionLockKey = (workspaceId: string): string =>
  `quotation-accounting-connection:${workspaceId}`;

export const acquireAccountingConnectionExclusiveLock = async (
  transactionScope: WorkspaceTransactionScope,
): Promise<void> => {
  await transactionScope.executeRawQuery(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [accountingConnectionLockKey(transactionScope.workspaceId)],
  );
};

// New work that can write records holds a shared lock until its private function and
// any in-process apply finish. Settings saves and retirement take the exclusive side.
// Independent operations may proceed together; this is not their idempotency claim.
export const acquireAccountingConnectionWorkLock = async (
  transactionScope: WorkspaceTransactionScope,
): Promise<void> => {
  await transactionScope.executeRawQuery(
    'SELECT pg_advisory_xact_lock_shared(hashtext($1))',
    [accountingConnectionLockKey(transactionScope.workspaceId)],
  );
};
