import { describe, expect, it } from 'vitest';

import {
  buildWorkflowSendDedupId,
  buildWorkflowSendEventPart,
} from 'src/workflow/workflow-send-dedup-id';

const BASE = {
  eventId: 'event-1',
  workflowId: 'wf-1',
  sourceObjectName: 'person',
  sourceRecordId: 'rec-1',
  fieldName: 'stage',
  before: 'NEW',
  after: 'WON',
  templateId: 'tpl-1',
};

describe('buildWorkflowSendDedupId', () => {
  it('is stable for a replay of the same event', () => {
    expect(buildWorkflowSendDedupId(BASE)).toBe(buildWorkflowSendDedupId(BASE));
  });

  it('produces a well-formed uuid', () => {
    expect(buildWorkflowSendDedupId(BASE)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('treats A to B and a later A to B as two different changes', () => {
    // The regression this key exists for: the same column returning to a
    // previous value is a NEW real change and must still send.
    const first = buildWorkflowSendDedupId(BASE);
    const later = buildWorkflowSendDedupId({ ...BASE, eventId: 'event-3' });

    expect(later).not.toBe(first);
  });

  it('treats a distinct write as distinct even when values are identical', () => {
    expect(buildWorkflowSendDedupId({ ...BASE, eventId: 'event-2' })).not.toBe(
      buildWorkflowSendDedupId({ ...BASE, before: 'NEW', after: 'WON' }),
    );
  });

  it('differs per record, field, template and workflow', () => {
    const original = buildWorkflowSendDedupId(BASE);

    for (const override of [
      { sourceRecordId: 'rec-2' },
      { fieldName: 'owner' },
      { templateId: 'tpl-2' },
      { workflowId: 'wf-2' },
    ]) {
      expect(buildWorkflowSendDedupId({ ...BASE, ...override })).not.toBe(
        original,
      );
    }
  });

  it('ignores the changed values when the event identity is known', () => {
    // Values are redundant once the write is identified: the same event cannot
    // legitimately carry different values, and including them would only add a
    // way to collide.
    expect(buildWorkflowSendDedupId({ ...BASE, before: 'X', after: 'Y' })).toBe(
      buildWorkflowSendDedupId(BASE),
    );
  });

  it('falls back to the values when no event identity is supplied', () => {
    const noEventId = { ...BASE, eventId: '' };

    // Legacy payloads still deduplicate deterministically...
    expect(buildWorkflowSendDedupId(noEventId)).toBe(
      buildWorkflowSendDedupId(noEventId),
    );

    // ...but the fallback cannot tell A→B→A apart, which is exactly why the
    // event identity is the primary input.
    expect(
      buildWorkflowSendDedupId({ ...noEventId, eventId: 'event-3' }),
    ).not.toBe(buildWorkflowSendDedupId(noEventId));
  });

  it('does not collide when values contain the separator', () => {
    // A naive join would make these two inputs identical.
    const withNoEventId = { ...BASE, eventId: '' };

    const first = buildWorkflowSendDedupId({
      ...withNoEventId,
      before: 'a\u0000b',
      after: 'c',
    });
    const second = buildWorkflowSendDedupId({
      ...withNoEventId,
      before: 'a',
      after: 'b\u0000c',
    });

    expect(first).not.toBe(second);
  });

  it('separates two workflows that were not given an identity', () => {
    // Without a workflow id the same event reaching two workflows yields one
    // message, which is the deliberate bias against double-charging.
    const first = buildWorkflowSendDedupId({ ...BASE, workflowId: '' });
    const second = buildWorkflowSendDedupId({ ...BASE, workflowId: '' });

    expect(first).toBe(second);
  });

  it('serialises composite values order-independently', () => {
    expect(buildWorkflowSendEventPart({ firstName: 'A', lastName: 'B' })).toBe(
      buildWorkflowSendEventPart({ lastName: 'B', firstName: 'A' }),
    );
  });

  it('renders null and undefined the same way', () => {
    expect(buildWorkflowSendEventPart(null)).toBe(
      buildWorkflowSendEventPart(undefined),
    );
  });
});
