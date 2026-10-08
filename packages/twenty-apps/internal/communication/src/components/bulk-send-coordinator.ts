import {
  classifySubmitResponse,
  type SubmitTransportResponse,
} from 'src/components/submit-person-communication';

// One recipient as it was CONFIRMED. The coordinator copies these into its own
// snapshot at start, so nothing that happens to the form afterwards (editing
// the text, switching a number, removing someone) can change what is sent.
export type BulkSendRecipient = {
  personId: string;
  displayName: string;
  /** The exact destination confirmed for this recipient. */
  recipient: string;
  /** The exact final text confirmed for this recipient. */
  body: string;
};

export type BulkSendRequest = {
  personId: string;
  channel: string;
  recipient: string;
  body: string;
};

/** Same shape as the single-send transport: the existing route's response. */
export type BulkSendTransport = (
  request: BulkSendRequest,
) => Promise<SubmitTransportResponse>;

/**
 * The truthful per-recipient result.
 *
 *  - ACCEPTED          — the provider accepted it (`SENT` or `DELIVERED`).
 *  - DEFINITE_FAILURE  — the provider rejected it (or the input was rejected);
 *                        the outcome is known.
 *  - UNKNOWN           — outcome unknown / timeout / missing response.
 *  - RECORDING_PROBLEM — the send happened (or failed) but its result could not
 *                        be recorded; the history cannot be trusted to be complete.
 *  - NOT_STARTED       — never attempted (the group stopped before it).
 *
 * `SENT` is NEVER reported as delivered: the two are distinct kinds.
 */
export type BulkSendRecipientResultKind =
  | 'ACCEPTED'
  | 'DEFINITE_FAILURE'
  | 'UNKNOWN'
  | 'RECORDING_PROBLEM'
  | 'NOT_STARTED';

export type BulkSendRecipientResult = {
  personId: string;
  displayName: string;
  recipient: string;
  body: string;
  kind: BulkSendRecipientResultKind;
  /** Present only for ACCEPTED; `SENT` and `DELIVERED` stay distinct. */
  status?: 'SENT' | 'DELIVERED';
  /** The server's own reason (verbatim) or the app's canonical wording. */
  message?: string;
};

export type BulkSendStopReason = 'UNKNOWN' | 'USER';

export type BulkSendSummary = {
  results: BulkSendRecipientResult[];
  acceptedCount: number;
  definiteFailureCount: number;
  unknownCount: number;
  notStartedCount: number;
  /** True when the group halted before attempting every recipient. */
  isStopped: boolean;
  stopReason: BulkSendStopReason | null;
};

export type BulkSendRunOutcome =
  | { kind: 'COMPLETED'; summary: BulkSendSummary }
  /** A run was already in flight; this click is ignored (no request is made). */
  | { kind: 'DUPLICATE_IGNORED' };

const UNKNOWN_MESSAGE =
  'The message may or may not have been sent. Check the communication history before retrying.';

const buildNotStarted = (
  recipient: BulkSendRecipient,
): BulkSendRecipientResult => ({
  personId: recipient.personId,
  displayName: recipient.displayName,
  recipient: recipient.recipient,
  body: recipient.body,
  kind: 'NOT_STARTED',
});

// Maps one truthful single-send outcome onto a bulk result. Only the ACCEPTED
// kinds continue the group; a definite failure continues (it must not hide the
// other results); an unknown outcome or a recording problem STOPS the group.
const toRecipientResult = ({
  recipient,
  outcome,
}: {
  recipient: BulkSendRecipient;
  outcome: ReturnType<typeof classifySubmitResponse>;
}): BulkSendRecipientResult => {
  const base = {
    personId: recipient.personId,
    displayName: recipient.displayName,
    recipient: recipient.recipient,
    body: recipient.body,
  };

  switch (outcome.kind) {
    case 'SENT':
      return { ...base, kind: 'ACCEPTED', status: 'SENT' };
    case 'DELIVERED':
      return { ...base, kind: 'ACCEPTED', status: 'DELIVERED' };
    case 'PROVIDER_FAILED':
    case 'INVALID_INPUT':
      return { ...base, kind: 'DEFINITE_FAILURE', message: outcome.message };
    case 'SENT_BUT_UNRECORDED':
    case 'FAILED_BUT_UNRECORDED':
      return { ...base, kind: 'RECORDING_PROBLEM', message: outcome.message };
    case 'OUTCOME_UNKNOWN':
      return { ...base, kind: 'UNKNOWN', message: outcome.message };
    case 'DUPLICATE_IGNORED':
      // The coordinator never routes through the single-send guard, so this is
      // unreachable; treating it as unknown is the safe fallback.
      return { ...base, kind: 'UNKNOWN', message: UNKNOWN_MESSAGE };
  }
};

/** A result that must stop the rest of the group. */
export const doesResultStopGroup = (
  kind: BulkSendRecipientResultKind,
): boolean => kind === 'UNKNOWN' || kind === 'RECORDING_PROBLEM';

const summarize = ({
  results,
  isStopped,
  stopReason,
}: {
  results: BulkSendRecipientResult[];
  isStopped: boolean;
  stopReason: BulkSendStopReason | null;
}): BulkSendSummary => ({
  results,
  acceptedCount: results.filter((result) => result.kind === 'ACCEPTED').length,
  definiteFailureCount: results.filter(
    (result) => result.kind === 'DEFINITE_FAILURE',
  ).length,
  unknownCount: results.filter(
    (result) => result.kind === 'UNKNOWN' || result.kind === 'RECORDING_PROBLEM',
  ).length,
  notStartedCount: results.filter((result) => result.kind === 'NOT_STARTED')
    .length,
  isStopped,
  stopReason,
});

export type RunBulkSendParameters = {
  /** The confirmed recipients, in the order they must be attempted. */
  recipients: readonly BulkSendRecipient[];
  channel: string;
  transport: BulkSendTransport;
  /** Called with a fresh snapshot of the results after every change. */
  onProgress?: (results: BulkSendRecipientResult[]) => void;
  /**
   * Checked SYNCHRONOUSLY before each recipient. Returning true stops before the
   * NEXT request; the in-flight one is never relabelled as cancelled.
   */
  shouldStop?: () => boolean;
  /**
   * Synchronous in-flight guard, shared with the caller. Set before the first
   * `await`, so a second click in the same tick is rejected without a request.
   */
  isRunningRef?: { current: boolean };
};

/**
 * Sends the confirmed recipients ONE BY ONE through the existing send route.
 *
 * It deliberately does NOT use `Promise.all` and never batches: each recipient
 * is awaited before the next starts, so a slow or failing provider cannot
 * produce overlapping sends and every result is attributable to one request.
 *
 * It also never retries or resumes: a recipient that was not attempted stays
 * `NOT_STARTED`, and an unknown outcome stops the group so a person is never
 * sent to twice by this run.
 */
export const runBulkSend = async (
  parameters: RunBulkSendParameters,
): Promise<BulkSendRunOutcome> => {
  const guard = parameters.isRunningRef;

  if (guard?.current === true) {
    return { kind: 'DUPLICATE_IGNORED' };
  }

  if (guard !== undefined) {
    guard.current = true;
  }

  try {
    // A private copy: later mutations of the caller's array cannot change what
    // this run sends.
    const snapshot = parameters.recipients.map((recipient) => ({ ...recipient }));

    const results: BulkSendRecipientResult[] = snapshot.map(buildNotStarted);

    const publish = (): void => {
      parameters.onProgress?.(results.map((result) => ({ ...result })));
    };

    publish();

    for (let index = 0; index < snapshot.length; index += 1) {
      // A user stop (or a closed form) prevents the NEXT request only.
      if (parameters.shouldStop?.() === true) {
        return {
          kind: 'COMPLETED',
          summary: summarize({ results, isStopped: true, stopReason: 'USER' }),
        };
      }

      const recipient = snapshot[index];

      let outcome: ReturnType<typeof classifySubmitResponse>;

      try {
        const response = await parameters.transport({
          personId: recipient.personId,
          channel: parameters.channel,
          recipient: recipient.recipient,
          body: recipient.body,
        });

        outcome = classifySubmitResponse(response.data);
      } catch {
        // A timeout / network failure means the send may have happened.
        outcome = { kind: 'OUTCOME_UNKNOWN', message: UNKNOWN_MESSAGE };
      }

      results[index] = toRecipientResult({ recipient, outcome });
      publish();

      if (doesResultStopGroup(results[index].kind)) {
        return {
          kind: 'COMPLETED',
          summary: summarize({
            results,
            isStopped: true,
            stopReason: 'UNKNOWN',
          }),
        };
      }
    }

    return {
      kind: 'COMPLETED',
      summary: summarize({ results, isStopped: false, stopReason: null }),
    };
  } finally {
    if (guard !== undefined) {
      guard.current = false;
    }
  }
};
