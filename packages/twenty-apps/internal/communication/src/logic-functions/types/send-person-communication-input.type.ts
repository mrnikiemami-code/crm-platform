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
  /**
   * The object the record was selected from, as reported by the host's command
   * context. When present the send is CONTEXTUAL: the recipient, the source
   * values and the final text come from that record, so the client cannot
   * substitute a different person or a different text.
   */
  contextObjectName?: unknown;
  contextRecordId?: unknown;
  contextRelationUid?: unknown;
};

// Classification of a failed send, so a caller can distinguish a provider
// rejection from a history-write problem without seeing raw error text.
export type SendPersonCommunicationFailureCode =
  | 'INVALID_INPUT'
  | 'PERSON_NOT_ACCESSIBLE'
  | 'TEMPLATE_VARIABLE_UNRESOLVED'
  | 'TEMPLATE_CONTEXT_MISMATCH'
  | 'PROVIDER_FAILED'
  | 'OUTCOME_UNKNOWN'
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
   * Stable provider failure classification (e.g. a RazPayamak `Value` code),
   * present only for a definite provider rejection.
   */
  providerFailureCode?: string;
  /**
   * Whether the provider outcome is known. When false, the caller must not
   * present the result as a definite failure and must not retry blindly.
   */
  isOutcomeKnown?: boolean;
  /**
   * The literal variable tokens that could not be resolved for this recipient.
   * Present only for `TEMPLATE_VARIABLE_UNRESOLVED`.
   */
  unresolvedVariables?: string[];
  message?: string;
  error?: string;
};
