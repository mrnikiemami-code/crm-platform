import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BULK_SEND_DEADLINE_MS,
  callAppRoute,
} from 'src/components/composer-shared';

// Real deadline behavior for the bulk transport. Only the global `fetch` is
// faked (the single external dependency); the PRODUCTION `callAppRoute` — its
// independent deadline race, timer and parse checks — runs unchanged.
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

const setEnv = () => {
  process.env.TWENTY_API_URL = 'http://localhost:3000';
  process.env.TWENTY_APP_ACCESS_TOKEN = 'test-token';
};

// Records unhandled rejections so a late settlement can be proven harmless.
const trackUnhandled = () => {
  const unhandled: unknown[] = [];
  const handler = (reason: unknown) => unhandled.push(reason);

  process.on('unhandledRejection', handler);

  return {
    unhandled,
    stop: () => process.off('unhandledRejection', handler),
  };
};

describe('callAppRoute independent deadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setEnv();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('documents a 60-second deadline', () => {
    expect(BULK_SEND_DEADLINE_MS).toBe(60_000);
  });

  // B. fetch ignores AbortSignal and never resolves ---------------------------

  it('B: rejects at the deadline even when fetch NEVER resolves and IGNORES AbortSignal', async () => {
    let capturedSignal: AbortSignal | undefined;

    // Deliberately does NOT subscribe to the signal.
    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;

      return new Promise(() => {
        // Never settles.
      });
    }) as unknown as typeof fetch;

    const pending = callAppRoute('/communication/send', 'POST', {}, {
      timeoutMs: BULK_SEND_DEADLINE_MS,
    });

    let rejected = false;
    const observed = pending.catch(() => {
      rejected = true;
    });

    // Before the deadline nothing has settled.
    await vi.advanceTimersByTimeAsync(BULK_SEND_DEADLINE_MS - 1);
    expect(rejected).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await observed;

    // The PUBLIC promise rejected at the deadline without any transport help.
    expect(rejected).toBe(true);
    // AbortSignal was still used as a best-effort cancellation signal.
    expect(capturedSignal?.aborted).toBe(true);
    // No pending deadline timer remains.
    expect(vi.getTimerCount()).toBe(0);
  });

  // C. response.text ignores AbortSignal and never resolves -------------------

  it('C: rejects at the deadline when response.text() NEVER resolves and IGNORES AbortSignal', async () => {
    let capturedSignal: AbortSignal | undefined;

    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;

      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          new Promise(() => {
            // The body read never settles and does not subscribe to the signal.
          }),
      });
    }) as unknown as typeof fetch;

    const pending = callAppRoute('/communication/send', 'POST', {}, {
      timeoutMs: BULK_SEND_DEADLINE_MS,
    });

    let rejected = false;
    const observed = pending.catch(() => {
      rejected = true;
    });

    await vi.advanceTimersByTimeAsync(BULK_SEND_DEADLINE_MS);
    await observed;

    expect(rejected).toBe(true);
    expect(capturedSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  // D. Late completion --------------------------------------------------------

  it('D: a late success after the deadline stays rejected and produces no unhandled rejection', async () => {
    const tracker = trackUnhandled();
    let resolveText: ((value: string) => void) | null = null;

    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
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
    await expect(outcome).resolves.toBe('rejected');

    // The late response arrives with a SUCCESS payload.
    (resolveText as ((value: string) => void) | null)?.(
      '{"success":true,"status":"SENT"}',
    );
    await vi.advanceTimersByTimeAsync(0);

    // The public result stays rejected; nothing is resurrected.
    await expect(outcome).resolves.toBe('rejected');

    tracker.stop();
    expect(tracker.unhandled).toEqual([]);
  });

  // E. Parsing crosses the deadline -------------------------------------------

  it('E: a parse that finishes AFTER the deadline is discarded as deadline-expired', async () => {
    // A clock that jumps past the deadline exactly when the parse runs, so the
    // POST-PARSE elapsed check is what rejects the result.
    let clockMs = 0;
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => clockMs);

    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"success":true,"status":"SENT"}'),
      }),
    ) as unknown as typeof fetch;

    const pending = callAppRoute('/communication/send', 'POST', {}, {
      timeoutMs: BULK_SEND_DEADLINE_MS,
    });

    const outcome = pending.then(
      () => 'resolved',
      (error: Error) => error.message,
    );

    // Let fetch + text settle while the clock is still before the deadline, but
    // move the clock past it before the parse's elapsed check runs.
    clockMs = BULK_SEND_DEADLINE_MS + 1;
    await vi.advanceTimersByTimeAsync(0);

    await expect(outcome).resolves.toBe('Request deadline exceeded');

    dateSpy.mockRestore();
  });

  // F. Normal and no-deadline paths -------------------------------------------

  it('F: a response fully settled before the deadline succeeds and leaves no timer', async () => {
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
    expect(vi.getTimerCount()).toBe(0);
  });

  it('F: malformed JSON is NOT treated as a definite provider failure', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('not-json'),
      }),
    ) as unknown as typeof fetch;

    // A parse error propagates as a rejection (the coordinator maps it to
    // UNKNOWN), never as a `{ success: false }` payload.
    await expect(
      callAppRoute('/communication/send', 'POST', {}, {
        timeoutMs: BULK_SEND_DEADLINE_MS,
      }),
    ).rejects.toThrow();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('F: omitting the timeout keeps the original no-deadline behavior', async () => {
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

  it('F: an invalid timeout is ignored (never an immediate or unbounded timeout)', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"success":true}'),
      }),
    ) as unknown as typeof fetch;

    for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = await callAppRoute('/communication/send', 'POST', {}, {
        timeoutMs: invalid,
      });

      expect(result.data).toEqual({ success: true });
      expect(vi.getTimerCount()).toBe(0);
    }
  });
});
