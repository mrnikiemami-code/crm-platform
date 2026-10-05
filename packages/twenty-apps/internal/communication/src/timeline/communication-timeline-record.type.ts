// The persisted Communication fields the timeline card reads. Status is read
// from the record itself, so a card never keeps showing the creation-time
// QUEUED state after the outcome changed.

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

// How the card loads its data. Injected so the mapping is testable without the
// front-component sandbox.
export type CommunicationTimelineLoader = (
  communicationId: string,
) => Promise<CommunicationTimelineRecord>;

// Explicit load states. `UNAVAILABLE` is deliberately distinct from `LOADED`
// with a missing status: a record that could not be read must never be shown
// as QUEUED.
export type CommunicationTimelineLoadState =
  | { kind: 'LOADING' }
  | { kind: 'UNAVAILABLE'; reason: 'NOT_FOUND' | 'ERROR' }
  | { kind: 'LOADED'; record: CommunicationTimelineRecord };

export const readCommunicationTimelineRecordId = (
  linkedRecordId: unknown,
): string | null =>
  typeof linkedRecordId === 'string' && linkedRecordId.trim().length > 0
    ? linkedRecordId.trim()
    : null;

/**
 * Loads the linked Communication for one timeline activity. Missing or
 * inaccessible records resolve to `UNAVAILABLE`, never to a default status.
 */
export const loadCommunicationTimelineRecord = async ({
  linkedRecordId,
  loader,
}: {
  linkedRecordId: unknown;
  loader: CommunicationTimelineLoader;
}): Promise<CommunicationTimelineLoadState> => {
  const communicationId = readCommunicationTimelineRecordId(linkedRecordId);

  if (communicationId === null) {
    return { kind: 'UNAVAILABLE', reason: 'NOT_FOUND' };
  }

  try {
    const record = await loader(communicationId);

    if (record === null || record === undefined) {
      return { kind: 'UNAVAILABLE', reason: 'NOT_FOUND' };
    }

    return { kind: 'LOADED', record };
  } catch {
    // Never surface the transport error itself; the card only needs to know
    // that the data is unavailable.
    return { kind: 'UNAVAILABLE', reason: 'ERROR' };
  }
};
