import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { KavenegarCommunicationProvider } from 'src/providers/kavenegar/kavenegar.provider';

// The app-local wiring point: creates a registry and registers every provider
// this app ships. Kept as a factory (not a module-level singleton) so there is
// no hidden global mutable state and no dependency-injection changes.
//
// Only providers that are actually implemented are registered; the registry is
// never populated with a stub just to appear non-empty.
export const createCommunicationProviderRegistry =
  (): CommunicationProviderRegistry => {
    const registry = new CommunicationProviderRegistry();

    registry.register(new KavenegarCommunicationProvider());

    return registry;
  };
