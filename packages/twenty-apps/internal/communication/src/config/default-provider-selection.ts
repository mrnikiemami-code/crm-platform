import { readRequiredEnv } from 'src/providers/config/read-required-env';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';

// Non-secret server variable holding the provider id used when a caller does
// not choose one explicitly, e.g. `razpayamak`.
export const COMMUNICATION_PROVIDER_ENV_VAR = 'COMMUNICATION_PROVIDER';

const KNOWN_PROVIDER_IDS: readonly string[] = ['kavenegar', 'razpayamak'];

export const isCommunicationProviderId = (
  value: string,
): value is CommunicationProviderId => KNOWN_PROVIDER_IDS.includes(value);

export type ProviderSelectionResult =
  | { success: true; providerId: CommunicationProviderId }
  | { success: false; error: string };

// Resolves the configured default provider. It is a plain config lookup with no
// per-provider branching: the value is validated against the known ids so a
// typo fails explicitly instead of reaching the registry as an unknown id.
export const resolveConfiguredProviderId = (): ProviderSelectionResult => {
  const configured = readRequiredEnv(COMMUNICATION_PROVIDER_ENV_VAR);

  if (configured === undefined) {
    return {
      success: false,
      error: `No communication provider is selected. Set the ${COMMUNICATION_PROVIDER_ENV_VAR} application variable to one of: ${KNOWN_PROVIDER_IDS.join(', ')}.`,
    };
  }

  if (!isCommunicationProviderId(configured)) {
    return {
      success: false,
      error: `Unknown communication provider "${configured}". Supported providers: ${KNOWN_PROVIDER_IDS.join(', ')}.`,
    };
  }

  return { success: true, providerId: configured };
};
