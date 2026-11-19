import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import { VIEW_CUSTOMER_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { executeRecordGraphql, RecordApiError } from 'src/data/record-api';
import { resolveCustomerQuotationView } from 'src/services/customer-link.service';
import {
  renderCustomerLinkErrorHtml,
  renderCustomerQuotationHtml,
} from 'src/utils/render-customer-quotation-html';

const htmlResponse = (html: string, status = 200): Response =>
  new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });

const readToken = (event: RoutePayload): string => {
  const fromQuery = event.queryStringParameters?.token;

  if (typeof fromQuery === 'string' && fromQuery.trim() !== '') {
    return fromQuery.trim();
  }

  return '';
};

const handler = async (event: RoutePayload): Promise<Response> => {
  if (!process.env.TWENTY_API_URL || !process.env.TWENTY_APP_ACCESS_TOKEN) {
    return htmlResponse(
      renderCustomerLinkErrorHtml(
        'لینک در دسترس نیست',
        'سامانه برای نمایش این پیش‌فاکتور آماده نیست.',
      ),
      503,
    );
  }

  const rawToken = readToken(event);

  if (rawToken === '') {
    return htmlResponse(
      renderCustomerLinkErrorHtml(
        'لینک نامعتبر',
        'توکن مشاهده در آدرس وجود ندارد.',
      ),
      400,
    );
  }

  try {
    const resolved = await resolveCustomerQuotationView(
      { rawToken },
      { execute: executeRecordGraphql },
    );

    if (resolved.kind === 'OK') {
      return htmlResponse(renderCustomerQuotationHtml(resolved.view));
    }

    if (resolved.kind === 'EXPIRED') {
      return htmlResponse(
        renderCustomerLinkErrorHtml(
          'لینک منقضی شده',
          'مهلت این لینک به پایان رسیده است. لطفاً لینک جدید درخواست کنید.',
        ),
        410,
      );
    }

    if (resolved.kind === 'REVOKED') {
      return htmlResponse(
        renderCustomerLinkErrorHtml(
          'لینک لغو شده',
          'این لینک توسط صادرکننده باطل شده است.',
        ),
        410,
      );
    }

    if (resolved.kind === 'FORBIDDEN_STATUS') {
      return htmlResponse(
        renderCustomerLinkErrorHtml(
          'پیش‌فاکتور در دسترس نیست',
          'وضعیت فعلی این پیش‌فاکتور برای مشاهده مشتری مجاز نیست.',
        ),
        403,
      );
    }

    return htmlResponse(
      renderCustomerLinkErrorHtml(
        'لینک نامعتبر',
        'این لینک معتبر نیست یا پیش‌فاکتور مرتبط یافت نشد.',
      ),
      404,
    );
  } catch (error) {
    if (error instanceof RecordApiError && error.code === 'FORBIDDEN') {
      return htmlResponse(
        renderCustomerLinkErrorHtml(
          'دسترسی مجاز نیست',
          'امکان نمایش این پیش‌فاکتور وجود ندارد.',
        ),
        403,
      );
    }

    return htmlResponse(
      renderCustomerLinkErrorHtml(
        'خطا',
        'نمایش پیش‌فاکتور در حال حاضر ممکن نیست.',
      ),
      500,
    );
  }
};

export default defineLogicFunction({
  universalIdentifier:
    VIEW_CUSTOMER_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'view-customer-quotation',
  description: 'صفحه فقط‌خواندنی پیش‌فاکتور برای مشتری با توکن امن',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/customer-view',
    httpMethod: 'GET',
    isAuthRequired: false,
  },
});
