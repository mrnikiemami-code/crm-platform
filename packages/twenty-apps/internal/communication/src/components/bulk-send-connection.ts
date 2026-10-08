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
  /** The recipient whose request is in flight, or `null` between requests. */
  currentPersonId: string | null;
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
   * Used when the form closes/unmounts: same as `stop`, and it also DISPOSES the
   * connection so no later publication (not even the in-flight run's) can reach
   * the caller's state.
   */
  invalidate: () => void;
};

/**
 * The composer's real bulk-send wiring: the same object the send button calls.
 *
 * It owns the synchronous in-flight guard and the stop flag, delegates the
 * sequencing to `runBulkSend`, and adds a MONOTONIC run id so a superseded run
 * can never publish over a newer one or after disposal. This is what keeps the
 * button, the coordinator and the UI from drifting.
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
  // Every run gets a new id; only the LATEST run may publish state.
  let latestRunId = 0;
  // Once disposed (unmount/close), no publication is allowed at all.
  let isDisposed = false;

  const publish = (runId: number, state: BulkSendProgressState): void => {
    if (isDisposed || runId !== latestRunId) {
      return;
    }

    options.onState(state);
  };

  const send: BulkSendConnection['send'] = async ({
    recipients,
    channel,
  }) => {
    // Checked BEFORE publishing anything: a second click in the same tick must
    // not reset the in-flight state of the run that is already going.
    if (isRunningRef.current || isDisposed) {
      return { kind: 'DUPLICATE_IGNORED' };
    }

    latestRunId += 1;
    const runId = latestRunId;

    stopRequested = false;

    publish(runId, {
      isRunning: true,
      results: [],
      currentPersonId: null,
      summary: null,
    });

    const outcome = await runBulkSend({
      recipients,
      channel,
      transport: options.transport,
      isRunningRef,
      shouldStop: () => stopRequested,
      onProgress: (progress) =>
        publish(runId, {
          isRunning: true,
          results: progress.results,
          currentPersonId: progress.currentPersonId,
          summary: null,
        }),
    });

    if (outcome.kind === 'DUPLICATE_IGNORED') {
      // The in-flight run owns the state; this click changes nothing.
      return outcome;
    }

    // The FINAL publication keeps the last results visible even when stopped,
    // and attaches the summary so the UI can switch to the finished view.
    publish(runId, {
      isRunning: false,
      results: outcome.summary.results,
      currentPersonId: null,
      summary: outcome.summary,
    });

    return outcome;
  };

  const stop = (): void => {
    stopRequested = true;
  };

  const invalidate = (): void => {
    stopRequested = true;
    isDisposed = true;
  };

  return { send, stop, invalidate };
};
