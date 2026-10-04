import { type CommunicationCapabilities } from 'src/providers/types/communication-capabilities.type';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';

// The generic outbound boundary. Every future channel (WhatsApp, Telegram,
// Instagram, Bale) implements this same contract; nothing above it branches on
// the channel, so adding one is purely additive.
//
// This mirrors the shape of Twenty's core `MessageOutboundDriver` but is
// deliberately separate: that driver is email-shaped (`html`, `cc`,
// `inReplyTo`, threading headers) and extending it would force a core change.
export type CommunicationProvider = {
  /** Channel this provider sends on. Also its registry key. */
  readonly channel: CommunicationChannel;
  capabilities(): CommunicationCapabilities;
  send(message: OutboundCommunication): Promise<CommunicationSendResult>;
};
