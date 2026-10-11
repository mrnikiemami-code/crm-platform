import {
  buildMissingConfigError,
  readRequiredEnv,
} from 'src/providers/config/read-required-env';
import { type ProviderConfigResult } from 'src/providers/config/provider-config-result.type';

// RazPayamak REST credentials, per the official REST webservice document
// (`docs/providers/razpayamak-rest-webservice.pdf`): `username` is the panel
// account and `password` is the ApiKey issued under the developer menu. Both
// are stored as encrypted server variables.
export const RAZPAYAMAK_USERNAME_ENV_VAR = 'RAZPAYAMAK_USERNAME';
export const RAZPAYAMAK_API_KEY_ENV_VAR = 'RAZPAYAMAK_API_KEY';
export const RAZPAYAMAK_SENDER_ENV_VAR = 'RAZPAYAMAK_SENDER';

// The send endpoint is configurable so a workspace can point it at a mock or an
// alternate host without a code change. When unset it falls back to the
// official REST endpoint from the document.
export const RAZPAYAMAK_ENDPOINT_ENV_VAR = 'RAZPAYAMAK_ENDPOINT';
export const RAZPAYAMAK_DEFAULT_SEND_URL =
  'https://rest.payamak-panel.com/api/SendSMS/SendSMS';

export type RazpayamakConfig = {
  /** Full `SendSMS` endpoint, without a trailing slash. */
  endpoint: string;
  username: string;
  apiKey: string;
  sender: string;
};

export const getRazpayamakConfig =
  (): ProviderConfigResult<RazpayamakConfig> => {
    const username = readRequiredEnv(RAZPAYAMAK_USERNAME_ENV_VAR);
    const apiKey = readRequiredEnv(RAZPAYAMAK_API_KEY_ENV_VAR);
    const sender = readRequiredEnv(RAZPAYAMAK_SENDER_ENV_VAR);

    const missing: string[] = [];

    if (username === undefined) {
      missing.push(RAZPAYAMAK_USERNAME_ENV_VAR);
    }

    if (apiKey === undefined) {
      missing.push(RAZPAYAMAK_API_KEY_ENV_VAR);
    }

    if (sender === undefined) {
      missing.push(RAZPAYAMAK_SENDER_ENV_VAR);
    }

    if (
      username === undefined ||
      apiKey === undefined ||
      sender === undefined
    ) {
      return {
        success: false,
        error: buildMissingConfigError('RazPayamak', missing),
      };
    }

    const configuredEndpoint = readRequiredEnv(RAZPAYAMAK_ENDPOINT_ENV_VAR);

    return {
      success: true,
      config: {
        endpoint: (configuredEndpoint ?? RAZPAYAMAK_DEFAULT_SEND_URL).replace(
          /\/+$/,
          '',
        ),
        username,
        apiKey,
        sender,
      },
    };
  };
