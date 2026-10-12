import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { CHECK_SETTINGS_TEST_SMS_DELIVERY_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { lookupRazpayamakDelivery } from 'src/providers/razpayamak/razpayamak-delivery.service';
import { checkSettingsPermission } from 'src/settings/settings-permission';

// The settings delivery-status route. It looks up ONE previously-accepted
// message by its recID through RazPayamak `GetDeliveries2` (read-only, never
// sends) and returns a truthful state: `DELIVERED` only when the provider
// confirms the phone received it.
//
// Authorization is enforced SERVER-SIDE against the same workspace permission
// flag that gates the settings page, before any provider call.
type CheckSettingsTestSmsDeliveryRequest = {
  providerMessageId?: unknown;
};

const handler = async (
  event: RoutePayload<CheckSettingsTestSmsDeliveryRequest>,
) => {
  const permission = await checkSettingsPermission();

  if (!permission.allowed) {
    return {
      success: false,
      failureCode: 'NOT_PERMITTED' as const,
      error: 'You do not have permission to check a message status.',
    };
  }

  const requestBody = event.body;

  if (requestBody === null || typeof requestBody !== 'object') {
    return { success: false, error: 'A JSON body is required.' };
  }

  const recId =
    typeof requestBody.providerMessageId === 'string'
      ? requestBody.providerMessageId.trim()
      : '';

  // A recID is the provider's own positive integer message id.
  if (recId.length === 0 || !/^[0-9]+$/.test(recId)) {
    return {
      success: false,
      failureCode: 'INVALID_RECIPIENT' as const,
      error: 'A valid provider message ID is required.',
    };
  }

  return lookupRazpayamakDelivery(recId);
};

export default defineLogicFunction({
  universalIdentifier:
    CHECK_SETTINGS_TEST_SMS_DELIVERY_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'communication-check-settings-test-sms-delivery',
  description:
    'Looks up the delivery status of one settings test SMS by its provider message id (read-only).',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/communication/settings-test-sms-delivery',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
