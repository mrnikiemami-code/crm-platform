// Presentation mapping for the Communication timeline card.
//
// Pure and deterministic so the truthfulness rules are testable without the
// front-component sandbox. Status comes from the record loaded at render time,
// never from the activity's creation-time snapshot, so a card cannot keep
// showing QUEUED after the outcome changed.

import {
  type CommunicationTimelineLoadState,
  type CommunicationTimelineRecord,
  type CommunicationTimelineUnavailableReason,
} from 'src/timeline/communication-timeline-record.type';

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
  | { kind: 'UNAVAILABLE'; reason: CommunicationTimelineUnavailableReason }
  | ({ kind: 'READY' } & CommunicationTimelinePresentation);

const BODY_PREVIEW_MAX_LENGTH = 140;

// Localizable copy. The component passes these through `t()`; they are kept
// here so the mapping stays pure and testable.
export const LOADING_TITLE = 'Loading communication…';
export const UNAVAILABLE_TITLE = 'Communication unavailable';
export const REFRESH_LABEL = 'Refresh';

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
 * Maps a load state to what the card renders. A missing or inaccessible
 * activity or record is reported as unavailable — never as QUEUED, and never
 * as success. The reason is carried through so the component can localize a
 * specific message.
 */
export const buildCommunicationTimelineView = (
  state: CommunicationTimelineLoadState,
): CommunicationTimelineView => {
  if (state.kind === 'LOADING') {
    return { kind: 'LOADING' };
  }

  if (state.kind === 'UNAVAILABLE') {
    return { kind: 'UNAVAILABLE', reason: state.reason };
  }

  return {
    kind: 'READY',
    ...buildCommunicationTimelinePresentation(state.record),
  };
};
