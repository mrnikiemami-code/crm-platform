import { createHash } from 'node:crypto';

// Identity of ONE real change, for ONE template.
//
// Two things must hold at once, and they pull in opposite directions:
//  - a replay of the SAME event (queue retry, duplicate delivery, manual
//    workflow replay) must not send a second message;
//  - a genuinely NEW change must send, even when it returns a column to a value
//    it already had (A→B→A).
//
// A key built only from values cannot do both: A→B and a later A→B are
// indistinguishable. So the identity of the WRITE (`eventId`, stamped once when
// the event is created) is the primary input. Values stay in the key as a
// defensive fallback for payloads that predate `eventId`.
export type WorkflowSendEvent = {
  /** Stable identity of the write. Empty only for legacy payloads. */
  eventId?: string;
  /** Empty when the caller could not supply it; see the note on collisions. */
  workflowId?: string;
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
 *
 * `workflowId` participates when supplied, so two workflows watching the same
 * column with the same template stay independent. When it cannot be supplied,
 * the same event + template reaching two workflows produces one message rather
 * than two — a deliberate bias toward not double-charging a customer.
 */
export const buildWorkflowSendDedupId = (event: WorkflowSendEvent): string => {
  const hasEventId = (event.eventId ?? '').length > 0;

  // JSON.stringify of the array, not a delimiter join: a value that itself
  // contains the delimiter would otherwise let two different changes produce
  // the same key, which would silently suppress a legitimate send.
  const payload = JSON.stringify([
    // Bumping the prefix would orphan every id already written, so it only
    // changes if the identity semantics themselves change.
    'workflow-sms-v2',
    // The write identity is the discriminator; the rest only narrows it.
    hasEventId
      ? event.eventId
      : ['no-event-id', stableValue(event.before), stableValue(event.after)],
    event.workflowId ?? '',
    event.sourceObjectName,
    event.sourceRecordId,
    event.fieldName,
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
