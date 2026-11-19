import { defineLogicFunction } from 'twenty-sdk/define';

import { REVOKE_CUSTOMER_LINK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Revoke follows the same user-session bridge as mint. App-token callers are refused.
const handler = async () => ({
  success: false,
  code: 'USE_USER_SESSION_BRIDGE',
  message:
    'لغو لینک مشتری فقط از مسیر کاربر واردشده مجاز است؛ توکن اپ کافی نیست.',
});

export default defineLogicFunction({
  universalIdentifier: REVOKE_CUSTOMER_LINK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'revoke-customer-link',
  description:
    'مسدود: لغو لینک مشتری فقط از پل نشست کاربر (`/rest/quotation/actions`)',
  timeoutSeconds: 5,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/revoke-customer-link',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
