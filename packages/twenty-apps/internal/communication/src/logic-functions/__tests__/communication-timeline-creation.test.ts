import { describe, expect, it } from 'vitest';

import { COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { buildCommunicationTimelineActivityInput } from 'src/timeline/build-communication-timeline-activity-input';

const PERSON_UNIVERSAL_IDENTIFIER = '20202020-e674-48e5-a542-72570eee7213';

const RECORD = {
  id: 'communication-1',
  channel: 'SMS',
  status: 'QUEUED',
  recipient: '09120000000',
  providerId: 'razpayamak',
  body: 'hello',
  subject: null,
  providerMessageId: null,
  failureReason: null,
  targetPersonId: 'person-1',
};

describe('buildCommunicationTimelineActivityInput', () => {
  it('links the activity to the person and to the persisted communication', () => {
    const input = buildCommunicationTimelineActivityInput(RECORD);

    expect(input).toMatchObject({
      targetObjectUniversalIdentifier: PERSON_UNIVERSAL_IDENTIFIER,
      targetRecordId: 'person-1',
      linkedObjectMetadataUniversalIdentifier:
        COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
      linkedRecordId: 'communication-1',
    });
  });

  it('snapshots the send-time values onto the activity', () => {
    const input = buildCommunicationTimelineActivityInput({
      ...RECORD,
      status: 'SENT',
      recipient: '09351112233',
      providerId: 'kavenegar',
    });

    expect(input).not.toBeNull();
    expect(input?.properties).toMatchObject({
      channel: 'SMS',
      status: 'SENT',
      recipient: '09351112233',
      providerId: 'kavenegar',
    });
  });

  it('returns null when the communication has no target person', () => {
    expect(
      buildCommunicationTimelineActivityInput({
        ...RECORD,
        targetPersonId: null,
      }),
    ).toBeNull();
  });

  it('normalizes blank optional values to null rather than empty strings', () => {
    const input = buildCommunicationTimelineActivityInput({
      ...RECORD,
      subject: '   ',
      failureReason: '',
    });

    const properties = (input?.properties ?? {}) as Record<string, unknown>;

    expect(properties.subject).toBeNull();
    expect(properties.failureReason).toBeNull();
  });

  it('keeps one activity per communication (creation only)', () => {
    // The builder is a pure function of one creation event: calling it again
    // for the same record yields the same single activity input, and nothing
    // here reacts to status updates.
    const first = buildCommunicationTimelineActivityInput(RECORD);
    const second = buildCommunicationTimelineActivityInput({
      ...RECORD,
      status: 'DELIVERED',
    });

    expect(first?.linkedRecordId).toBe('communication-1');
    expect(second?.linkedRecordId).toBe('communication-1');
    // A status change only alters the snapshot, never creates a second target.
    expect(first?.targetRecordId).toBe(second?.targetRecordId);
  });

  it('never copies credentials or diagnostics into the activity', () => {
    const input = buildCommunicationTimelineActivityInput(RECORD);

    const serialized = JSON.stringify(input);

    for (const forbidden of ['apiKey', 'password', 'token', 'endpoint']) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
