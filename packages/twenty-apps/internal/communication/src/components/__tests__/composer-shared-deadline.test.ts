import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BULK_SEND_DEADLINE_MS,
  callAppRoute,
} from 'src/components/composer-shared';

// Real deadline behavior for the bulk transport. Only the global `fetch` (and,
// for the parsing criterion, a delegating `JSON.parse` wrapper) are faked; the
// PRODUCTION `callAppRoute` — its independent deadline race, its MONOTONIC
// elapsed-time checks and its parse — runs unchanged.
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

const setEnv = () => {
  process.env.TWENTY_API_URL = 'http://localhost:3000';
  process.env.TWENTY_APP_ACCESS_TOKEN = 'test-token';
};

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
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('documents a 60-second deadline', () => {
    expect(BULK_SEND_DEADLINE_MS).toBe(60_000);
  });

  // B. fetch ignores AbortSignal and never resolves ---------------------------

  it('B: rejects at the deadline even when fetch NEVER resolves and IGNORES AbortSignal', async () => {
    let capturedSignal: AbortSignal | undefined;

    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;

      return new Promise(() => {
        // Never settles and never subscribes to the signal.
      });
    }) as unknown as typeof fetch;

    const pending = callAppRoute('/communication/send', 'POST', {}, {
      timeoutMs: BULK_SEND_DEADLINE_MS,
    });

    let rejected = false;
    const observed = pending.catch(() => {
      rejected = true;
    });

    await vi.advanceTimersByTimeAsync(BULK_SEND_DEADLINE_MS - 1);
    expect(rejected).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await observed;

    expect(rejected).toBe(true);
    expect(capturedSignal?.aborted).toBe(true);
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
            // Never settles and never subscribes to the signal.
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

    (resolveText as ((value: string) => void) | null)?.(
      '{"success":true,"status":"SENT"}',
    );
    await vi.advanceTimersByTimeAsync(0);

    await expect(outcome).resolves.toBe('rejected');

    tracker.stop();
    expect(tracker.unhandled).toEqual([]);
  });

  // E. Parsing crosses the deadline -------------------------------------------

  it('E: the REAL JSON.parse runs and the POST-parse monotonic check rejects a result that finished late', async () => {
    // A controlled monotonic clock. The production code reads it at start, at
    // the pre-parse check and at the post-parse check.
    let monotonicMs = 0;

    const performanceSpy = vi
      .spyOn(performance, 'now')
      .mockImplementation(() => monotonicMs);

    const originalParse = JSON.parse;
    let parseCallCount = 0;
    let parseReturnValue: unknown = null;

    // A narrowly scoped wrapper that delegates to the REAL parser and advances
    // the monotonic clock DURING the parse (simulating synchronous work that
    // crosses the deadline while the event loop is blocked).
    const parseSpy = vi
      .spyOn(JSON, 'parse')
      .mockImplementation((text: string, reviver?: unknown) => {
        parseCallCount += 1;

        const parsed = originalParse(text, reviver as never);
        parseReturnValue = parsed;

        // Parsing itself crossed the deadline.
        monotonicMs = BULK_SEND_DEADLINE_MS + 1;

        return parsed;
      });

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

    // fetch + text settle while the monotonic clock is still below the deadline,
    // so the PRE-parse check passes and the parse is actually reached.
    monotonicMs = 100;
    await vi.advanceTimersByTimeAsync(0);

    // The public call rejects with the sanitized deadline error — from the
    // POST-parse check, not the pre-parse one.
    await expect(outcome).resolves.toBe('Request deadline exceeded');

    // The REAL parser ran exactly once and produced a valid SENT payload.
    expect(parseCallCount).toBe(1);
    expect(parseReturnValue).toEqual({ success: true, status: 'SENT' });

    expect(vi.getTimerCount()).toBe(0);

    parseSpy.mockRestore();
    performanceSpy.mockRestore();
  });

  it('E: a backwards WALL-clock jump cannot rescue a late parse — only monotonic time decides', async () => {
    // High wall clock at start, then moved BACKWARDS during the parse.
    let wallMs = 1_000_000;
    let monotonicMs = 0;

    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => wallMs);
    const performanceSpy = vi
      .spyOn(performance, 'now')
      .mockImplementation(() => monotonicMs);

    const originalParse = JSON.parse;

    vi.spyOn(JSON, 'parse').mockImplementation((text: string, reviver?: unknown) => {
      const parsed = originalParse(text, reviver as never);

      // Monotonic time crosses the deadline; the WALL clock moves BACKWARDS.
      monotonicMs = BULK_SEND_DEADLINE_MS + 1;
      wallMs = 900_000;

      return parsed;
    });

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

    monotonicMs = 100;
    await vi.advanceTimersByTimeAsync(0);

    // If the code used the wall clock, `wallMs` (900_000) < deadline
    // (1_060_000) would look "in time" and it would succeed. It must reject.
    await expect(outcome).resolves.toBe('Request deadline exceeded');

    expect(vi.getTimerCount()).toBe(0);

    dateSpy.mockRestore();
    performanceSpy.mockRestore();
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
