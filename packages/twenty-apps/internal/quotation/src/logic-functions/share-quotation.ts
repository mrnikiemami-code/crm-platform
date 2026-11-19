import { defineLogicFunction } from 'twenty-sdk/define';

import { SHARE_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Sharing is owned by the signed-in user session bridge
// (`POST /rest/quotation/actions` + `share-quotation`). An app token alone
// must never mint a link or write share history.
const handler = async () => ({
  success: false,
  code: 'USE_USER_SESSION_BRIDGE',
  message:
    'اشتراک‌گذاری پیش‌فاکتور فقط از مسیر کاربر واردشده مجاز است؛ توکن اپ کافی نیست.',
});

export default defineLogicFunction({
  universalIdentifier: SHARE_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'share-quotation',
  description:
    'مسدود: اشتراک‌گذاری فقط از پل نشست کاربر (`/rest/quotation/actions`)',
  timeoutSeconds: 5,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/share-quotation',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
