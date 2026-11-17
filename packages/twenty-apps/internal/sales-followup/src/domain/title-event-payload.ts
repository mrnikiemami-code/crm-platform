// Reading a database-event payload, and nothing else.
//
// Kept separate from the API calls so the parsing rules — which are where the
// subtle mistakes live — are testable without a server. The shape is the one the
// platform delivers to an app logic function: the event's `recordId` at the top
// level and the record snapshots under `properties`.
export type TitleEventPayload = {
  recordId?: unknown;
  properties?: {
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    updatedFields?: unknown;
  } | null;
};

const readRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const asBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

/** Fields of one interaction that the title decision needs, as they were. */
export type TitleRecordFields = {
  title: string | null;
  callAttempt: string | null;
  titleIsAuto: boolean | null;
};

/**
 * The interaction id this event is about, or null when the payload carries none.
 *
 * Null is a refusal, not a default: acting on "some" record would rewrite a title
 * that has nothing to do with the event.
 */
export const readEventRecordId = (payload: unknown): string | null => {
  const parsed = readRecord(payload) as TitleEventPayload | null;

  return asText(parsed?.recordId);
};

/**
 * The interaction snapshot from one side of the event.
 *
 * `after` for a create, `after` for an update too — an update's new state is what
 * the title should describe. `before` is read by the caller only when it needs to
 * know what the previous title was.
 */
export const readTitleRecordFields = (
  payload: unknown,
  side: 'before' | 'after',
): TitleRecordFields | null => {
  const parsed = readRecord(payload) as TitleEventPayload | null;
  const record = readRecord(parsed?.properties?.[side]);

  if (record === null) {
    return null;
  }

  return {
    title: asText(record['name']),
    callAttempt: asText(record['callAttempt']),
    titleIsAuto: asBoolean(record['titleIsAuto']),
  };
};

/** The relation ids the function needs to walk to the customer's name. */
export const readRelationIds = (
  payload: unknown,
  side: 'before' | 'after',
): { eventLeadId: string | null } => {
  const parsed = readRecord(payload) as TitleEventPayload | null;
  const record = readRecord(parsed?.properties?.[side]);

  return { eventLeadId: asText(record?.['eventLeadId']) };
};

/**
 * Whether this update actually touched something the title depends on.
 *
 * The trigger already filters on these fields; this is the second, cheap guard for
 * a payload that reaches the function for another reason. A change to ANY OTHER
 * field must not produce a title write, which is what kept `position` reorders
 * from rewriting titles.
 */
export const updatesWatchedField = (
  payload: unknown,
  watchedFields: readonly string[],
): boolean => {
  const parsed = readRecord(payload) as TitleEventPayload | null;
  const updatedFields = parsed?.properties?.updatedFields;

  if (!Array.isArray(updatedFields)) {
    return false;
  }

  return updatedFields.some(
    (field) => typeof field === 'string' && watchedFields.includes(field),
  );
};

/** The customer's name parts, from a person record. */
export const readCustomerName = (
  person: Record<string, unknown> | null,
): { firstName: string | null; lastName: string | null } => ({
  firstName: asText(person?.['nameFirstName']),
  lastName: asText(person?.['nameLastName']),
});
