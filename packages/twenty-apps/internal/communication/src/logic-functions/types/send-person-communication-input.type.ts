// Request body accepted by the `communication-send-message` route trigger.
// Only user-intent fields live here: the workspace and the sender are resolved
// server-side from trusted platform context and are deliberately NOT accepted
// from the client.
export type SendPersonCommunicationRequest = {
  personId?: unknown;
  channel?: unknown;
  recipient?: unknown;
  body?: unknown;
  subject?: unknown;
};

// Classification of a failed send, so a caller can distinguish a provider
// rejection from a history-write problem without seeing raw error text.
export type SendPersonCommunicationFailureCode =
  | 'INVALID_INPUT'
  | 'PERSON_NOT_ACCESSIBLE'
  | 'PROVIDER_FAILED'
  | 'OUTCOME_NOT_PERSISTED'
  | 'UNEXPECTED_FAILURE';

export type SendPersonCommunicationResponse = {
  success: boolean;
  /** Truthful outcome status; never upgrades SENT to DELIVERED. */
  status?: 'SENT' | 'DELIVERED' | 'FAILED';
  communicationId?: string;
  /** Stable failure classification, present only when `success` is false. */
  failureCode?: SendPersonCommunicationFailureCode;
  /**
   * Whether the provider outcome is known. When false, the caller must not
   * present the result as a definite failure and must not retry blindly.
   */
  isOutcomeKnown?: boolean;
  message?: string;
  error?: string;
};
