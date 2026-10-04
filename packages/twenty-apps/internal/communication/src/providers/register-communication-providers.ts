import { CommunicationProviderRegistry } from 'src/providers/communication-provider-registry';
import { KavenegarCommunicationProvider } from 'src/providers/kavenegar/kavenegar.provider';
import { RazpayamakCommunicationProvider } from 'src/providers/razpayamak/razpayamak.provider';

// The app-local wiring point: creates a registry and registers every provider
// this app ships. Kept as a factory (not a module-level singleton) so there is
// no hidden global mutable state and no dependency-injection changes.
//
// Both SMS providers are registered side by side; which one is used is decided
// by the caller or by the configured default, never here.
export const createCommunicationProviderRegistry =
  (): CommunicationProviderRegistry => {
    const registry = new CommunicationProviderRegistry();

    registry.register(new KavenegarCommunicationProvider());
    registry.register(new RazpayamakCommunicationProvider());

    return registry;
  };
