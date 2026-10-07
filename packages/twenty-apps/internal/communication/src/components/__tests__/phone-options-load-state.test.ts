import { describe, expect, it } from 'vitest';

import {
  createPhoneOptionsLoader,
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

  it('returns ERROR for a non-empty list whose only entry is null', () => {
    expect(
      resolvePhoneOptionsLoadState({
        ok: true,
        data: { success: true, phones: [null] },
      }),
    ).toEqual({ kind: 'ERROR' });
  });

  it('returns ERROR for a non-empty list whose only entry is an empty object', () => {
    expect(
      resolvePhoneOptionsLoadState({
        ok: true,
        data: { success: true, phones: [{}] },
      }),
    ).toEqual({ kind: 'ERROR' });
  });

  it('returns ERROR when every entry is unusable, regardless of count', () => {
    const state = resolvePhoneOptionsLoadState({
      ok: true,
      data: { success: true, phones: [null, {}, 'x', 42, { id: 'a' }] },
    });

    expect(state).toEqual({ kind: 'ERROR' });
    expect(state.kind).not.toBe('EMPTY');
  });

  it('returns EMPTY only for a genuinely empty list, never for a non-empty one', () => {
    const empty = resolvePhoneOptionsLoadState({
      ok: true,
      data: { success: true, phones: [] },
    });
    const nonEmptyUnusable = resolvePhoneOptionsLoadState({
      ok: true,
      data: { success: true, phones: [{}] },
    });

    expect(empty).toEqual({ kind: 'EMPTY' });
    expect(nonEmptyUnusable).not.toEqual({ kind: 'EMPTY' });
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

describe('createPhoneOptionsLoader (stale-response protection)', () => {
  const deferred = () => {
    let resolve: (value: { ok: boolean; data: unknown }) => void = () => {};
    let reject: (reason?: unknown) => void = () => {};

    const promise = new Promise<{ ok: boolean; data: unknown }>(
      (res, rej) => {
        resolve = res;
        reject = rej;
      },
    );

    return { promise, resolve, reject };
  };

  const successWith = (value: string) => ({
    ok: true,
    data: {
      success: true,
      phones: [{ id: 'primary', value, isPrimary: true }],
    },
  });

  it('ignores a stale success response from an earlier request', async () => {
    const first = deferred();
    const second = deferred();
    const calls = [first.promise, second.promise];
    let call = 0;

    const published: Array<{ state: unknown; selected: string }> = [];
    const loader = createPhoneOptionsLoader({
      transport: () => calls[call++],
      onState: (state, selected) => published.push({ state, selected }),
    });

    const firstLoad = loader.load();
    const secondLoad = loader.load();

    // Second (newer) request settles first, then the older one.
    second.resolve(successWith('09120000002'));
    await secondLoad;
    first.resolve(successWith('09120000001'));
    await firstLoad;

    // The newest response wins; the older one must not have changed anything.
    expect(published[published.length - 1]).toEqual({
      state: {
        kind: 'READY',
        phones: [{ id: 'primary', value: '09120000002', isPrimary: true }],
        selectedPhone: '09120000002',
      },
      selected: '09120000002',
    });

    const readyStates = published.filter(
      (entry) => (entry.state as { kind: string }).kind === 'READY',
    );

    expect(readyStates).toHaveLength(1);
    expect(
      published.some(
        (entry) => entry.selected === '09120000001',
      ),
    ).toBe(false);
  });

  it('ignores a stale error from an earlier request', async () => {
    const first = deferred();
    const second = deferred();
    const calls = [first.promise, second.promise];
    let call = 0;

    const published: Array<{ state: unknown; selected: string }> = [];
    const loader = createPhoneOptionsLoader({
      transport: () => calls[call++],
      onState: (state, selected) => published.push({ state, selected }),
    });

    const firstLoad = loader.load();
    const secondLoad = loader.load();

    second.resolve(successWith('09120000009'));
    await secondLoad;
    first.reject(new Error('stale network failure'));
    await firstLoad;

    // The stale failure must not have replaced the fresh READY state.
    expect(published[published.length - 1]).toEqual({
      state: {
        kind: 'READY',
        phones: [{ id: 'primary', value: '09120000009', isPrimary: true }],
        selectedPhone: '09120000009',
      },
      selected: '09120000009',
    });

    const errorStates = published.filter(
      (entry) => (entry.state as { kind: string }).kind === 'ERROR',
    );

    expect(errorStates).toHaveLength(0);
  });

  it('lets the newest request publish its ERROR even after an older success', async () => {
    const first = deferred();
    const second = deferred();
    const calls = [first.promise, second.promise];
    let call = 0;

    const published: Array<{ state: unknown; selected: string }> = [];
    const loader = createPhoneOptionsLoader({
      transport: () => calls[call++],
      onState: (state, selected) => published.push({ state, selected }),
    });

    const firstLoad = loader.load();
    const secondLoad = loader.load();

    first.resolve(successWith('09120000001'));
    await firstLoad;
    second.reject(new Error('fresh failure'));
    await secondLoad;

    expect(published[published.length - 1]).toEqual({ state: { kind: 'ERROR' }, selected: '' });
    expect(
      published.some(
        (entry) => (entry.state as { kind: string }).kind === 'READY',
      ),
    ).toBe(false);
  });

  it('emits LOADING then resets selection on every new request', async () => {
    const published: Array<{ state: unknown; selected: string }> = [];
    const loader = createPhoneOptionsLoader({
      transport: async () => successWith('09120000003'),
      onState: (state, selected) => published.push({ state, selected }),
    });

    await loader.load();

    expect(published[0]).toEqual({ state: { kind: 'LOADING' }, selected: '' });
    expect(published[published.length - 1]).toEqual({
      state: {
        kind: 'READY',
        phones: [{ id: 'primary', value: '09120000003', isPrimary: true }],
        selectedPhone: '09120000003',
      },
      selected: '09120000003',
    });
  });
});
