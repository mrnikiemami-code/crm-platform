// The persisted Communication fields the timeline card renders. Status is read
// from the record at render time, so a card never keeps showing the
// creation-time QUEUED state after the outcome changed.

export type CommunicationTimelineRecord = {
  id?: string | null;
  channel?: string | null;
  status?: string | null;
  recipient?: string | null;
  providerId?: string | null;
  body?: string | null;
  subject?: string | null;
  providerMessageId?: string | null;
  failureReason?: string | null;
  targetPersonId?: string | null;
};

// The timeline activity row, as read through the workspace REST API. The host
// only injects `timelineActivityId`, so the activity itself must be loaded to
// discover which record it links to.
export type CommunicationTimelineActivity = {
  id?: string | null;
  linkedRecordId?: string | null;
  linkedObjectMetadataId?: string | null;
};

export type CommunicationTimelineUnavailableReason =
  | 'NO_ACTIVITY_ID'
  | 'ACTIVITY_NOT_FOUND'
  | 'NO_LINKED_RECORD'
  | 'LINKED_RECORD_NOT_COMMUNICATION'
  | 'ERROR';

// Explicit load states. `UNAVAILABLE` is deliberately distinct from `LOADED`
// with a missing status: a record that could not be read must never be shown
// as QUEUED.
export type CommunicationTimelineLoadState =
  | { kind: 'LOADING' }
  | { kind: 'UNAVAILABLE'; reason: CommunicationTimelineUnavailableReason }
  | { kind: 'LOADED'; record: CommunicationTimelineRecord };

/**
 * Data access used by the loader chain. Injected so the chain is testable
 * without the front-component sandbox or a workspace.
 *
 * Both functions are read-only. `loadCommunication` returns `null` when the
 * response does not actually carry a communication, which is how a linked
 * record belonging to another object is rejected.
 */
export type CommunicationTimelineSource = {
  loadActivity: (
    timelineActivityId: string,
  ) => Promise<CommunicationTimelineActivity | null>;
  loadCommunication: (
    communicationId: string,
  ) => Promise<CommunicationTimelineRecord | null>;
};

const readNonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

export const readTimelineActivityId = (value: unknown): string | null =>
  readNonEmpty(value);

/**
 * Resolves the timeline activity, follows its linked record, and validates
 * that the linked record really is a Communication before returning it.
 *
 * The chain is: `timelineActivityId` → activity → linked Communication →
 * presentation. `recordId` from the renderer context is deliberately never
 * used: for a timeline renderer it is null and does not identify the linked
 * record.
 */
export const loadCommunicationTimelineState = async ({
  timelineActivityId,
  source,
}: {
  timelineActivityId: unknown;
  source: CommunicationTimelineSource;
}): Promise<CommunicationTimelineLoadState> => {
  const activityId = readTimelineActivityId(timelineActivityId);

  if (activityId === null) {
    return { kind: 'UNAVAILABLE', reason: 'NO_ACTIVITY_ID' };
  }

  try {
    const activity = await source.loadActivity(activityId);

    if (activity === null) {
      return { kind: 'UNAVAILABLE', reason: 'ACTIVITY_NOT_FOUND' };
    }

    const linkedRecordId = readNonEmpty(activity.linkedRecordId);

    if (linkedRecordId === null) {
      return { kind: 'UNAVAILABLE', reason: 'NO_LINKED_RECORD' };
    }

    const record = await source.loadCommunication(linkedRecordId);

    // A missing payload means the id did not resolve to a Communication, so
    // the link is not one this card can render.
    if (record === null) {
      return {
        kind: 'UNAVAILABLE',
        reason: 'LINKED_RECORD_NOT_COMMUNICATION',
      };
    }

    return { kind: 'LOADED', record };
  } catch {
    // Never surface the transport error itself; the card only needs to know
    // that the data is unavailable.
    return { kind: 'UNAVAILABLE', reason: 'ERROR' };
  }
};
