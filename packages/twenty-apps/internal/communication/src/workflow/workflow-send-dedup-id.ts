import { createHash } from 'node:crypto';

// Identity of ONE real change to ONE record, for ONE template.
//
// The workflow may be re-run for the same event: a step retry, a manual replay,
// or a duplicate queue delivery. The key is therefore derived from the
// OBSERVABLE CHANGE, not from the run id — a run id differs on every replay and
// would defeat the purpose.
//
// A→B→A produces two keys (A→B and B→A) rather than one, because the before and
// after values are both part of the identity. That is deliberate: a distinct
// real change is a distinct event.
export type WorkflowSendEvent = {
  workflowId: string;
  /** The object whose record changed. */
  sourceObjectName: string;
  sourceRecordId: string;
  /** The watched column; empty when the workflow watches the whole object. */
  fieldName: string;
  /** Values rendered as text so the key is stable across types. */
  before: string;
  after: string;
  templateId: string;
};

const stableValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    // A composite (e.g. FULL_NAME, CURRENCY) is serialised by its own
    // properties in a fixed order, so two structurally equal values can never
    // produce different keys.
    return JSON.stringify(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, (value as Record<string, unknown>)[key]]),
    );
  }

  return String(value);
};

export const buildWorkflowSendEventPart = (value: unknown): string =>
  stableValue(value);

/**
 * Deterministic, UUID-shaped id used BOTH as the deduplication key and as the
 * primary key of the `communication` row this event may create.
 *
 * Using the record id as the mutex means the database's own primary-key
 * uniqueness is the arbiter: two concurrent attempts cannot both create the
 * row, so no advisory lock and no extra column are needed. UUID shape keeps it
 * accepted by a `uuid` typed primary key.
 */
export const buildWorkflowSendDedupId = (event: WorkflowSendEvent): string => {
  // JSON.stringify of the array, not a delimiter join: a value that itself
  // contains the delimiter would otherwise let two different changes produce
  // the same key, which would silently suppress a legitimate send.
  const payload = JSON.stringify([
    'workflow-sms-v1',
    event.workflowId,
    event.sourceObjectName,
    event.sourceRecordId,
    event.fieldName,
    stableValue(event.before),
    stableValue(event.after),
    event.templateId,
  ]);

  const hex = createHash('sha256').update(payload, 'utf8').digest('hex');

  // Version/variant nibbles are set so the value is a well-formed UUID.
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
