import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  KAVENEGAR_API_KEY_ENV_VAR,
  KAVENEGAR_ENDPOINT_ENV_VAR,
  KAVENEGAR_SENDER_ENV_VAR,
  getKavenegarConfig,
} from 'src/providers/kavenegar/kavenegar.config';

const SAVED_ENV = { ...process.env };

const clearConfigVars = () => {
  delete process.env[KAVENEGAR_ENDPOINT_ENV_VAR];
  delete process.env[KAVENEGAR_API_KEY_ENV_VAR];
  delete process.env[KAVENEGAR_SENDER_ENV_VAR];
};

describe('getKavenegarConfig', () => {
  beforeEach(clearConfigVars);

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  it('returns the configuration when every variable is set', () => {
    process.env[KAVENEGAR_ENDPOINT_ENV_VAR] =
      'https://api.kavenegar.test/v1/';
    process.env[KAVENEGAR_API_KEY_ENV_VAR] = 'secret-key';
    process.env[KAVENEGAR_SENDER_ENV_VAR] = '10004346';

    expect(getKavenegarConfig()).toEqual({
      success: true,
      // A trailing slash would produce a double slash in the send URL.
      config: {
        endpoint: 'https://api.kavenegar.test/v1',
        apiKey: 'secret-key',
        sender: '10004346',
      },
    });
  });

  it('fails explicitly and names the missing variables', () => {
    process.env[KAVENEGAR_ENDPOINT_ENV_VAR] = 'https://api.kavenegar.test/v1';

    const result = getKavenegarConfig();

    expect(result).toEqual({
      success: false,
      error:
        'Kavenegar is not configured. Set the following application variable(s): KAVENEGAR_API_KEY, KAVENEGAR_SENDER.',
    });
  });

  it('never includes a configured value in the failure message', () => {
    process.env[KAVENEGAR_API_KEY_ENV_VAR] = 'secret-key';

    const result = getKavenegarConfig();

    expect(JSON.stringify(result)).not.toContain('secret-key');
  });

  it('treats an empty value as unset', () => {
    process.env[KAVENEGAR_ENDPOINT_ENV_VAR] = 'https://api.kavenegar.test/v1';
    process.env[KAVENEGAR_API_KEY_ENV_VAR] = '';
    process.env[KAVENEGAR_SENDER_ENV_VAR] = '10004346';

    expect(getKavenegarConfig().success).toBe(false);
  });
});
