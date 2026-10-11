import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { SEND_SETTINGS_TEST_SMS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { checkSettingsPermission } from 'src/settings/settings-permission';
import { sendSettingsTestSms } from 'src/settings/settings-test-sms.service';

// The settings test-send route. It runs the SAME provider path as the
// production send, but with no Person: no fake Person, no Communication record
// for an arbitrary number, and no Person timeline activity.
//
// Authorization is enforced SERVER-SIDE against the same workspace permission
// flag that gates the Communication settings page, before any provider
// dispatch, so a direct call cannot bypass the UI check.
type SendSettingsTestSmsRequest = {
  recipient?: unknown;
  body?: unknown;
};

const handler = async (event: RoutePayload<SendSettingsTestSmsRequest>) => {
  const permission = await checkSettingsPermission();

  if (!permission.allowed) {
    // A single, sanitized refusal. The specific reason (no user context vs.
    // not permitted) is not disclosed to the caller.
    return {
      success: false,
      failureCode: 'NOT_PERMITTED' as const,
      error: 'You do not have permission to send a test SMS.',
    };
  }

  const requestBody = event.body;

  if (requestBody === null || typeof requestBody !== 'object') {
    return { success: false, error: 'A JSON body is required.' };
  }

  return sendSettingsTestSms({
    recipient:
      typeof requestBody.recipient === 'string' ? requestBody.recipient : '',
    body: typeof requestBody.body === 'string' ? requestBody.body : '',
  });
};

export default defineLogicFunction({
  universalIdentifier:
    SEND_SETTINGS_TEST_SMS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'communication-send-settings-test-sms',
  description:
    'Sends one settings test SMS through the configured provider (no Person, no record).',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/communication/settings-test-sms',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
