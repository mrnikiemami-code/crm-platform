// Minimal description of what a provider can do. Deliberately small: it only
// carries the differences later orchestration needs to branch on, so a new
// channel is not forced to model the whole messaging universe up front.
export type CommunicationCapabilities = {
  /** Whether the channel carries a subject alongside the body. */
  supportsSubject: boolean;
  /** Whether the provider reports delivery separately from acceptance. */
  supportsDeliveryReceipt: boolean;
};
