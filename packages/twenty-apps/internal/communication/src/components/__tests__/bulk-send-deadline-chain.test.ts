import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBulkSendConnection } from 'src/components/bulk-send-connection';
import { type BulkSendProgressState } from 'src/components/bulk-send-connection';
import { type BulkSendRecipient } from 'src/components/bulk-send-coordinator';
import {
  BULK_SEND_DEADLINE_MS,
  callAppRoute,
} from 'src/components/composer-shared';

// INTEGRATED production-boundary test: the REAL connection + REAL coordinator
// + the REAL production `callAppRoute` deadline. Only the global `fetch` and
// the environment/API boundary are stubbed. This proves the actual chain:
//
//   createBulkSendConnection → runBulkSend → callAppRoute deadline
//     → UNKNOWN → no next recipient → late transport completion ignored
//
// A synthetic transport rejection would not prove this.
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

const recipient = (
  personId: string,
  phone: string,
  body: string,
): BulkSendRecipient => ({
  personId,
  displayName: personId,
  recipient: phone,
  body,
});

describe('integrated deadline chain (connection + coordinator + real callAppRoute)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.TWENTY_API_URL = 'http://localhost:3000';
    process.env.TWENTY_APP_ACCESS_TOKEN = 'test-token';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('rejects recipient one at the real deadline, keeps recipient two NOT_STARTED, and ignores a late SENT', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);

    let resolveFirstText: ((value: string) => void) | null = null;
    const fetchedPersonIds: string[] = [];

    // The REAL callAppRoute calls this fetch. Recipient one's body read NEVER
    // resolves and never subscribes to AbortSignal; the transport is otherwise
    // the production one.
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        personId: string;
      };

      fetchedPersonIds.push(body.personId);

      return {
        ok: true,
        status: 200,
        text: () =>
          new Promise<string>((resolve) => {
            resolveFirstText = resolve;
          }),
      };
    }) as unknown as typeof fetch;

    const states: BulkSendProgressState[] = [];

    const connection = createBulkSendConnection({
      transport: (request) =>
        callAppRoute('/communication/send', 'POST', request, {
          timeoutMs: BULK_SEND_DEADLINE_MS,
        }),
      onState: (state) => states.push(state),
    });

    let runCompleted = false;

    const run = connection
      .send({
        recipients: [
          recipient('p1', '09120000001', 'سلام سارا'),
          recipient('p2', '09120000002', 'سلام رضا'),
        ],
        channel: 'SMS',
      })
      .then((outcome) => {
        runCompleted = true;

        return outcome;
      });

    // Only recipient one's request is in flight.
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchedPersonIds).toEqual(['p1']);

    // Advance to the exact deadline.
    await vi.advanceTimersByTimeAsync(BULK_SEND_DEADLINE_MS);

    const outcome = await run;

    // The public run COMPLETED (did not remain pending).
    expect(runCompleted).toBe(true);
    expect(outcome.kind).toBe('COMPLETED');

    if (outcome.kind === 'COMPLETED') {
      expect(outcome.summary.results.map((r) => r.kind)).toEqual([
        'UNKNOWN',
        'NOT_STARTED',
      ]);
      expect(outcome.summary.isStopped).toBe(true);
      expect(outcome.summary.stopReason).toBe('UNKNOWN');
      expect(outcome.summary.unknownCount).toBe(1);
      expect(outcome.summary.notStartedCount).toBe(1);
    }

    // No request was made for recipient two.
    expect(fetchedPersonIds).toEqual(['p1']);

    // Capture the state at deadline completion for a deep-equality check later.
    const stateAtDeadline = states[states.length - 1];

    // Now resolve recipient one's LATE body with a valid SENT response.
    (resolveFirstText as ((value: string) => void) | null)?.(
      '{"success":true,"status":"SENT"}',
    );
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    // No second request starts.
    expect(fetchedPersonIds).toEqual(['p1']);

    // UNKNOWN is not replaced by SENT, and no new state publication occurs.
    const finalState = states[states.length - 1];

    expect(finalState).toEqual(stateAtDeadline);
    expect(
      finalState.results.map((result) => result.kind),
    ).toEqual(['UNKNOWN', 'NOT_STARTED']);

    // No deadline timer remains and no unhandled rejection was produced.
    expect(vi.getTimerCount()).toBe(0);

    process.off('unhandledRejection', onUnhandled);
    expect(unhandled).toEqual([]);
  });
});
