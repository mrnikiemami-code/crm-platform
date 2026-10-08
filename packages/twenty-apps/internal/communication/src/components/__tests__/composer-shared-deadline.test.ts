import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BULK_SEND_DEADLINE_MS,
  callAppRoute,
} from 'src/components/composer-shared';

// Real deadline behavior for the bulk transport. The fetch is faked at the
// global boundary (the only external dependency), so the PRODUCTION
// `callAppRoute` — including its AbortController, timer and body read — runs.
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

const setEnv = () => {
  process.env.TWENTY_API_URL = 'http://localhost:3000';
  process.env.TWENTY_APP_ACCESS_TOKEN = 'test-token';
};

describe('callAppRoute bulk deadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setEnv();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('has a documented 60-second deadline', () => {
    expect(BULK_SEND_DEADLINE_MS).toBe(60_000);
  });

  it('stops waiting and rejects when fetch never resolves', async () => {
    let capturedSignal: AbortSignal | undefined;

    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;

      // Real fetch rejects when its signal aborts; the fake must too, or the
      // production code would wait forever.
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        );
      });
    }) as unknown as typeof fetch;

    const pending = callAppRoute('/communication/send', 'POST', {}, {
      timeoutMs: BULK_SEND_DEADLINE_MS,
    });

    const outcome = pending.then(
      () => 'resolved',
      () => 'rejected',
    );

    expect(capturedSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(BULK_SEND_DEADLINE_MS);

    expect(capturedSignal?.aborted).toBe(true);
    await expect(outcome).resolves.toBe('rejected');
  });

  it('stops waiting when fetch resolves but response.text() never resolves', async () => {
    let capturedSignal: AbortSignal | undefined;

    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;

      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new Error('aborted')),
            );
          }),
      });
    }) as unknown as typeof fetch;

    const pending = callAppRoute('/communication/send', 'POST', {}, {
      timeoutMs: BULK_SEND_DEADLINE_MS,
    });

    const outcome = pending.then(
      () => 'resolved',
      () => 'rejected',
    );

    await vi.advanceTimersByTimeAsync(BULK_SEND_DEADLINE_MS);

    expect(capturedSignal?.aborted).toBe(true);
    await expect(outcome).resolves.toBe('rejected');
  });

  it('ignores a late success after the deadline already expired', async () => {
    let resolveText: ((value: string) => void) | null = null;

    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        // Deliberately does NOT reject on abort: it stays pending until the
        // late resolve, so the production "already aborted" check is what must
        // reject it.
        text: () =>
          new Promise<string>((resolve) => {
            resolveText = resolve;
          }),
      }),
    ) as unknown as typeof fetch;

    const pending = callAppRoute('/communication/send', 'POST', {}, {
      timeoutMs: BULK_SEND_DEADLINE_MS,
    });

    const outcome = pending.then(
      () => 'resolved',
      () => 'rejected',
    );

    await vi.advanceTimersByTimeAsync(BULK_SEND_DEADLINE_MS);

    // The late response arrives AFTER the deadline.
    const lateResolve = resolveText as ((value: string) => void) | null;
    lateResolve?.('{"success":true,"status":"SENT"}');
    await vi.advanceTimersByTimeAsync(0);

    await expect(outcome).resolves.toBe('rejected');
  });

  it('resolves normally when the response settles before the deadline', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"success":true,"status":"SENT"}'),
      }),
    ) as unknown as typeof fetch;

    const result = await callAppRoute('/communication/send', 'POST', {}, {
      timeoutMs: BULK_SEND_DEADLINE_MS,
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ success: true, status: 'SENT' });
  });

  it('leaves no pending timers after completion', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{}'),
      }),
    ) as unknown as typeof fetch;

    await callAppRoute('/communication/send', 'POST', {}, {
      timeoutMs: BULK_SEND_DEADLINE_MS,
    });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the original no-deadline behavior when no timeout is given', async () => {
    let capturedSignal: AbortSignal | undefined;

    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;

      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{}'),
      });
    }) as unknown as typeof fetch;

    await callAppRoute('/communication/send', 'POST', {});

    expect(capturedSignal).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});
