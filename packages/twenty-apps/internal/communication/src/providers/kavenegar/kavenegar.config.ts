import {
  buildMissingConfigError,
  readRequiredEnv,
} from 'src/providers/config/read-required-env';
import { type ProviderConfigResult } from 'src/providers/config/provider-config-result.type';

// Kavenegar's own encrypted server variables. Provider-specific configuration
// stays at the provider boundary, so RazPayamak does not depend on these.
export const KAVENEGAR_ENDPOINT_ENV_VAR = 'KAVENEGAR_ENDPOINT';
export const KAVENEGAR_API_KEY_ENV_VAR = 'KAVENEGAR_API_KEY';
export const KAVENEGAR_SENDER_ENV_VAR = 'KAVENEGAR_SENDER';

export type KavenegarConfig = {
  /** Base endpoint, without a trailing slash, e.g. https://api.kavenegar.com/v1 */
  endpoint: string;
  apiKey: string;
  sender: string;
};

export const getKavenegarConfig = (): ProviderConfigResult<KavenegarConfig> => {
  const endpoint = readRequiredEnv(KAVENEGAR_ENDPOINT_ENV_VAR);
  const apiKey = readRequiredEnv(KAVENEGAR_API_KEY_ENV_VAR);
  const sender = readRequiredEnv(KAVENEGAR_SENDER_ENV_VAR);

  const missing: string[] = [];

  if (endpoint === undefined) {
    missing.push(KAVENEGAR_ENDPOINT_ENV_VAR);
  }

  if (apiKey === undefined) {
    missing.push(KAVENEGAR_API_KEY_ENV_VAR);
  }

  if (sender === undefined) {
    missing.push(KAVENEGAR_SENDER_ENV_VAR);
  }

  if (
    endpoint === undefined ||
    apiKey === undefined ||
    sender === undefined
  ) {
    return {
      success: false,
      error: buildMissingConfigError('Kavenegar', missing),
    };
  }

  return {
    success: true,
    config: { endpoint: endpoint.replace(/\/+$/, ''), apiKey, sender },
  };
};
