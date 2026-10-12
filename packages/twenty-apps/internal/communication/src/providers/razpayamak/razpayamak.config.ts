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

// The production send endpoint is FIXED by the official document. It is a
// constant, never a workspace variable, so a workspace cannot redirect the
// ApiKey to an arbitrary URL. Tests override it only through the provider's
// injected `sendUrl` dependency; there is no user-editable endpoint.
export const RAZPAYAMAK_SEND_URL =
  'https://rest.payamak-panel.com/api/SendSMS/SendSMS';

// The delivery-status endpoint (`GetDeliveries2`), also fixed by the document.
export const RAZPAYAMAK_DELIVERY_URL =
  'https://rest.payamak-panel.com/api/SendSMS/GetDeliveries2';

export type RazpayamakConfig = {
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

    return { success: true, config: { username, apiKey, sender } };
  };
