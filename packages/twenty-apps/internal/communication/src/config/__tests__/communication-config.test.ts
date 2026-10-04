import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  COMMUNICATION_PROVIDER_API_KEY_ENV_VAR,
  COMMUNICATION_PROVIDER_ENDPOINT_ENV_VAR,
  COMMUNICATION_PROVIDER_SENDER_ENV_VAR,
  getCommunicationConfig,
} from 'src/config/communication-config';

const SAVED_ENV = { ...process.env };

const clearConfigVars = () => {
  delete process.env[COMMUNICATION_PROVIDER_ENDPOINT_ENV_VAR];
  delete process.env[COMMUNICATION_PROVIDER_API_KEY_ENV_VAR];
  delete process.env[COMMUNICATION_PROVIDER_SENDER_ENV_VAR];
};

describe('getCommunicationConfig', () => {
  beforeEach(clearConfigVars);

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  it('returns the configuration when every variable is set', () => {
    process.env[COMMUNICATION_PROVIDER_ENDPOINT_ENV_VAR] =
      'https://api.kavenegar.test/v1/';
    process.env[COMMUNICATION_PROVIDER_API_KEY_ENV_VAR] = 'secret-key';
    process.env[COMMUNICATION_PROVIDER_SENDER_ENV_VAR] = '10004346';

    const result = getCommunicationConfig();

    expect(result.success).toBe(true);
    expect(result).toHaveProperty('config', {
      // A trailing slash would produce a double slash in the send URL.
      endpoint: 'https://api.kavenegar.test/v1',
      apiKey: 'secret-key',
      sender: '10004346',
    });
  });

  it('fails explicitly and names the missing variables', () => {
    process.env[COMMUNICATION_PROVIDER_ENDPOINT_ENV_VAR] =
      'https://api.kavenegar.test/v1';

    const result = getCommunicationConfig();

    expect(result.success).toBe(false);
    expect(result).toHaveProperty(
      'error',
      'Communication is not configured. Set the following application variable(s): COMMUNICATION_PROVIDER_API_KEY, COMMUNICATION_PROVIDER_SENDER.',
    );
  });

  it('never includes a configured value in the failure message', () => {
    process.env[COMMUNICATION_PROVIDER_API_KEY_ENV_VAR] = 'secret-key';

    const result = getCommunicationConfig();

    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret-key');
  });

  it('treats an empty value as unset', () => {
    process.env[COMMUNICATION_PROVIDER_ENDPOINT_ENV_VAR] =
      'https://api.kavenegar.test/v1';
    process.env[COMMUNICATION_PROVIDER_API_KEY_ENV_VAR] = '';
    process.env[COMMUNICATION_PROVIDER_SENDER_ENV_VAR] = '10004346';

    expect(getCommunicationConfig().success).toBe(false);
  });
});
