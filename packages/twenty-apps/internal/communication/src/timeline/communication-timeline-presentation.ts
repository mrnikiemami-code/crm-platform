// Presentation mapping for the Communication timeline card.
//
// Pure and deterministic so the truthfulness rules are testable without the
// front-component sandbox. Status comes from the record loaded at render time,
// never from the activity's creation-time snapshot, so a card cannot keep
// showing QUEUED after the outcome changed.

import {
  type CommunicationTimelineLoadState,
  type CommunicationTimelineRecord,
} from 'src/timeline/communication-timeline-record.type';

export type CommunicationTimelineStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED';

export type CommunicationTimelinePresentation = {
  /** Short, human-readable summary of what happened. */
  title: string;
  /** Destination, from the persisted record (never the current Person). */
  recipient: string | null;
  /** Provider that actually handled this send, from the record. */
  providerId: string | null;
  /** Message excerpt, when the record kept one. */
  bodyPreview: string | null;
  /** True when the outcome is not yet final and must not read as success. */
  isPending: boolean;
  /** True only when the persisted status is DELIVERED. */
  isDelivered: boolean;
  /** True only when the persisted status is FAILED. */
  isFailed: boolean;
  /** Stored failure text, shown only for a failed record. */
  failureReason: string | null;
};

export type CommunicationTimelineView =
  | { kind: 'LOADING' }
  | { kind: 'UNAVAILABLE'; title: string }
  | ({ kind: 'READY' } & CommunicationTimelinePresentation);

const BODY_PREVIEW_MAX_LENGTH = 140;

const LOADING_TITLE = 'Loading communication…';
const UNAVAILABLE_TITLE = 'Communication unavailable';

const readNonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const buildBodyPreview = (body: string | null): string | null => {
  if (body === null) {
    return null;
  }

  return body.length <= BODY_PREVIEW_MAX_LENGTH
    ? body
    : `${body.slice(0, BODY_PREVIEW_MAX_LENGTH - 1)}…`;
};

// Truthful status wording. QUEUED is explicitly uncertain: it must never read
// as sent, and SENT must never read as delivered.
const buildTitle = (status: string | null): string => {
  switch (status) {
    case 'DELIVERED':
      return 'Message delivered';
    case 'SENT':
      return 'Message sent';
    case 'FAILED':
      return 'Message failed';
    case 'QUEUED':
      return 'Message queued';
    default:
      return 'Message';
  }
};

export const buildCommunicationTimelinePresentation = (
  record: CommunicationTimelineRecord | null | undefined,
): CommunicationTimelinePresentation => {
  const status = readNonEmpty(record?.status);
  const channel = readNonEmpty(record?.channel);

  const title = buildTitle(status);
  const isFailed = status === 'FAILED';

  return {
    title: channel === null ? title : `${title} · ${channel}`,
    recipient: readNonEmpty(record?.recipient),
    providerId: readNonEmpty(record?.providerId),
    bodyPreview: buildBodyPreview(readNonEmpty(record?.body)),
    isPending: status === 'QUEUED' || status === null,
    isDelivered: status === 'DELIVERED',
    isFailed,
    // Only a failed record exposes a reason, and never anything else.
    failureReason: isFailed ? readNonEmpty(record?.failureReason) : null,
  };
};

/**
 * Maps a load state to what the card renders. A missing or inaccessible record
 * is reported as unavailable — never as QUEUED, and never as success.
 */
export const buildCommunicationTimelineView = (
  state: CommunicationTimelineLoadState,
): CommunicationTimelineView => {
  if (state.kind === 'LOADING') {
    return { kind: 'LOADING' };
  }

  if (state.kind === 'UNAVAILABLE') {
    return { kind: 'UNAVAILABLE', title: UNAVAILABLE_TITLE };
  }

  return {
    kind: 'READY',
    ...buildCommunicationTimelinePresentation(state.record),
  };
};

export { LOADING_TITLE, UNAVAILABLE_TITLE };
