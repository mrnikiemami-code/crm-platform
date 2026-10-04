import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';

// Channels the composer may offer. It mirrors the implemented channels only:
// unsupported channels must never appear as selectable dead controls.
export const SUPPORTED_COMMUNICATION_CHANNELS: CommunicationChannel[] = ['SMS'];
