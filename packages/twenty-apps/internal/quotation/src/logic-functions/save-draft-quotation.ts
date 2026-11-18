import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { SAVE_DRAFT_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import { type MoneyUnit } from 'src/domain/money/currency';
import {
  buildDraftQuotationWritePayload,
  validateDraftQuotation,
} from 'src/services/quotation-save.service';

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

// Validates a draft and returns the write payload. Live GraphQL persistence is
// intentionally gated: without TWENTY_API_URL / install this route still proves
// the domain contract for the front component.
const handler = async (event: RoutePayload<unknown>) => {
  const body = asRecord(event.body);
  const linesRaw = Array.isArray(body.lines) ? body.lines : [];

  const outcome = validateDraftQuotation({
    quotationId: readString(body.quotationId) || null,
    status: (readString(body.status) || 'DRAFT') as 'DRAFT',
    customerType:
      readString(body.customerType) === 'PERSON' ? 'PERSON' : 'COMPANY',
    personId: readString(body.personId) || null,
    companyId: readString(body.companyId) || null,
    name: readString(body.name),
    paymentTerms: readString(body.paymentTerms) || null,
    taxPolicy: readString(body.taxPolicy) || null,
    displayMoneyUnit:
      readString(body.displayMoneyUnit) === 'IRR' ? 'IRR' : 'TOMAN',
    lines: linesRaw.map((line, index) => {
      const row = asRecord(line);
      const moneyUnit = (readString(row.moneyUnit) || 'TOMAN') as MoneyUnit;
      const discountPercent = readString(row.discountPercentText);

      return {
        clientLineId: readString(row.clientLineId) || `line-${index}`,
        catalogItemId: readString(row.catalogItemId) || null,
        kind: (readString(row.kind) === 'SERVICE' ? 'SERVICE' : 'PRODUCT') as CatalogItemKind,
        name: readString(row.name),
        description: readString(row.description) || null,
        unit: readString(row.unit) || 'عدد',
        quantityText: readString(row.quantityText),
        unitPriceText: readString(row.unitPriceText),
        moneyUnit,
        discount:
          discountPercent === ''
            ? { kind: 'NONE' as const }
            : { kind: 'RATE' as const, percentText: discountPercent },
        taxRatePercentText: readString(row.taxRatePercentText) || '0',
      };
    }),
  });

  if (outcome.kind === 'REJECTED') {
    return {
      success: false,
      code: outcome.code,
      message: outcome.message,
    };
  }

  const payload = buildDraftQuotationWritePayload(outcome.plan);

  if (!payload.ok) {
    return {
      success: false,
      code: payload.refusal.code,
      message: payload.refusal.detail,
    };
  }

  if (!process.env.TWENTY_API_URL) {
    return {
      success: true,
      persisted: false,
      reason: 'APP_NOT_INSTALLED',
      message:
        'محاسبات معتبر است؛ برای نوشتن در پایگاه، اپ باید روی فضای کاری نصب شود.',
      plan: {
        totalExact: outcome.plan.totalExact,
        displayTotal: outcome.plan.displayTotal,
        lineCount: outcome.plan.lines.length,
      },
      writePayload: payload.value,
    };
  }

  // Persistence after install is a follow-up wiring task; do not invent GraphQL
  // field names that the workspace has not synced yet.
  return {
    success: true,
    persisted: false,
    reason: 'PERSISTENCE_NOT_WIRED',
    message:
      'قرارداد ذخیره آماده است؛ اتصال GraphQL پس از نصب و تأیید معمار کامل می‌شود.',
    plan: {
      totalExact: outcome.plan.totalExact,
      displayTotal: outcome.plan.displayTotal,
      lineCount: outcome.plan.lines.length,
    },
    writePayload: payload.value,
  };
};

export default defineLogicFunction({
  universalIdentifier: SAVE_DRAFT_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'save-draft-quotation',
  description: 'اعتبارسنجی و آماده‌سازی ذخیره پیش‌نویس پیش‌فاکتور',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/save-draft',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
