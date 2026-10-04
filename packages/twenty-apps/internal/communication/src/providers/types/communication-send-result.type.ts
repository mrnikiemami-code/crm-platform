// Normalized outcome a provider reports for one send. It intentionally does
// not duplicate the `communication` record: it describes only what the
// provider knows, and later orchestration maps it onto the record's status.
//
// `SENT` means the provider accepted the message; `DELIVERED` is only reported
// when the provider can confirm delivery at send time (see
// `supportsDeliveryReceipt`). `FAILED` carries a human-readable reason.
export type CommunicationSendResult =
  | { status: 'SENT'; providerMessageId: string | null }
  | { status: 'DELIVERED'; providerMessageId: string | null }
  | { status: 'FAILED'; failureReason: string };
