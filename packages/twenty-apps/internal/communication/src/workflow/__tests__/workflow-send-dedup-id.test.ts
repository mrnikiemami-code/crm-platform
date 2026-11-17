import { describe, expect, it } from 'vitest';

import {
  buildWorkflowSendDedupId,
  buildWorkflowSendEventPart,
} from 'src/workflow/workflow-send-dedup-id';

const BASE = {
  workflowId: 'wf-1',
  sourceObjectName: 'person',
  sourceRecordId: 'rec-1',
  fieldName: 'stage',
  before: 'NEW',
  after: 'WON',
  templateId: 'tpl-1',
};

describe('buildWorkflowSendDedupId', () => {
  it('is stable for the same real change', () => {
    expect(buildWorkflowSendDedupId(BASE)).toBe(buildWorkflowSendDedupId(BASE));
  });

  it('produces a well-formed uuid', () => {
    expect(buildWorkflowSendDedupId(BASE)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('differs when the new value differs', () => {
    expect(buildWorkflowSendDedupId(BASE)).not.toBe(
      buildWorkflowSendDedupId({ ...BASE, after: 'LOST' }),
    );
  });

  it('treats A to B and B to A as two distinct changes', () => {
    expect(buildWorkflowSendDedupId(BASE)).not.toBe(
      buildWorkflowSendDedupId({ ...BASE, before: 'WON', after: 'NEW' }),
    );
  });

  it('differs per object, record, field, template and workflow', () => {
    const original = buildWorkflowSendDedupId(BASE);

    for (const override of [
      { sourceObjectName: 'company' },
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

  it('does not collide when values contain the separator', () => {
    // A naive join would make these two inputs identical.
    const first = buildWorkflowSendDedupId({
      ...BASE,
      before: 'a\u0000b',
      after: 'c',
    });
    const second = buildWorkflowSendDedupId({
      ...BASE,
      before: 'a',
      after: 'b\u0000c',
    });

    expect(first).not.toBe(second);
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
