import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  RAZPAYAMAK_API_KEY_ENV_VAR,
  RAZPAYAMAK_SEND_URL,
  RAZPAYAMAK_SENDER_ENV_VAR,
  RAZPAYAMAK_USERNAME_ENV_VAR,
  getRazpayamakConfig,
} from 'src/providers/razpayamak/razpayamak.config';

const SAVED_ENV = { ...process.env };

const clearConfigVars = () => {
  delete process.env[RAZPAYAMAK_USERNAME_ENV_VAR];
  delete process.env[RAZPAYAMAK_API_KEY_ENV_VAR];
  delete process.env[RAZPAYAMAK_SENDER_ENV_VAR];
  // A workspace value must have no effect: the endpoint is a fixed constant.
  delete process.env.RAZPAYAMAK_ENDPOINT;
};

describe('getRazpayamakConfig', () => {
  beforeEach(clearConfigVars);

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  it('returns the configuration when every variable is set', () => {
    process.env[RAZPAYAMAK_USERNAME_ENV_VAR] = 'panel-user';
    process.env[RAZPAYAMAK_API_KEY_ENV_VAR] = 'secret-key';
    process.env[RAZPAYAMAK_SENDER_ENV_VAR] = '100020003000';

    expect(getRazpayamakConfig()).toEqual({
      success: true,
      config: {
        username: 'panel-user',
        apiKey: 'secret-key',
        sender: '100020003000',
      },
    });
  });

  it('exposes the production endpoint as a fixed constant, not a variable', () => {
    // A workspace value must never be able to redirect the ApiKey.
    process.env.RAZPAYAMAK_ENDPOINT = 'https://evil.example/v1';

    process.env[RAZPAYAMAK_USERNAME_ENV_VAR] = 'panel-user';
    process.env[RAZPAYAMAK_API_KEY_ENV_VAR] = 'secret-key';
    process.env[RAZPAYAMAK_SENDER_ENV_VAR] = '100020003000';

    const result = getRazpayamakConfig();

    expect(result.success).toBe(true);
    expect(RAZPAYAMAK_SEND_URL).toBe(
      'https://rest.payamak-panel.com/api/SendSMS/SendSMS',
    );
    expect(JSON.stringify(result)).not.toContain('evil.example');
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
