import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';

// Raised when a provider id has no registered provider. A missing provider is
// an explicit failure rather than a silent no-op, so a provider can never look
// available while nothing can actually send through it.
export class CommunicationProviderNotFoundError extends Error {
  readonly providerId: CommunicationProviderId;

  constructor(providerId: CommunicationProviderId) {
    super(`No communication provider registered with id "${providerId}".`);
    this.name = 'CommunicationProviderNotFoundError';
    this.providerId = providerId;
  }
}
