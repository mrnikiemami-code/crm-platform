import { describe, expect, it } from 'vitest';

import { buildCommunicationTimelinePresentation } from 'src/timeline/communication-timeline-presentation';

const baseProperties = {
  channel: 'SMS',
  recipient: '09120000000',
  providerId: 'razpayamak',
  body: 'hello there',
};

describe('buildCommunicationTimelinePresentation', () => {
  describe('status truthfulness', () => {
    it('never claims a queued message was sent', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseProperties,
        status: 'QUEUED',
      });

      expect(presentation.isPending).toBe(true);
      expect(presentation.title).toContain('queued');
      expect(presentation.title).not.toContain('sent');
      expect(presentation.title).not.toContain('delivered');
      expect(presentation.isDelivered).toBe(false);
    });

    it('never claims a sent message was delivered', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseProperties,
        status: 'SENT',
      });

      expect(presentation.title).toContain('sent');
      expect(presentation.title).not.toContain('delivered');
      expect(presentation.isDelivered).toBe(false);
      expect(presentation.isPending).toBe(false);
    });

    it('only reports delivered when the persisted status is DELIVERED', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseProperties,
        status: 'DELIVERED',
      });

      expect(presentation.title).toContain('delivered');
      expect(presentation.isDelivered).toBe(true);
      expect(presentation.isPending).toBe(false);
    });

    it('reflects a stored failure and exposes its reason', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseProperties,
        status: 'FAILED',
        failureReason: 'Invalid receptor',
      });

      expect(presentation.title).toContain('failed');
      expect(presentation.isFailed).toBe(true);
      expect(presentation.failureReason).toBe('Invalid receptor');
    });

    it('treats a missing status as pending, never as success', () => {
      const presentation = buildCommunicationTimelinePresentation(baseProperties);

      expect(presentation.isPending).toBe(true);
      expect(presentation.title).not.toContain('sent');
      expect(presentation.title).not.toContain('delivered');
    });

    it('hides the failure reason unless the record actually failed', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseProperties,
        status: 'SENT',
        failureReason: 'should not be shown',
      });

      expect(presentation.failureReason).toBeNull();
    });
  });

  describe('snapshot usage', () => {
    it('uses the persisted recipient and provider, not current values', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseProperties,
        status: 'SENT',
        recipient: '09351112233',
        providerId: 'kavenegar',
      });

      expect(presentation.recipient).toBe('09351112233');
      expect(presentation.providerId).toBe('kavenegar');
    });

    it('summarizes the channel alongside the outcome', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseProperties,
        status: 'SENT',
      });

      expect(presentation.title).toBe('Message sent · SMS');
    });

    it('truncates a long body instead of dumping it', () => {
      const presentation = buildCommunicationTimelinePresentation({
        ...baseProperties,
        status: 'SENT',
        body: 'x'.repeat(500),
      });

      expect(presentation.bodyPreview).not.toBeNull();
      expect(presentation.bodyPreview?.length).toBeLessThanOrEqual(140);
      expect(presentation.bodyPreview?.endsWith('…')).toBe(true);
    });
  });

  describe('defensive handling', () => {
    it('handles a missing properties payload', () => {
      const presentation = buildCommunicationTimelinePresentation(null);

      expect(presentation.isPending).toBe(true);
      expect(presentation.recipient).toBeNull();
      expect(presentation.providerId).toBeNull();
      expect(presentation.failureReason).toBeNull();
    });

    it('ignores blank snapshot values', () => {
      const presentation = buildCommunicationTimelinePresentation({
        channel: '   ',
        status: 'SENT',
        recipient: '',
        providerId: '  ',
        body: '   ',
      });

      expect(presentation.recipient).toBeNull();
      expect(presentation.providerId).toBeNull();
      expect(presentation.bodyPreview).toBeNull();
      expect(presentation.title).toBe('Message sent');
    });
  });
});
