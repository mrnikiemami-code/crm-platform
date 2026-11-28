import { createHash } from 'node:crypto';

// The persistent ledger of every write the CRM attempts against an accounting
// package.
//
// WHY THIS IS A RECORD AND NOT A QUEUE JOB: Twenty's logic-function queue retries a
// bounded number of times and then DISCARDS the failure (only a log line remains),
// and there is no dead-letter store. An accounting push that fails for good would
// therefore vanish. This record is the durable trace: it outlives the job, it holds
// the attempts, and a reconciliation pass can pick up anything left `FAILED_FINAL`
// or `MANUAL_EXPORT_REQUIRED`.
export const ACCOUNTING_OPERATION_KINDS = [
  'CATALOG_ITEM_CREATE',
  'CATALOG_ITEM_UPDATE',
  'CATALOG_ITEM_DEACTIVATE',
  'QUOTATION_REVISION_PUSH',
  'PARTY_CREATE',
  'PARTY_UPDATE',
] as const;

export type AccountingOperationKind = (typeof ACCOUNTING_OPERATION_KINDS)[number];

export const ACCOUNTING_OPERATION_STATES = [
  'PENDING',
  'IN_FLIGHT',
  'SUCCEEDED',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
  'MANUAL_EXPORT_REQUIRED',
  'CANCELLED',
] as const;

export type AccountingOperationState =
  (typeof ACCOUNTING_OPERATION_STATES)[number];

export type AccountingSyncOperation = {
  // Deterministic id, see below.
  id: string;
  connectionId: string;
  kind: AccountingOperationKind;
  // The CRM-side record this operation writes about.
  internalEntityId: string;
  // An immutable quotation revision or an item version; null for an item create.
  internalRevision: number | null;
  state: AccountingOperationState;
  attempts: number;
  externalDocumentId: string | null;
  externalStatus: string | null;
  errorCode: string | null;
  // Ties an outbound write to the inbound event it may cause, so the app can tell
  // its own echo from a real change.
  correlationId: string;
  createdAt: string;
  updatedAt: string;
};

// Identity of ONE intended real write, used BOTH as the deduplication key and as the
// operation's primary key. Making the deterministic id the primary key means the
// database's own uniqueness is the mutex: two concurrent attempts cannot both insert,
// so no advisory lock and no extra unique column are needed. This is the same
// technique the Communication app uses for SMS deduplication, chosen for the same
// reason — an accounting push is money, and a duplicate is not recoverable by an
// apology.
export type AccountingOperationIdentity = {
  connectionId: string;
  kind: AccountingOperationKind;
  internalEntityId: string;
  internalRevision: number | null;
};

const VERSION_PREFIX = 'accounting-op-v1';

export const buildAccountingOperationId = (
  identity: AccountingOperationIdentity,
): string => {
  // JSON.stringify of an array, not a delimiter join: an id that itself contained the
  // delimiter would let two different operations produce the same key, and the second
  // one would be silently suppressed.
  const payload = JSON.stringify([
    VERSION_PREFIX,
    identity.connectionId,
    identity.kind,
    identity.internalEntityId,
    identity.internalRevision,
  ]);

  const hex = createHash('sha256').update(payload, 'utf8').digest('hex');

  // Version and variant nibbles are set so the value is a well-formed UUID, which
  // keeps it acceptable to a uuid-typed primary key.
  const version = '5';
  const variant = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `${version}${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
};

// A revision is part of the identity: pushing revision 2 twice must reuse one
// operation, while pushing revision 3 must be a NEW operation. For an item with no
// revision, the item's own updatedAt version takes its place at the call site.
export const isTerminalOperationState = (
  state: AccountingOperationState,
): boolean =>
  state === 'SUCCEEDED' ||
  state === 'FAILED_FINAL' ||
  state === 'MANUAL_EXPORT_REQUIRED' ||
  state === 'CANCELLED';

export const canRetryOperation = (
  operation: Pick<AccountingSyncOperation, 'state' | 'attempts'>,
  maxAttempts: number,
): boolean =>
  operation.state === 'FAILED_RETRYABLE' && operation.attempts < maxAttempts;

// Echo suppression. The accounting package may report the item back as changed
// because WE changed it. Comparing the inbound event's correlation with the
// correlation of a recent outbound operation for the same entity distinguishes that
// echo from a real edit, and prevents a push/import loop where each side keeps
// "correcting" the other.
export const isEchoOfOwnWrite = ({
  inboundCorrelationId,
  outboundOperations,
}: {
  inboundCorrelationId: string | null;
  outboundOperations: Pick<AccountingSyncOperation, 'correlationId'>[];
}): boolean => {
  if (inboundCorrelationId === null || inboundCorrelationId === '') {
    return false;
  }

  return outboundOperations.some(
    (operation) => operation.correlationId === inboundCorrelationId,
  );
};
