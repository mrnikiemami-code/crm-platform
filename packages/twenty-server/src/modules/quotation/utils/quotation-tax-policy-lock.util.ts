import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';

// The one advisory lock that serializes "the tax rate" with "the document being
// priced". Both paths acquire it as their FIRST statement inside their transaction,
// before any row is read or written, so the order is fixed and cannot form a cycle:
//
//   - draft save ........ shared  (many drafts may price concurrently)
//   - policy mutation ... exclusive (one settings edit, and it waits for readers)
//
// A shared holder blocks the writer, so a policy row cannot change between the draft
// save's policy read and its commit. The writer never touches quotation rows, and the
// draft save only takes quotation row locks after this lock, so there is no
// lock-order inversion between the two.
const taxPolicyLockKey = (workspaceId: string): string =>
  `quotation-tax-policy:${workspaceId}`;

export const acquireTaxPolicyExclusiveLock = async (
  transactionScope: WorkspaceTransactionScope,
): Promise<void> => {
  await transactionScope.executeRawQuery(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [taxPolicyLockKey(transactionScope.workspaceId)],
  );
};

export const acquireTaxPolicyReadLock = async (
  transactionScope: WorkspaceTransactionScope,
): Promise<void> => {
  await transactionScope.executeRawQuery(
    'SELECT pg_advisory_xact_lock_shared(hashtext($1))',
    [taxPolicyLockKey(transactionScope.workspaceId)],
  );
};
