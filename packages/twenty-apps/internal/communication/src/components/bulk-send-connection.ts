import {
  runBulkSend,
  type BulkSendRecipient,
  type BulkSendRecipientResult,
  type BulkSendRunOutcome,
  type BulkSendSummary,
  type BulkSendTransport,
} from 'src/components/bulk-send-coordinator';

export type BulkSendProgressState = {
  /** True while the coordinator is working (a request may be in flight). */
  isRunning: boolean;
  /** Every confirmed recipient, with its current truthful result. */
  results: BulkSendRecipientResult[];
  /** Present only once the run has finished. */
  summary: BulkSendSummary | null;
};

export type BulkSendConnection = {
  /**
   * Starts the group. A second call while running is ignored without a request.
   */
  send: (parameters: {
    recipients: readonly BulkSendRecipient[];
    channel: string;
  }) => Promise<BulkSendRunOutcome>;
  /**
   * Requests a stop: no NEW recipient is started, and the recipient already in
   * flight is never relabelled as cancelled. On its own it does not start a run.
   */
  stop: () => void;
  /**
   * Used when the form closes/unmounts: same as `stop`, and it also clears any
   * pending results so a stale group can never be re-run by a later render.
   */
  invalidate: () => void;
};

/**
 * The composer's real bulk-send wiring: the same object the send button calls.
 * It owns the synchronous in-flight guard and the stop flag, and delegates the
 * actual sequencing to `runBulkSend`, so the button and the coordinator cannot
 * drift.
 */
export const createBulkSendConnection = (options: {
  transport: BulkSendTransport;
  onState: (state: BulkSendProgressState) => void;
}): BulkSendConnection => {
  // Synchronous guard: set before the first `await`, so two clicks in the same
  // tick cannot both start a run.
  const isRunningRef = { current: false };
  // Set by `stop()`/`invalidate()`; checked before each NEXT recipient.
  let stopRequested = false;

  const send: BulkSendConnection['send'] = async ({
    recipients,
    channel,
  }) => {
    // Checked BEFORE publishing anything: a second click in the same tick must
    // not reset the in-flight state of the run that is already going.
    if (isRunningRef.current) {
      return { kind: 'DUPLICATE_IGNORED' };
    }

    stopRequested = false;

    options.onState({ isRunning: true, results: [], summary: null });

    const outcome = await runBulkSend({
      recipients,
      channel,
      transport: options.transport,
      isRunningRef,
      shouldStop: () => stopRequested,
      onProgress: (results) =>
        options.onState({ isRunning: true, results, summary: null }),
    });

    if (outcome.kind === 'DUPLICATE_IGNORED') {
      // The in-flight run owns the state; this click changes nothing.
      return outcome;
    }

    options.onState({
      isRunning: false,
      results: outcome.summary.results,
      summary: outcome.summary,
    });

    return outcome;
  };

  const stop = (): void => {
    stopRequested = true;
  };

  const invalidate = (): void => {
    stopRequested = true;
    options.onState({ isRunning: false, results: [], summary: null });
  };

  return { send, stop, invalidate };
};
