import { type CommunicationCapabilities } from 'src/providers/types/communication-capabilities.type';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';

// The generic outbound boundary. Every future channel and vendor implements
// this same contract; nothing above it branches on the provider or the
// channel, so adding one is purely additive.
//
// `id` identifies the implementation and `channel` declares what it can carry;
// both are needed because several providers may share one channel.
//
// This mirrors the shape of Twenty's core `MessageOutboundDriver` but is
// deliberately separate: that driver is email-shaped (`html`, `cc`,
// `inReplyTo`, threading headers) and extending it would force a core change.
export type CommunicationProvider = {
  /** Stable identity of this implementation, e.g. `razpayamak`. */
  readonly id: CommunicationProviderId;
  /** Channel this provider sends on. */
  readonly channel: CommunicationChannel;
  capabilities(): CommunicationCapabilities;
  send(message: OutboundCommunication): Promise<CommunicationSendResult>;
};
