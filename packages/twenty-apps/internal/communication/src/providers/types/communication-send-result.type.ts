// Normalized outcome a provider reports for one send. It intentionally does
// not duplicate the `communication` record: it describes only what the
// provider knows, and later orchestration maps it onto the record's status.
//
// `SENT` means the provider accepted the message; `DELIVERED` is only reported
// when the provider can confirm delivery at send time (see
// `supportsDeliveryReceipt`).
//
// `FAILED` is a DEFINITE provider rejection: the provider received the request
// and refused it, so it is safe to record as a failure. It may carry an
// optional stable `failureCode` (an app-owned classification) and sanitized
// untrusted provider detail; `failureReason` remains the human-readable text.
//
// `UNKNOWN` is the case the provider CANNOT classify: the request may or may
// not have reached the provider (a transport rejection after dispatch, a
// timeout, a body-read failure, a malformed/empty 2xx response, or a
// `RetStatus=1` without a usable recID). Callers must NOT present it as a
// definite failure, must NOT retry blindly, and the durable record must stay
// QUEUED rather than be overwritten with FAILED.
export type CommunicationSendResult =
  | { status: 'SENT'; providerMessageId: string | null }
  | { status: 'DELIVERED'; providerMessageId: string | null }
  | {
      status: 'FAILED';
      failureReason: string;
      /** Stable app-owned classification, when the provider supplies one. */
      failureCode?: string;
      /** Sanitized, untrusted provider text. Never translated copy. */
      providerDetail?: string;
      /** Numeric provider code, when the provider supplies one. */
      providerCode?: number;
    }
  | { status: 'UNKNOWN'; failureReason: string };
