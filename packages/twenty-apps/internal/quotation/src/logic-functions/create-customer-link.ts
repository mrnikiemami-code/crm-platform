import { defineLogicFunction } from 'twenty-sdk/define';

import { CREATE_CUSTOMER_LINK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Minting is owned by the signed-in user session bridge
// (`POST /rest/quotation/actions` + `create-customer-link`). An app token alone
// must never create a customer link.
const handler = async () => ({
  success: false,
  code: 'USE_USER_SESSION_BRIDGE',
  message:
    'صدور لینک مشتری فقط از مسیر کاربر واردشده مجاز است؛ توکن اپ کافی نیست.',
});

export default defineLogicFunction({
  universalIdentifier: CREATE_CUSTOMER_LINK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'create-customer-link',
  description:
    'مسدود: صدور لینک مشتری فقط از پل نشست کاربر (`/rest/quotation/actions`)',
  timeoutSeconds: 5,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/create-customer-link',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
