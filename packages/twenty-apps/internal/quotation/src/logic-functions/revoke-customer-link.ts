import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { REVOKE_CUSTOMER_LINK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { executeRecordGraphql, RecordApiError } from 'src/data/record-api';
import { revokeCustomerLink } from 'src/services/customer-link.service';

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const handler = async (event: RoutePayload<unknown>) => {
  const body = asRecord(event.body);
  const linkId = readString(body.linkId);

  if (!process.env.TWENTY_API_URL || !process.env.TWENTY_APP_ACCESS_TOKEN) {
    return {
      success: false,
      code: 'APP_NOT_INSTALLED',
      message: 'برای لغو لینک مشتری، اپ باید روی فضای کاری نصب شود.',
    };
  }

  try {
    const revoked = await revokeCustomerLink(
      { linkId },
      { execute: executeRecordGraphql },
    );

    if (!revoked.ok) {
      return {
        success: false,
        code: revoked.refusal.code,
        message: 'لغو لینک مشتری انجام نشد',
      };
    }

    return {
      success: true,
      linkId: revoked.value.linkId,
      revokedAt: revoked.value.revokedAt,
      message: 'لینک مشتری لغو شد',
    };
  } catch (error) {
    if (error instanceof RecordApiError) {
      return {
        success: false,
        code: error.code,
        message:
          error.code === 'FORBIDDEN'
            ? 'دسترسی لازم برای لغو لینک وجود ندارد'
            : 'لغو لینک مشتری انجام نشد',
      };
    }

    return {
      success: false,
      code: 'CUSTOMER_LINK_REVOKE_FAILED',
      message: 'لغو لینک مشتری انجام نشد',
    };
  }
};

export default defineLogicFunction({
  universalIdentifier: REVOKE_CUSTOMER_LINK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'revoke-customer-link',
  description: 'لغو لینک امن مشاهده پیش‌فاکتور مشتری',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/revoke-customer-link',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
