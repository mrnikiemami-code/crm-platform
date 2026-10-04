// Names of the encrypted server variables declared in `defineApplication`.
// Twenty injects their values into the function runtime environment, so they
// are read from `process.env` and never stored on a workspace record.
export const COMMUNICATION_PROVIDER_ENDPOINT_ENV_VAR =
  'COMMUNICATION_PROVIDER_ENDPOINT';
export const COMMUNICATION_PROVIDER_API_KEY_ENV_VAR =
  'COMMUNICATION_PROVIDER_API_KEY';
export const COMMUNICATION_PROVIDER_SENDER_ENV_VAR =
  'COMMUNICATION_PROVIDER_SENDER';

export type CommunicationConfig = {
  /** Provider base endpoint, without a trailing slash. */
  endpoint: string;
  apiKey: string;
  /** Sender identity the provider sends from, e.g. a phone number. */
  sender: string;
};

export type CommunicationConfigResult =
  | { success: true; config: CommunicationConfig }
  | { success: false; error: string };

const readRequired = (name: string): string | undefined => {
  const value = process.env[name];

  return value === undefined || value.length === 0 ? undefined : value;
};

// Returns an explicit failure when configuration is missing. The error names
// the missing variable but never includes a configured value, so the API key
// cannot leak through a failure message.
export const getCommunicationConfig = (): CommunicationConfigResult => {
  const endpoint = readRequired(COMMUNICATION_PROVIDER_ENDPOINT_ENV_VAR);
  const apiKey = readRequired(COMMUNICATION_PROVIDER_API_KEY_ENV_VAR);
  const sender = readRequired(COMMUNICATION_PROVIDER_SENDER_ENV_VAR);

  const missing: string[] = [];

  if (endpoint === undefined) {
    missing.push(COMMUNICATION_PROVIDER_ENDPOINT_ENV_VAR);
  }

  if (apiKey === undefined) {
    missing.push(COMMUNICATION_PROVIDER_API_KEY_ENV_VAR);
  }

  if (sender === undefined) {
    missing.push(COMMUNICATION_PROVIDER_SENDER_ENV_VAR);
  }

  if (
    endpoint === undefined ||
    apiKey === undefined ||
    sender === undefined
  ) {
    return {
      success: false,
      error: `Communication is not configured. Set the following application variable(s): ${missing.join(', ')}.`,
    };
  }

  return {
    success: true,
    config: {
      endpoint: endpoint.replace(/\/+$/, ''),
      apiKey,
      sender,
    },
  };
};
