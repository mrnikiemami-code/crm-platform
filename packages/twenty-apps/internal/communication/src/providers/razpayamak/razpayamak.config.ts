import {
  buildMissingConfigError,
  readRequiredEnv,
} from 'src/providers/config/read-required-env';
import { type ProviderConfigResult } from 'src/providers/config/provider-config-result.type';

// RazPayamak Smart REST credentials, per the official SmartSMS document:
// `username` is the panel account and `password` is the ApiKey issued under
// the developer menu. Both are stored as encrypted server variables.
export const RAZPAYAMAK_USERNAME_ENV_VAR = 'RAZPAYAMAK_USERNAME';
export const RAZPAYAMAK_API_KEY_ENV_VAR = 'RAZPAYAMAK_API_KEY';
export const RAZPAYAMAK_SENDER_ENV_VAR = 'RAZPAYAMAK_SENDER';
export const RAZPAYAMAK_BACKUP_SENDER_ONE_ENV_VAR =
  'RAZPAYAMAK_BACKUP_SENDER_ONE';
export const RAZPAYAMAK_BACKUP_SENDER_TWO_ENV_VAR =
  'RAZPAYAMAK_BACKUP_SENDER_TWO';

// The Smart service can hand off to two backup senders when the primary line
// fails. The REST base is fixed by the document; only credentials vary, so it
// is a constant rather than a variable.
export const RAZPAYAMAK_SMART_SEND_URL =
  'https://rest.payamak-panel.com/api/SmartSMS/Send';

export type RazpayamakConfig = {
  username: string;
  apiKey: string;
  sender: string;
  /** Optional backup sender lines; omitted from the request when unset. */
  fromSupportOne?: string;
  fromSupportTwo?: string;
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

    const fromSupportOne = readRequiredEnv(
      RAZPAYAMAK_BACKUP_SENDER_ONE_ENV_VAR,
    );
    const fromSupportTwo = readRequiredEnv(
      RAZPAYAMAK_BACKUP_SENDER_TWO_ENV_VAR,
    );

    return {
      success: true,
      config: {
        username,
        apiKey,
        sender,
        ...(fromSupportOne === undefined ? {} : { fromSupportOne }),
        ...(fromSupportTwo === undefined ? {} : { fromSupportTwo }),
      },
    };
  };
