import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { SEARCH_CATALOG_ITEMS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { CATALOG_PICKER_PAGE_SIZE } from 'src/data/quotation-queries';
import { executeRecordGraphql, RecordApiError } from 'src/data/record-api';
import { searchCatalogItemsForPicker } from 'src/services/catalog-picker.service';

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const handler = async (event: RoutePayload<unknown>) => {
  const body = asRecord(event.body);
  const search = readString(body.search);
  const afterCursor = readString(body.afterCursor) || null;
  const requestedSize =
    typeof body.pageSize === 'number' && Number.isFinite(body.pageSize)
      ? Math.floor(body.pageSize)
      : CATALOG_PICKER_PAGE_SIZE;

  if (!process.env.TWENTY_API_URL || !process.env.TWENTY_APP_ACCESS_TOKEN) {
    return {
      success: false,
      code: 'APP_NOT_INSTALLED',
      message: 'برای جست‌وجوی کاتالوگ، اپ باید روی فضای کاری نصب شود.',
    };
  }

  try {
    const page = await searchCatalogItemsForPicker(
      {
        search,
        afterCursor,
        pageSize: requestedSize,
      },
      { execute: executeRecordGraphql },
    );

    return {
      success: true,
      items: page.items,
      endCursor: page.endCursor,
      hasNextPage: page.hasNextPage,
      pageSize: page.pageSize,
      timings: page.timings,
    };
  } catch (error) {
    if (error instanceof RecordApiError) {
      return {
        success: false,
        code: error.code,
        message:
          error.code === 'FORBIDDEN'
            ? 'دسترسی لازم برای خواندن کاتالوگ وجود ندارد'
            : 'خواندن کاتالوگ انجام نشد',
      };
    }

    return {
      success: false,
      code: 'CATALOG_SEARCH_FAILED',
      message: 'خواندن کاتالوگ انجام نشد',
    };
  }
};

export default defineLogicFunction({
  universalIdentifier: SEARCH_CATALOG_ITEMS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'search-catalog-items',
  description:
    'جست‌وجو و صفحه‌بندی کالا/خدمت فعال برای انتخابگر پیش‌فاکتور (حداکثر ۱۰۰ در هر صفحه)',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/search-catalog-items',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
