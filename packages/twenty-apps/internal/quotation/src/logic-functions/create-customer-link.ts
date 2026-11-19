import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { CREATE_CUSTOMER_LINK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { executeRecordGraphql, RecordApiError } from 'src/data/record-api';
import { createCustomerLink } from 'src/services/customer-link.service';

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const handler = async (event: RoutePayload<unknown>) => {
  const body = asRecord(event.body);
  const quotationId = readString(body.quotationId);
  const ttlHours =
    typeof body.ttlHours === 'number' && Number.isFinite(body.ttlHours)
      ? body.ttlHours
      : undefined;

  if (!process.env.TWENTY_API_URL || !process.env.TWENTY_APP_ACCESS_TOKEN) {
    return {
      success: false,
      code: 'APP_NOT_INSTALLED',
      message: 'برای صدور لینک مشتری، اپ باید روی فضای کاری نصب شود.',
    };
  }

  try {
    const created = await createCustomerLink(
      { quotationId, ttlHours },
      { execute: executeRecordGraphql },
    );

    if (!created.ok) {
      return {
        success: false,
        code: created.refusal.code,
        message:
          created.refusal.code === 'QUOTATION_NOT_FOUND'
            ? 'پیش‌فاکتور یافت نشد'
            : created.refusal.code === 'CUSTOMER_LINK_STATUS_FORBIDDEN'
              ? 'فقط برای پیش‌فاکتورهای آماده ارسال یا ارسال‌شده می‌توان لینک ساخت'
              : 'صدور لینک مشتری انجام نشد',
      };
    }

    return {
      success: true,
      linkId: created.value.linkId,
      quotationId: created.value.quotationId,
      expiresAt: created.value.expiresAt,
      // Raw token and URL are returned once; the token is not stored.
      token: created.value.rawToken,
      viewUrl: created.value.viewUrl,
      message: 'لینک مشتری صادر شد. این لینک را فقط یک‌بار کپی کنید.',
    };
  } catch (error) {
    if (error instanceof RecordApiError) {
      return {
        success: false,
        code: error.code,
        message:
          error.code === 'FORBIDDEN'
            ? 'دسترسی لازم برای صدور لینک وجود ندارد'
            : 'صدور لینک مشتری انجام نشد',
      };
    }

    return {
      success: false,
      code: 'CUSTOMER_LINK_CREATE_FAILED',
      message: 'صدور لینک مشتری انجام نشد',
    };
  }
};

export default defineLogicFunction({
  universalIdentifier: CREATE_CUSTOMER_LINK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'create-customer-link',
  description: 'صدور لینک امن مشاهده پیش‌فاکتور برای مشتری',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/create-customer-link',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
