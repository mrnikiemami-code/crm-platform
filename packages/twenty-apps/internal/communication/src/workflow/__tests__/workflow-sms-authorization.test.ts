import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readWorkflowSmsAuthorization,
  WORKFLOW_SMS_SENDING_VARIABLE_NAME,
} from 'src/workflow/workflow-sms-authorization';

const SAVED_ENV = { ...process.env };

describe('readWorkflowSmsAuthorization', () => {
  beforeEach(() => {
    delete process.env[WORKFLOW_SMS_SENDING_VARIABLE_NAME];
  });

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  it('fails closed when the switch was never configured', () => {
    const result = readWorkflowSmsAuthorization();

    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.reason).toBe('NOT_CONFIGURED');
  });

  it('fails closed on an empty value', () => {
    process.env[WORKFLOW_SMS_SENDING_VARIABLE_NAME] = '   ';

    expect(readWorkflowSmsAuthorization().allowed).toBe(false);
  });

  it('refuses any value that is not exactly enabled', () => {
    for (const value of ['disabled', 'yes', 'true', '1', 'Enabled!']) {
      process.env[WORKFLOW_SMS_SENDING_VARIABLE_NAME] = value;

      const result = readWorkflowSmsAuthorization();

      expect(result.allowed).toBe(false);
      expect(result.allowed === false && result.reason).toBe('DISABLED');
    }
  });

  it('allows sending only when explicitly enabled, case and space insensitive', () => {
    for (const value of ['enabled', ' ENABLED ']) {
      process.env[WORKFLOW_SMS_SENDING_VARIABLE_NAME] = value;

      expect(readWorkflowSmsAuthorization()).toEqual({ allowed: true });
    }
  });

  it('does not depend on any user or member identity', () => {
    // The switch is workspace-scoped: no member id, user id or session is read,
    // so deactivating an employee cannot affect it.
    process.env[WORKFLOW_SMS_SENDING_VARIABLE_NAME] = 'enabled';

    delete process.env.TWENTY_APP_ACCESS_TOKEN;
    delete process.env.TWENTY_APP_APPLICATION_ACCESS_TOKEN;

    expect(readWorkflowSmsAuthorization().allowed).toBe(true);
  });
});
