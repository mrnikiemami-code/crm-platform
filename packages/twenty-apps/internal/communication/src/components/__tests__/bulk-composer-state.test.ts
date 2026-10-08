import { describe, expect, it } from 'vitest';

import {
  describeSharedPhoneWarnings,
  recomputeVisibleSharedPhoneWarnings,
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

  it('surfaces isBodyEmpty, invalidOverrides and recomputed shared warnings', () => {
    const state = resolvePreviewLoadState({
      ok: true,
      data: {
        success: true,
        previews: [
          {
            personId: 'p1',
            displayName: 'سارا',
            phone: '09120000001',
            previewText: '',
            hasUnresolvedVariables: false,
            issues: [],
            isReadyToSend: false,
          },
        ],
        isBodyEmpty: true,
        readyCount: 0,
        invalidOverrides: ['p2'],
        sharedPhoneWarnings: [{ phone: '09120000001', personIds: ['p1', 'p3'] }],
      },
    });

    expect(state.kind).toBe('READY');

    if (state.kind === 'READY') {
      expect(state.isBodyEmpty).toBe(true);
      expect(state.invalidOverrides).toEqual(['p2']);
      expect(state.sharedPhoneWarnings).toEqual([
        { phone: '09120000001', personIds: ['p1', 'p3'] },
      ]);
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

  it('is EMPTY (not ERROR) when the workspace has no templates, keeping variables', () => {
    const state = resolveTemplatesLoadState({
      ok: true,
      data: {
        success: true,
        templates: [],
        variables: [{ token: '@name', label: 'First name' }],
      },
    });

    expect(state.kind).toBe('EMPTY');

    if (state.kind === 'EMPTY') {
      expect(state.variables).toEqual([{ token: '@name', label: 'First name' }]);
    }
  });

  it('keeps LOADING, EMPTY and ERROR as three separate states', () => {
    expect(resolveTemplatesLoadState({ ok: false, data: {} })).toEqual({
      kind: 'ERROR',
    });
    expect(
      resolveTemplatesLoadState({ ok: true, data: { templates: [] } }),
    ).toEqual({ kind: 'ERROR' });
    expect(
      resolveTemplatesLoadState({
        ok: true,
        data: { success: true, templates: [] },
      }).kind,
    ).toBe('EMPTY');
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

describe('recomputeVisibleSharedPhoneWarnings (live, from remaining recipients)', () => {
  it('warns when two remaining recipients use the same number', () => {
    expect(
      recomputeVisibleSharedPhoneWarnings([
        { personId: 'p1', selectedPhone: '09120000001' },
        { personId: 'p2', selectedPhone: '09120000001' },
      ]),
    ).toEqual([{ phone: '09120000001', personIds: ['p1', 'p2'] }]);
  });

  it('drops the warning once one recipient is removed', () => {
    // p2 was removed, so only p1 remains on that number.
    expect(
      recomputeVisibleSharedPhoneWarnings([
        { personId: 'p1', selectedPhone: '09120000001' },
      ]),
    ).toEqual([]);
  });

  it('reflects a number SWITCH (override) that creates a shared number', () => {
    expect(
      recomputeVisibleSharedPhoneWarnings([
        { personId: 'p1', selectedPhone: '09120000002' },
        { personId: 'p2', selectedPhone: '09120000002' },
      ]),
    ).toEqual([{ phone: '09120000002', personIds: ['p1', 'p2'] }]);
  });

  it('ignores null numbers (unsendable recipients)', () => {
    expect(
      recomputeVisibleSharedPhoneWarnings([
        { personId: 'p1', selectedPhone: null },
        { personId: 'p2', selectedPhone: null },
      ]),
    ).toEqual([]);
  });
});
