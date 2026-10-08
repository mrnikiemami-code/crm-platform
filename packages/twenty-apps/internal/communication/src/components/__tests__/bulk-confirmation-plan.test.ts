import { describe, expect, it } from 'vitest';

import { type BulkRecipient } from 'src/components/bulk-composer-state';
import { buildBulkConfirmationPlan } from 'src/components/bulk-confirmation-plan';
import { type RecipientPreview } from 'src/components/bulk-composer-state';

const recipient = (
  personId: string,
  displayName: string,
  selectedPhone: string | null,
): BulkRecipient => ({
  personId,
  displayName,
  status: selectedPhone === null ? 'NO_PHONE' : 'SENDABLE',
  phones: [],
  selectedPhone,
});

const preview = (
  personId: string,
  overrides: Partial<RecipientPreview> = {},
): RecipientPreview => ({
  personId,
  displayName: personId,
  phone: '09120000001',
  previewText: 'سلام',
  hasUnresolvedVariables: false,
  issues: [],
  isReadyToSend: true,
  ...overrides,
});

describe('buildBulkConfirmationPlan', () => {
  it('sends every ready recipient, in form order, with the previewed text and number', () => {
    const plan = buildBulkConfirmationPlan({
      recipients: [recipient('p1', 'Sara', '09120000001'), recipient('p2', 'Reza', '09120000002')],
      previews: [
        preview('p1', { phone: '09120000001', previewText: 'سلام سارا' }),
        preview('p2', { phone: '09120000002', previewText: 'سلام رضا' }),
      ],
    });

    expect(plan.sendable).toEqual([
      { personId: 'p1', displayName: 'Sara', recipient: '09120000001', body: 'سلام سارا' },
      { personId: 'p2', displayName: 'Reza', recipient: '09120000002', body: 'سلام رضا' },
    ]);
    expect(plan.excluded).toEqual([]);
    expect(plan.totalRecipients).toBe(2);
  });

  it('sets aside a recipient the preview did not cover', () => {
    const plan = buildBulkConfirmationPlan({
      recipients: [recipient('p1', 'Sara', '09120000001'), recipient('p2', 'Reza', '09120000002')],
      previews: [preview('p1')],
    });

    expect(plan.sendable.map((entry) => entry.personId)).toEqual(['p1']);
    expect(plan.excluded).toHaveLength(1);
    expect(plan.excluded[0].personId).toBe('p2');
    expect(plan.excluded[0].reasonCode).toBe('NOT_IN_PREVIEW');
    expect(plan.excluded[0].tokens).toEqual([]);
  });

  it('sets aside a not-ready recipient and reports the tokens SEPARATELY', () => {
    const plan = buildBulkConfirmationPlan({
      recipients: [recipient('p1', 'Sara', '09120000001')],
      previews: [
        preview('p1', {
          isReadyToSend: false,
          hasUnresolvedVariables: true,
          issues: [{ token: '@company', kind: 'EMPTY_FIELD' }],
        }),
      ],
    });

    expect(plan.sendable).toEqual([]);
    expect(plan.excluded[0].reasonCode).toBe('NOT_READY');
    // The token is DATA, never concatenated into the reason.
    expect(plan.excluded[0].tokens).toEqual(['@company']);
  });

  it('sets aside a recipient with no phone', () => {
    const plan = buildBulkConfirmationPlan({
      recipients: [recipient('p1', 'Sara', null)],
      previews: [preview('p1', { phone: null, isReadyToSend: false })],
    });

    expect(plan.sendable).toEqual([]);
    expect(plan.excluded).toHaveLength(1);
    expect(plan.excluded[0].reasonCode).toBe('NO_PHONE');
  });

  it('sets aside a recipient whose confirmed text is empty', () => {
    const plan = buildBulkConfirmationPlan({
      recipients: [recipient('p1', 'Sara', '09120000001')],
      previews: [preview('p1', { previewText: '   ' })],
    });

    expect(plan.sendable).toEqual([]);
    expect(plan.excluded[0].reasonCode).toBe('NO_BODY');
  });

  it('reports numbers shared by two or more sendable recipients (never silently drops)', () => {
    const plan = buildBulkConfirmationPlan({
      recipients: [recipient('p1', 'Sara', '09120000001'), recipient('p2', 'Reza', '09120000001')],
      previews: [
        preview('p1', { phone: '09120000001' }),
        preview('p2', { phone: '09120000001' }),
      ],
    });

    expect(plan.sendable).toHaveLength(2);
    expect(plan.sharedNumbers).toEqual(['09120000001']);
  });
});
