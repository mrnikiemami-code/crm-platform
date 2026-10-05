import { describe, expect, it } from 'vitest';

import { type CommunicationTimelineRecord } from 'src/timeline/communication-timeline-record.type';
import {
  buildCommunicationTimelinePresentation,
  buildCommunicationTimelineView,
} from 'src/timeline/communication-timeline-presentation';

const baseRecord: CommunicationTimelineRecord = {
  channel: 'SMS',
  recipient: '09120000000',
  providerId: 'razpayamak',
  body: 'hello there',
};

describe('buildCommunicationTimelinePresentation', () => {
  describe('status truthfulness', () => {
    it('never claims a queued message was sent', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseRecord,
        status: 'QUEUED',
      });

      expect(presentation.isPending).toBe(true);
      expect(presentation.title).toContain('queued');
      expect(presentation.title).not.toContain('sent');
      expect(presentation.title).not.toContain('delivered');
    });

    it('never claims a sent message was delivered', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseRecord,
        status: 'SENT',
      });

      expect(presentation.title).toContain('sent');
      expect(presentation.title).not.toContain('delivered');
      expect(presentation.isDelivered).toBe(false);
      expect(presentation.isPending).toBe(false);
    });

    it('only reports delivered when the persisted status is DELIVERED', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseRecord,
        status: 'DELIVERED',
      });

      expect(presentation.title).toContain('delivered');
      expect(presentation.isDelivered).toBe(true);
      expect(presentation.isPending).toBe(false);
    });

    it('reflects a stored failure and exposes its reason', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseRecord,
        status: 'FAILED',
        failureReason: 'Invalid receptor',
      });

      expect(presentation.title).toContain('failed');
      expect(presentation.isFailed).toBe(true);
      expect(presentation.failureReason).toBe('Invalid receptor');
    });

    it('hides the failure reason unless the record actually failed', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseRecord,
        status: 'SENT',
        failureReason: 'should not be shown',
      });

      expect(presentation.failureReason).toBeNull();
    });
  });

  describe('status refresh (same activity, updated record)', () => {
    it('shows the refreshed outcome instead of the creation-time QUEUED state', () => {
      // The same activity is rendered against the record as it is now.
      const queued = buildCommunicationTimelinePresentation({
        ...baseRecord,
        status: 'QUEUED',
      });
      const delivered = buildCommunicationTimelinePresentation({
        ...baseRecord,
        status: 'DELIVERED',
      });

      expect(queued.title).toContain('queued');
      expect(delivered.title).toContain('delivered');
      expect(delivered.isPending).toBe(false);
    });

    it('shows a later failure instead of a stale queued state', () => {
      const failed = buildCommunicationTimelinePresentation({
        ...baseRecord,
        status: 'FAILED',
        failureReason: 'Rejected',
      });

      expect(failed.isPending).toBe(false);
      expect(failed.isFailed).toBe(true);
      expect(failed.title).not.toContain('queued');
    });
  });

  describe('snapshot usage', () => {
    it('uses the persisted recipient and provider', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseRecord,
        status: 'SENT',
        recipient: '09351112233',
        providerId: 'kavenegar',
      });

      expect(presentation.recipient).toBe('09351112233');
      expect(presentation.providerId).toBe('kavenegar');
    });

    it('summarizes the channel alongside the outcome', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseRecord,
        status: 'SENT',
      });

      expect(presentation.title).toBe('Message sent · SMS');
    });

    it('truncates a long body instead of dumping it', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseRecord,
        status: 'SENT',
        body: 'x'.repeat(500),
      });

      expect(presentation.bodyPreview?.length).toBeLessThanOrEqual(140);
      expect(presentation.bodyPreview?.endsWith('…')).toBe(true);
    });
  });
});

describe('buildCommunicationTimelineView', () => {
  it('reports loading explicitly', () => {
    expect(buildCommunicationTimelineView({ kind: 'LOADING' })).toEqual({
      kind: 'LOADING',
    });
  });

  it('reports an inaccessible record as unavailable, never as queued', () => {
    const view = buildCommunicationTimelineView({
      kind: 'UNAVAILABLE',
      reason: 'ACTIVITY_NOT_FOUND',
    });

    expect(view).toEqual({
      kind: 'UNAVAILABLE',
      reason: 'ACTIVITY_NOT_FOUND',
    });
    expect(JSON.stringify(view).toLowerCase()).not.toContain('queued');
    expect(JSON.stringify(view).toLowerCase()).not.toContain('sent');
  });

  it('carries the specific unavailable reason through for localization', () => {
    for (const reason of [
      'NO_ACTIVITY_ID',
      'ACTIVITY_NOT_FOUND',
      'NO_LINKED_RECORD',
      'LINKED_RECORD_NOT_COMMUNICATION',
      'ERROR',
    ] as const) {
      expect(buildCommunicationTimelineView({ kind: 'UNAVAILABLE', reason })).toEqual(
        { kind: 'UNAVAILABLE', reason },
      );
    }
  });

  it('renders a loaded record with its current status', () => {
    const view = buildCommunicationTimelineView({
      kind: 'LOADED',
      record: { ...baseRecord, status: 'SENT' },
    });

    expect(view.kind).toBe('READY');
    expect(view.kind === 'READY' && view.title).toBe('Message sent · SMS');
  });
});
