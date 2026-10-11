import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  RAZPAYAMAK_API_KEY_ENV_VAR,
  RAZPAYAMAK_DEFAULT_SEND_URL,
  RAZPAYAMAK_ENDPOINT_ENV_VAR,
  RAZPAYAMAK_SENDER_ENV_VAR,
  RAZPAYAMAK_USERNAME_ENV_VAR,
  getRazpayamakConfig,
} from 'src/providers/razpayamak/razpayamak.config';

const SAVED_ENV = { ...process.env };

const clearConfigVars = () => {
  delete process.env[RAZPAYAMAK_ENDPOINT_ENV_VAR];
  delete process.env[RAZPAYAMAK_USERNAME_ENV_VAR];
  delete process.env[RAZPAYAMAK_API_KEY_ENV_VAR];
  delete process.env[RAZPAYAMAK_SENDER_ENV_VAR];
};

describe('getRazpayamakConfig', () => {
  beforeEach(clearConfigVars);

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  it('returns the configuration when every variable is set', () => {
    process.env[RAZPAYAMAK_ENDPOINT_ENV_VAR] =
      'https://rest.payamak-panel.test/api/SendSMS/SendSMS/';
    process.env[RAZPAYAMAK_USERNAME_ENV_VAR] = 'panel-user';
    process.env[RAZPAYAMAK_API_KEY_ENV_VAR] = 'secret-key';
    process.env[RAZPAYAMAK_SENDER_ENV_VAR] = '100020003000';

    expect(getRazpayamakConfig()).toEqual({
      success: true,
      config: {
        // A trailing slash would produce a double slash in the send URL.
        endpoint: 'https://rest.payamak-panel.test/api/SendSMS/SendSMS',
        username: 'panel-user',
        apiKey: 'secret-key',
        sender: '100020003000',
      },
    });
  });

  it('falls back to the official endpoint when none is configured', () => {
    process.env[RAZPAYAMAK_USERNAME_ENV_VAR] = 'panel-user';
    process.env[RAZPAYAMAK_API_KEY_ENV_VAR] = 'secret-key';
    process.env[RAZPAYAMAK_SENDER_ENV_VAR] = '100020003000';

    const result = getRazpayamakConfig();

    expect(result.success).toBe(true);
    expect(result.success && result.config.endpoint).toBe(
      RAZPAYAMAK_DEFAULT_SEND_URL,
    );
  });

  it('fails explicitly and names the missing variables', () => {
    process.env[RAZPAYAMAK_USERNAME_ENV_VAR] = 'panel-user';

    const result = getRazpayamakConfig();

    expect(result).toEqual({
      success: false,
      error:
        'RazPayamak is not configured. Set the following application variable(s): RAZPAYAMAK_API_KEY, RAZPAYAMAK_SENDER.',
    });
  });

  it('never includes a configured value in the failure message', () => {
    process.env[RAZPAYAMAK_API_KEY_ENV_VAR] = 'secret-key';

    const result = getRazpayamakConfig();

    expect(JSON.stringify(result)).not.toContain('secret-key');
  });

  it('treats an empty value as unset', () => {
    process.env[RAZPAYAMAK_USERNAME_ENV_VAR] = 'panel-user';
    process.env[RAZPAYAMAK_API_KEY_ENV_VAR] = '';
    process.env[RAZPAYAMAK_SENDER_ENV_VAR] = '100020003000';

    expect(getRazpayamakConfig().success).toBe(false);
  });
});
