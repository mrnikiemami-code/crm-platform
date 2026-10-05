// Production submission logic for the Person composer. It is kept out of the
// React component so the exact behavior that ships can be unit-tested without
// the front-component sandbox.

export type SubmitPersonCommunicationRequest = {
  personId: string;
  channel: string;
  recipient: string;
  body: string;
};

export type SubmitTransportResponse = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
};

export type SubmitTransport = (
  request: SubmitPersonCommunicationRequest,
) => Promise<SubmitTransportResponse>;

// Truthful classification of a submission. `kind` is what the UI must present;
// nothing here ever upgrades a known outcome or invents a definite failure.
export type SubmitPersonCommunicationOutcome =
  | { kind: 'SENT' }
  | { kind: 'DELIVERED' }
  /** Provider rejected the message; the outcome is known. */
  | { kind: 'PROVIDER_FAILED'; message: string }
  /** Sent, but the result could not be recorded. Do not retry automatically. */
  | { kind: 'SENT_BUT_UNRECORDED'; message: string }
  /** Provider rejected it and the failure could not be recorded. */
  | { kind: 'FAILED_BUT_UNRECORDED'; message: string }
  /** The send may or may not have happened; verify history before retrying. */
  | { kind: 'OUTCOME_UNKNOWN'; message: string }
  /** Rejected before any send was attempted. */
  | { kind: 'INVALID_INPUT'; message: string };

const OUTCOME_UNKNOWN_MESSAGE =
  'The message may or may not have been sent. Check the communication history before retrying.';

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

// Interprets a successful HTTP response into a truthful outcome. Exported so
// the mapping itself is testable in isolation.
export const classifySubmitResponse = (
  data: Record<string, unknown>,
): SubmitPersonCommunicationOutcome => {
  if (data.success === true) {
    return data.status === 'DELIVERED'
      ? { kind: 'DELIVERED' }
      : { kind: 'SENT' };
  }

  const message = readString(data.error);

  // A known provider outcome that could not be recorded is not a plain
  // failure, and must never be presented as "not sent".
  if (data.failureCode === 'OUTCOME_NOT_PERSISTED') {
    if (data.status === 'FAILED') {
      return {
        kind: 'FAILED_BUT_UNRECORDED',
        message:
          message ??
          'The provider rejected the message and the failure could not be recorded. Do not retry automatically.',
      };
    }

    return {
      kind: 'SENT_BUT_UNRECORDED',
      message:
        message ??
        'The message was sent but its result could not be recorded. Do not retry automatically.',
    };
  }

  if (data.isOutcomeKnown === false) {
    return { kind: 'OUTCOME_UNKNOWN', message: message ?? OUTCOME_UNKNOWN_MESSAGE };
  }

  return {
    kind: 'PROVIDER_FAILED',
    message: message ?? 'The message could not be sent.',
  };
};

export type SubmitPersonCommunicationDependencies = {
  /** Transport to the app route. Injected so tests avoid the sandbox. */
  transport: SubmitTransport;
  /** Optional synchronous in-flight guard shared across submissions. */
  isSubmittingRef?: { current: boolean };
};

/**
 * Submits one communication and returns its truthful outcome.
 *
 * The in-flight guard is checked synchronously, before any `await`, so two
 * immediate calls cannot both reach the transport. It is released only after
 * the request settles, and a failure never triggers an automatic resend.
 */
export const submitPersonCommunication = async (
  request: SubmitPersonCommunicationRequest,
  dependencies: SubmitPersonCommunicationDependencies,
): Promise<SubmitPersonCommunicationOutcome> => {
  const guard = dependencies.isSubmittingRef;

  if (guard?.current === true) {
    // A duplicate submission is ignored; the caller keeps its pending UI.
    return { kind: 'OUTCOME_UNKNOWN', message: OUTCOME_UNKNOWN_MESSAGE };
  }

  if (guard !== undefined) {
    guard.current = true;
  }

  try {
    const response = await dependencies.transport(request);

    return classifySubmitResponse(response.data);
  } catch {
    // A transport or response-parsing failure means the send may have
    // happened: never claim it did not.
    return { kind: 'OUTCOME_UNKNOWN', message: OUTCOME_UNKNOWN_MESSAGE };
  } finally {
    if (guard !== undefined) {
      guard.current = false;
    }
  }
};
