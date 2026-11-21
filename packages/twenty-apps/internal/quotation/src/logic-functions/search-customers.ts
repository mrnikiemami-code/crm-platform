import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { SEARCH_CUSTOMERS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { type CustomerKind } from 'src/data/customer-queries';
import { executeRecordGraphql, RecordApiError } from 'src/data/record-api';
import { searchCustomersForPicker } from 'src/services/customer-picker.service';

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const handler = async (event: RoutePayload<unknown>) => {
  // The route trigger is auth-required, so the caller already holds a token bound
  // to this workspace. Reads then go through the app role, which is the only
  // permission surface this app has: if the role lost person/company read, the
  // workspace API refuses and the picker shows nothing instead of leaking rows.
  const body = asRecord(event.body);
  const customerType: CustomerKind =
    readString(body.customerType) === 'COMPANY' ? 'COMPANY' : 'PERSON';
  const search = readString(body.search);
  // A preselected id (person/company context, or a hydrated draft) asks for that
  // one row so the form can show a readable name instead of a bare id.
  const recordId = readString(body.recordId) || null;

  if (!process.env.TWENTY_API_URL || !process.env.TWENTY_APP_ACCESS_TOKEN) {
    return {
      success: false,
      code: 'APP_NOT_INSTALLED',
      message: 'برای انتخاب مشتری، اپ باید روی فضای کاری نصب شود.',
    };
  }

  try {
    const page = await searchCustomersForPicker(
      { customerType, search, recordId },
      { execute: executeRecordGraphql },
    );

    return {
      success: true,
      customerType,
      rows: page.rows,
      hasNextPage: page.hasNextPage,
    };
  } catch (error) {
    if (error instanceof RecordApiError) {
      return {
        success: false,
        code: error.code,
        message:
          error.code === 'FORBIDDEN'
            ? customerType === 'PERSON'
              ? 'دسترسی لازم برای خواندن اشخاص وجود ندارد'
              : 'دسترسی لازم برای خواندن شرکت‌ها وجود ندارد'
            : 'خواندن فهرست مشتریان انجام نشد',
      };
    }

    return {
      success: false,
      code: 'CUSTOMER_SEARCH_FAILED',
      message: 'خواندن فهرست مشتریان انجام نشد',
    };
  }
};

export default defineLogicFunction({
  universalIdentifier: SEARCH_CUSTOMERS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'search-customers',
  description: 'جست‌وجوی شخص یا شرکت برای انتخاب مشتری پیش‌فاکتور',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/search-customers',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});