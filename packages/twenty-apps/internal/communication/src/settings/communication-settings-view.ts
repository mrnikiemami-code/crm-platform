import { SUPPORTED_COMMUNICATION_CHANNELS } from 'src/logic-functions/types/communication-channel-option.type';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';

// Providers this app actually implements. Unsupported providers must never
// appear as usable controls.
export const IMPLEMENTED_COMMUNICATION_PROVIDERS: {
  id: CommunicationProviderId;
  label: string;
}[] = [
  { id: 'razpayamak', label: 'RazPayamak' },
  { id: 'kavenegar', label: 'Kavenegar' },
];

export type CommunicationSettingsInput = {
  /** Non-secret: the configured default provider id, if any. */
  provider: string | undefined;
  kavenegar: { endpoint: string | undefined; sender: string | undefined };
  razpayamak: { username: string | undefined; sender: string | undefined };
};

export type CommunicationProviderSettingsRow = {
  id: CommunicationProviderId;
  label: string;
  isDefault: boolean;
  /** Whether the non-secret sender configuration for this provider is present. */
  isConfigured: boolean;
};

export type CommunicationSettingsView = {
  providerId: CommunicationProviderId | null;
  /** True when a known default provider is selected. */
  isProviderSelected: boolean;
  /** True when the selected provider has its sender configuration present. */
  isReady: boolean;
  readinessMessage: string;
  providers: CommunicationProviderSettingsRow[];
  channels: string[];
};

const readNonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const isImplementedProviderId = (
  value: string | null,
): value is CommunicationProviderId =>
  value !== null &&
  IMPLEMENTED_COMMUNICATION_PROVIDERS.some((provider) => provider.id === value);

const buildReadinessMessage = ({
  isProviderSelected,
  isReady,
}: {
  isProviderSelected: boolean;
  isReady: boolean;
}): string => {
  if (!isProviderSelected) {
    return 'No default provider is selected. Set COMMUNICATION_PROVIDER to an implemented provider.';
  }

  return isReady
    ? 'Ready to send.'
    : 'The selected provider is missing its sender configuration.';
};

/**
 * Builds the read-only settings view from the non-secret application variables
 * the platform exposes to a front component.
 *
 * It deliberately never receives a credential: secret values are filtered out
 * server-side before reaching the sandbox, so only presence of the non-secret
 * sender configuration can be reported.
 */
export const buildCommunicationSettingsView = (
  input: CommunicationSettingsInput,
): CommunicationSettingsView => {
  const providerIdRaw = readNonEmpty(input.provider);
  const providerId = isImplementedProviderId(providerIdRaw)
    ? providerIdRaw
    : null;

  const isKavenegarConfigured =
    readNonEmpty(input.kavenegar.endpoint) !== null &&
    readNonEmpty(input.kavenegar.sender) !== null;

  const isRazpayamakConfigured =
    readNonEmpty(input.razpayamak.username) !== null &&
    readNonEmpty(input.razpayamak.sender) !== null;

  const configurationByProvider: Record<CommunicationProviderId, boolean> = {
    kavenegar: isKavenegarConfigured,
    razpayamak: isRazpayamakConfigured,
  };

  const providers: CommunicationProviderSettingsRow[] =
    IMPLEMENTED_COMMUNICATION_PROVIDERS.map((provider) => ({
      id: provider.id,
      label: provider.label,
      isDefault: provider.id === providerId,
      isConfigured: configurationByProvider[provider.id],
    }));

  const isProviderSelected = providerId !== null;
  const isReady = isProviderSelected && configurationByProvider[providerId];

  return {
    providerId,
    isProviderSelected,
    isReady,
    readinessMessage: buildReadinessMessage({ isProviderSelected, isReady }),
    providers,
    channels: [...SUPPORTED_COMMUNICATION_CHANNELS],
  };
};
