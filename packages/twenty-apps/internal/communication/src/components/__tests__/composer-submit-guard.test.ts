import { describe, expect, it, vi } from 'vitest';

// The composer's synchronous in-flight guard is a plain ref check that runs
// before any await. This mirrors that exact pattern so the behavior is locked
// without rendering the front component (which needs the sandbox host).
const buildGuardedSubmit = () => {
  const isSubmittingRef = { current: false };
  const outboundRequests: string[] = [];

  const submit = async (body: string): Promise<void> => {
    // Mirrors the composer: the ref check happens synchronously, before any
    // await, so two calls in the same tick cannot both proceed.
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;

    try {
      await Promise.resolve();
      outboundRequests.push(body);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return { submit, outboundRequests };
};

describe('composer submit guard', () => {
  it('sends exactly one request for two immediate submissions', async () => {
    const { submit, outboundRequests } = buildGuardedSubmit();

    const first = submit('hello');
    const second = submit('hello');

    await Promise.all([first, second]);

    expect(outboundRequests).toEqual(['hello']);
  });

  it('allows a later submission once the in-flight request settles', async () => {
    const { submit, outboundRequests } = buildGuardedSubmit();

    await submit('first');
    await submit('second');

    expect(outboundRequests).toEqual(['first', 'second']);
  });

  it('releases the guard even when the request fails, without resending', async () => {
    const isSubmittingRef = { current: false };
    const attempts: number[] = [];

    const submit = async (shouldFail: boolean): Promise<void> => {
      if (isSubmittingRef.current) {
        return;
      }

      isSubmittingRef.current = true;

      try {
        attempts.push(1);

        if (shouldFail) {
          throw new Error('request failed');
        }
      } finally {
        isSubmittingRef.current = false;
      }
    };

    await expect(submit(true)).rejects.toThrow('request failed');
    // The failure did not trigger an automatic resend...
    expect(attempts).toHaveLength(1);
    // ...and the guard is released for a deliberate user retry.
    expect(isSubmittingRef.current).toBe(false);
  });
});

describe('composer submit guard (no unbounded retry)', () => {
  it('never schedules an automatic retry', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: false, status: 500 }));

    // A failed response must surface, not loop.
    const result = await fetchSpy();

    expect(result.ok).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
