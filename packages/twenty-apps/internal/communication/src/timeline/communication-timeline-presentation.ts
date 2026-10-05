// Presentation mapping for the Communication timeline card.
//
// It is deliberately a pure function so the truthfulness rules can be tested
// without the front-component sandbox. It never claims more than the persisted
// record says, and it never surfaces credentials or raw diagnostics.

export type CommunicationTimelineStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED';

export type CommunicationTimelineProperties = {
  channel?: string | null;
  status?: string | null;
  recipient?: string | null;
  providerId?: string | null;
  body?: string | null;
  subject?: string | null;
  providerMessageId?: string | null;
  failureReason?: string | null;
};

export type CommunicationTimelinePresentation = {
  /** Short, human-readable summary of what happened. */
  title: string;
  /** Destination, from the persisted snapshot (never the current Person). */
  recipient: string | null;
  /** Provider that actually handled this send, from the snapshot. */
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

const BODY_PREVIEW_MAX_LENGTH = 140;

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
  properties: CommunicationTimelineProperties | null | undefined,
): CommunicationTimelinePresentation => {
  const status = readNonEmpty(properties?.status);
  const channel = readNonEmpty(properties?.channel);

  const title = buildTitle(status);
  const isDelivered = status === 'DELIVERED';
  const isFailed = status === 'FAILED';

  return {
    title: channel === null ? title : `${title} · ${channel}`,
    recipient: readNonEmpty(properties?.recipient),
    providerId: readNonEmpty(properties?.providerId),
    bodyPreview: buildBodyPreview(readNonEmpty(properties?.body)),
    isPending: status === 'QUEUED' || status === null,
    isDelivered,
    isFailed,
    // Only a failed record exposes a reason, and never anything else.
    failureReason: isFailed ? readNonEmpty(properties?.failureReason) : null,
  };
};
