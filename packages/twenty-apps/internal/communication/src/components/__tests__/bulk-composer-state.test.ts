import { describe, expect, it } from 'vitest';

import {
  describeSharedPhoneWarnings,
  resolveBulkRecipientsLoadState,
  resolvePreviewLoadState,
  resolveTemplatesLoadState,
} from 'src/components/bulk-composer-state';

describe('resolveBulkRecipientsLoadState', () => {
  it('is ERROR for a non-ok response, never an empty list', () => {
    expect(
      resolveBulkRecipientsLoadState({
        ok: false,
        data: { success: true, recipients: [] },
      }),
    ).toEqual({ kind: 'ERROR' });
  });

  it('is ERROR when the success flag is missing', () => {
    expect(
      resolveBulkRecipientsLoadState({ ok: true, data: { recipients: [] } }),
    ).toEqual({ kind: 'ERROR' });
  });

  it('reads a ready response with recipients and warnings', () => {
    const state = resolveBulkRecipientsLoadState({
      ok: true,
      data: {
        success: true,
        recipients: [
          {
            personId: 'p1',
            displayName: 'سارا',
            status: 'SENDABLE',
            phones: [{ id: 'primary', value: '09120000001', isPrimary: true }],
            selectedPhone: '09120000001',
          },
          {
            personId: 'p2',
            displayName: 'رضا',
            status: 'NO_PHONE',
            phones: [],
            selectedPhone: null,
          },
        ],
        duplicatePersonIds: ['p1'],
        sharedPhoneWarnings: [{ phone: '09120000001', personIds: ['p1', 'p3'] }],
        sendableCount: 1,
        unsendableCount: 1,
      },
    });

    expect(state.kind).toBe('READY');

    if (state.kind === 'READY') {
      expect(state.recipients).toHaveLength(2);
      expect(state.recipients[1].status).toBe('NO_PHONE');
      expect(state.sharedPhoneWarnings).toEqual([
        { phone: '09120000001', personIds: ['p1', 'p3'] },
      ]);
      expect(state.sendableCount).toBe(1);
    }
  });

  it('is ERROR when entries are present but all malformed', () => {
    expect(
      resolveBulkRecipientsLoadState({
        ok: true,
        data: { success: true, recipients: [{ notAnId: true }] },
      }),
    ).toEqual({ kind: 'ERROR' });
  });
});

describe('resolvePreviewLoadState', () => {
  it('is ERROR for a failed response', () => {
    expect(resolvePreviewLoadState({ ok: false, data: {} })).toEqual({
      kind: 'ERROR',
    });
  });

  it('reads per-recipient previews with unresolved flags', () => {
    const state = resolvePreviewLoadState({
      ok: true,
      data: {
        success: true,
        previews: [
          {
            personId: 'p1',
            displayName: 'سارا',
            phone: '09120000001',
            previewText: 'سلام سارا از @company',
            hasUnresolvedVariables: true,
            issues: [{ token: '@company', kind: 'EMPTY_FIELD' }],
            isReadyToSend: false,
          },
        ],
        readyCount: 0,
      },
    });

    expect(state.kind).toBe('READY');

    if (state.kind === 'READY') {
      expect(state.hasUnresolvedVariables).toBe(true);
      expect(state.previews[0].issues).toEqual([
        { token: '@company', kind: 'EMPTY_FIELD' },
      ]);
      expect(state.previews[0].isReadyToSend).toBe(false);
    }
  });

  it('never marks a recipient with an unresolved variable as ready', () => {
    const state = resolvePreviewLoadState({
      ok: true,
      data: {
        success: true,
        previews: [
          {
            personId: 'p1',
            displayName: 'سارا',
            phone: '09120000001',
            previewText: '@ghost',
            hasUnresolvedVariables: true,
            issues: [{ token: '@ghost', kind: 'UNKNOWN_VARIABLE' }],
            isReadyToSend: false,
          },
        ],
      },
    });

    if (state.kind === 'READY') {
      expect(state.previews[0].isReadyToSend).toBe(false);
      expect(state.readyCount).toBe(0);
    }
  });
});

describe('resolveTemplatesLoadState', () => {
  it('is ERROR for a failed response', () => {
    expect(resolveTemplatesLoadState({ ok: false, data: {} })).toEqual({
      kind: 'ERROR',
    });
  });

  it('reads templates and variables', () => {
    const state = resolveTemplatesLoadState({
      ok: true,
      data: {
        success: true,
        templates: [
          { id: 't1', title: 'خوش‌آمد', body: 'سلام @name', channel: 'SMS' },
        ],
        variables: [{ token: '@name', label: 'First name' }],
      },
    });

    expect(state.kind).toBe('READY');

    if (state.kind === 'READY') {
      expect(state.templates[0].title).toBe('خوش‌آمد');
      expect(state.variables[0].token).toBe('@name');
    }
  });
});

describe('describeSharedPhoneWarnings', () => {
  it('summarizes each shared number with its recipient count', () => {
    expect(
      describeSharedPhoneWarnings([
        { phone: '09120000001', personIds: ['p1', 'p2'] },
      ]),
    ).toEqual(['09120000001 (2 recipients)']);
  });
});
