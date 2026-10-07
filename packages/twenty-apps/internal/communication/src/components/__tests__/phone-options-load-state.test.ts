import { describe, expect, it } from 'vitest';

import {
  isPhoneSelectionReady,
  resolvePhoneOptionsLoadState,
} from 'src/components/phone-options-load-state';

describe('resolvePhoneOptionsLoadState', () => {
  it('returns READY with the selected phone on a successful response', () => {
    const state = resolvePhoneOptionsLoadState({
      ok: true,
      data: {
        success: true,
        phones: [
          { id: 'primary', value: '09120000000', isPrimary: true },
          { id: 'other', value: '09121111111', isPrimary: false },
        ],
      },
    });

    expect(state).toEqual({
      kind: 'READY',
      phones: [
        { id: 'primary', value: '09120000000', isPrimary: true },
        { id: 'other', value: '09121111111', isPrimary: false },
      ],
      selectedPhone: '09120000000',
    });
  });

  it('selects the first phone when none is marked primary', () => {
    const state = resolvePhoneOptionsLoadState({
      ok: true,
      data: {
        success: true,
        phones: [{ id: 'a', value: '09120000001', isPrimary: false }],
      },
    });

    expect(state.kind).toBe('READY');
    expect(state.kind === 'READY' && state.selectedPhone).toBe('09120000001');
  });

  it('returns EMPTY only for a successful response with an empty list', () => {
    const state = resolvePhoneOptionsLoadState({
      ok: true,
      data: { success: true, phones: [] },
    });

    expect(state).toEqual({ kind: 'EMPTY' });
  });

  it('returns ERROR for an HTTP 500 response', () => {
    const state = resolvePhoneOptionsLoadState({
      ok: false,
      data: {
        statusCode: 500,
        messages: ['Logic function execution failed'],
        code: 'ROUTE_TRIGGER_PLATFORM_ERROR',
      },
    });

    expect(state).toEqual({ kind: 'ERROR' });
  });

  it('returns ERROR for a non-ok response even if the body looks successful', () => {
    const state = resolvePhoneOptionsLoadState({
      ok: false,
      data: { success: true, phones: [] },
    });

    expect(state).toEqual({ kind: 'ERROR' });
  });

  it('returns ERROR for a malformed body (missing success flag)', () => {
    const state = resolvePhoneOptionsLoadState({
      ok: true,
      data: { phones: [] },
    });

    expect(state).toEqual({ kind: 'ERROR' });
  });

  it('returns ERROR for a malformed body (phones not an array)', () => {
    const state = resolvePhoneOptionsLoadState({
      ok: true,
      data: { success: true, phones: 'nope' },
    });

    expect(state).toEqual({ kind: 'ERROR' });
  });

  it('returns ERROR for a null body', () => {
    expect(
      resolvePhoneOptionsLoadState({ ok: true, data: null }),
    ).toEqual({ kind: 'ERROR' });
  });

  it('never reports a failure as EMPTY', () => {
    const errorStates = [
      { ok: false, data: { success: true, phones: [] } },
      { ok: false, data: {} },
      { ok: true, data: { success: false, error: 'boom' } },
      { ok: true, data: { success: true, phones: 'invalid' } },
    ].map(resolvePhoneOptionsLoadState);

    for (const state of errorStates) {
      expect(state.kind).not.toBe('EMPTY');
      expect(state.kind).toBe('ERROR');
    }
  });

  it('drops malformed phone entries but keeps valid ones', () => {
    const state = resolvePhoneOptionsLoadState({
      ok: true,
      data: {
        success: true,
        phones: [
          { id: '', value: '09120000000', isPrimary: true },
          { id: 'b', value: '', isPrimary: false },
          null,
          { id: 'c', value: '09129999999', isPrimary: false },
        ],
      },
    });

    expect(state.kind).toBe('READY');
    expect(state.kind === 'READY' && state.phones).toEqual([
      { id: 'c', value: '09129999999', isPrimary: false },
    ]);
    expect(state.kind === 'READY' && state.selectedPhone).toBe('09129999999');
  });
});

describe('isPhoneSelectionReady', () => {
  it('is true only for READY with a chosen phone', () => {
    expect(isPhoneSelectionReady({ kind: 'LOADING' })).toBe(false);
    expect(isPhoneSelectionReady({ kind: 'EMPTY' })).toBe(false);
    expect(isPhoneSelectionReady({ kind: 'ERROR' })).toBe(false);
    expect(
      isPhoneSelectionReady({
        kind: 'READY',
        phones: [{ id: 'a', value: '09120000000', isPrimary: true }],
        selectedPhone: '',
      }),
    ).toBe(false);
    expect(
      isPhoneSelectionReady({
        kind: 'READY',
        phones: [{ id: 'a', value: '09120000000', isPrimary: true }],
        selectedPhone: '09120000000',
      }),
    ).toBe(true);
  });
});
