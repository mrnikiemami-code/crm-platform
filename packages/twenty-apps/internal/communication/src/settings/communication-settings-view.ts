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
  /**
   * Whether the **non-secret** configuration fields this app can observe are
   * present. This is NOT a statement that the provider is usable: credentials
   * are secret and are never visible to frontend code, and no connectivity
   * check is performed.
   */
  hasVisibleConfiguration: boolean;
};

export type CommunicationSettingsView = {
  providerId: CommunicationProviderId | null;
  /** True when a known default provider is selected. */
  isProviderSelected: boolean;
  /** Plain statement of what was observed, with its limits spelled out. */
  observation: string;
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

/**
 * Describes only what can actually be observed from the non-secret variables a
 * front component may read.
 *
 * It deliberately does NOT report readiness: the presence of the visible fields
 * says nothing about whether the secret credential is set, and nothing at all
 * about connectivity to the provider. Both remain unverified.
 */
const buildObservation = ({
  isProviderSelected,
  hasVisibleConfiguration,
}: {
  isProviderSelected: boolean;
  hasVisibleConfiguration: boolean;
}): string => {
  if (!isProviderSelected) {
    return 'No default provider is selected. Set COMMUNICATION_PROVIDER to an implemented provider in the Variables tab.';
  }

  return hasVisibleConfiguration
    ? 'A default provider is selected and its non-secret configuration is present. Credential completeness and connectivity are NOT verified.'
    : 'A default provider is selected but its non-secret configuration is incomplete.';
};

/**
 * Builds the read-only settings view from the non-secret application variables
 * the platform exposes to a front component.
 *
 * It deliberately never receives a credential: secret values are filtered out
 * server-side before reaching the sandbox, so only presence of the non-secret
 * configuration can be reported.
 */
export const buildCommunicationSettingsView = (
  input: CommunicationSettingsInput,
): CommunicationSettingsView => {
  const providerIdRaw = readNonEmpty(input.provider);
  const providerId = isImplementedProviderId(providerIdRaw)
    ? providerIdRaw
    : null;

  const hasKavenegarConfiguration =
    readNonEmpty(input.kavenegar.endpoint) !== null &&
    readNonEmpty(input.kavenegar.sender) !== null;

  const hasRazpayamakConfiguration =
    readNonEmpty(input.razpayamak.username) !== null &&
    readNonEmpty(input.razpayamak.sender) !== null;

  const configurationByProvider: Record<CommunicationProviderId, boolean> = {
    kavenegar: hasKavenegarConfiguration,
    razpayamak: hasRazpayamakConfiguration,
  };

  const providers: CommunicationProviderSettingsRow[] =
    IMPLEMENTED_COMMUNICATION_PROVIDERS.map((provider) => ({
      id: provider.id,
      label: provider.label,
      isDefault: provider.id === providerId,
      hasVisibleConfiguration: configurationByProvider[provider.id],
    }));

  const isProviderSelected = providerId !== null;
  const hasVisibleConfiguration =
    isProviderSelected && configurationByProvider[providerId];

  return {
    providerId,
    isProviderSelected,
    observation: buildObservation({
      isProviderSelected,
      hasVisibleConfiguration,
    }),
    providers,
    channels: [...SUPPORTED_COMMUNICATION_CHANNELS],
  };
};
