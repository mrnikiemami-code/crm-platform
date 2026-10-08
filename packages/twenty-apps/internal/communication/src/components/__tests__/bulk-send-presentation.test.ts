import { describe, expect, it } from 'vitest';

import { buildBulkConfirmationPlan } from 'src/components/bulk-confirmation-plan';
import {
  buildBulkExcludedDisplay,
  buildBulkRecipientDisplay,
  buildBulkSummaryPresentation,
  BULK_RESULT_LABELS,
  BULK_SENDING_LABEL,
  BULK_STATUS_DELIVERED,
  BULK_STOPPED_UNKNOWN_MESSAGE,
  BULK_STOPPED_UNKNOWN_TITLE,
  BULK_STOPPED_USER_MESSAGE,
  BULK_STOPPED_USER_TITLE,
} from 'src/components/bulk-send-presentation';
import { type BulkSendRecipientResult } from 'src/components/bulk-send-coordinator';
import { type BulkRecipient, type RecipientPreview } from 'src/components/bulk-composer-state';

const result = (
  personId: string,
  kind: BulkSendRecipientResult['kind'],
  extra: Partial<BulkSendRecipientResult> = {},
): BulkSendRecipientResult => ({
  personId,
  displayName: personId,
  recipient: '09120000001',
  body: 'x',
  kind,
  ...extra,
});

describe('buildBulkRecipientDisplay', () => {
  it('shows the in-flight recipient as SENDING, never NOT_STARTED', () => {
    const displays = buildBulkRecipientDisplay({
      results: [result('p1', 'NOT_STARTED'), result('p2', 'NOT_STARTED')],
      currentPersonId: 'p1',
    });

    expect(displays[0].label).toBe(BULK_SENDING_LABEL);
    expect(displays[0].variant).toBe('neutral');
    expect(displays[1].label).toBe(BULK_RESULT_LABELS.NOT_STARTED);
  });

  it('keeps every severity distinct', () => {
    const displays = buildBulkRecipientDisplay({
      results: [
        result('p1', 'ACCEPTED', { status: 'SENT' }),
        result('p2', 'DEFINITE_FAILURE', { message: 'mock rejection' }),
        result('p3', 'UNKNOWN'),
        result('p4', 'NOT_STARTED'),
      ],
      currentPersonId: null,
    });

    expect(displays.map((display) => display.variant)).toEqual([
      'success',
      'error',
      'warning',
      'neutral',
    ]);
  });

  it('keeps SENT distinct from DELIVERED', () => {
    const displays = buildBulkRecipientDisplay({
      results: [
        result('p1', 'ACCEPTED', { status: 'SENT' }),
        result('p2', 'ACCEPTED', { status: 'DELIVERED' }),
      ],
      currentPersonId: null,
    });

    expect(displays[0].label).toBe(BULK_RESULT_LABELS.ACCEPTED);
    expect(displays[1].label).toBe(BULK_STATUS_DELIVERED);
    expect(displays[0].label).not.toBe(displays[1].label);
  });

  it('marks a definite failure detail as PROVIDER text and others as app copy', () => {
    const displays = buildBulkRecipientDisplay({
      results: [
        result('p1', 'DEFINITE_FAILURE', { message: 'provider said no' }),
        result('p2', 'UNKNOWN', { message: 'app copy' }),
      ],
      currentPersonId: null,
    });

    expect(displays[0].isProviderText).toBe(true);
    expect(displays[1].isProviderText).toBe(false);
  });
});

describe('buildBulkSummaryPresentation', () => {
  it('has no stop notice for a completed run', () => {
    const summary = buildBulkSummaryPresentation({
      results: [],
      acceptedCount: 2,
      definiteFailureCount: 0,
      unknownCount: 0,
      notStartedCount: 0,
      isStopped: false,
      stopReason: null,
    });

    expect(summary.stopNotice).toBeNull();
  });

  it('reports a user stop with the user notice', () => {
    const summary = buildBulkSummaryPresentation({
      results: [],
      acceptedCount: 1,
      definiteFailureCount: 0,
      unknownCount: 0,
      notStartedCount: 1,
      isStopped: true,
      stopReason: 'USER',
    });

    expect(summary.stopNotice).toEqual({
      title: BULK_STOPPED_USER_TITLE,
      message: BULK_STOPPED_USER_MESSAGE,
    });
  });

  it('reports an unknown stop with the unknown notice', () => {
    const summary = buildBulkSummaryPresentation({
      results: [],
      acceptedCount: 0,
      definiteFailureCount: 0,
      unknownCount: 1,
      notStartedCount: 1,
      isStopped: true,
      stopReason: 'UNKNOWN',
    });

    expect(summary.stopNotice).toEqual({
      title: BULK_STOPPED_UNKNOWN_TITLE,
      message: BULK_STOPPED_UNKNOWN_MESSAGE,
    });
  });
});

describe('buildBulkExcludedDisplay', () => {
  const recipient = (personId: string): BulkRecipient => ({
    personId,
    displayName: personId,
    status: 'SENDABLE',
    phones: [],
    selectedPhone: '09120000001',
  });

  const preview = (
    personId: string,
    overrides: Partial<RecipientPreview> = {},
  ): RecipientPreview => ({
    personId,
    displayName: personId,
    phone: '09120000001',
    previewText: 'x',
    hasUnresolvedVariables: false,
    issues: [],
    isReadyToSend: true,
    ...overrides,
  });

  it('returns the FIXED reason key and the tokens as separate data', () => {
    const plan = buildBulkConfirmationPlan({
      recipients: [recipient('p1')],
      previews: [
        preview('p1', {
          isReadyToSend: false,
          hasUnresolvedVariables: true,
          issues: [{ token: '@company', kind: 'EMPTY_FIELD' }],
        }),
      ],
    });

    const displays = buildBulkExcludedDisplay(plan.excluded);

    expect(displays[0].reasonKey).toBe('The preview is not ready to send.');
    // The key NEVER contains the token.
    expect(displays[0].reasonKey).not.toContain('@company');
    expect(displays[0].tokens).toEqual(['@company']);
  });
});
