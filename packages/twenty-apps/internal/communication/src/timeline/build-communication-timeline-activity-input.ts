import { type CreateTimelineActivityInput } from 'twenty-sdk/logic-function';

import {
  COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Standard Person object universal identifier.
const PERSON_OBJECT_UNIVERSAL_IDENTIFIER =
  '20202020-e674-48e5-a542-72570eee7213';

export type CommunicationRecordForTimeline = {
  id: string;
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

const readNonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

/**
 * Builds the native `createTimelineActivity` input for one persisted
 * Communication. Pure and deterministic so the mapping can be tested without a
 * workspace.
 *
 * Only send-time snapshot fields are copied: the current Person phone and the
 * currently configured provider are never consulted, and no credential or raw
 * diagnostic ever reaches the activity.
 *
 * Returns `null` when the communication has no target person, because such a
 * record does not belong to anyone's timeline.
 */
export const buildCommunicationTimelineActivityInput = (
  record: CommunicationRecordForTimeline,
): CreateTimelineActivityInput | null => {
  const targetPersonId = readNonEmpty(record.targetPersonId);

  if (targetPersonId === null) {
    return null;
  }

  return {
    timelineActivityTypeUniversalIdentifier:
      COMMUNICATION_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
    targetObjectUniversalIdentifier: PERSON_OBJECT_UNIVERSAL_IDENTIFIER,
    targetRecordId: targetPersonId,
    linkedObjectMetadataUniversalIdentifier:
      COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
    linkedRecordId: record.id,
    properties: {
      channel: readNonEmpty(record.channel),
      status: readNonEmpty(record.status),
      recipient: readNonEmpty(record.recipient),
      providerId: readNonEmpty(record.providerId),
      body: readNonEmpty(record.body),
      subject: readNonEmpty(record.subject),
      providerMessageId: readNonEmpty(record.providerMessageId),
      failureReason: readNonEmpty(record.failureReason),
    },
  };
};
