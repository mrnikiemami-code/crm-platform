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

export type SendPersonCommunicationResponse = {
  success: boolean;
  /** Truthful outcome status; never upgrades SENT to DELIVERED. */
  status?: 'SENT' | 'DELIVERED' | 'FAILED';
  communicationId?: string;
  message?: string;
  error?: string;
};
