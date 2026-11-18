import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { SAVE_DRAFT_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { executeRecordGraphql } from 'src/data/record-api';
import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import { type MoneyUnit } from 'src/domain/money/currency';
import { persistDraftQuotation } from 'src/services/quotation-persist.service';
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

const handler = async (event: RoutePayload<unknown>) => {
  const body = asRecord(event.body);
  const linesRaw = Array.isArray(body.lines) ? body.lines : [];

  const input = {
    quotationId: readString(body.quotationId) || null,
    status: (readString(body.status) || 'DRAFT') as 'DRAFT',
    customerType:
      readString(body.customerType) === 'PERSON' ? ('PERSON' as const) : ('COMPANY' as const),
    personId: readString(body.personId) || null,
    companyId: readString(body.companyId) || null,
    name: readString(body.name),
    paymentTerms: readString(body.paymentTerms) || null,
    taxPolicy: readString(body.taxPolicy) || null,
    displayMoneyUnit:
      readString(body.displayMoneyUnit) === 'IRR'
        ? ('IRR' as const)
        : ('TOMAN' as const),
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
  };

  if (!process.env.TWENTY_API_URL || !process.env.TWENTY_APP_ACCESS_TOKEN) {
    const outcome = validateDraftQuotation(input);

    if (outcome.kind === 'REJECTED') {
      return {
        success: false,
        code: outcome.code,
        message: outcome.message,
      };
    }

    const payload = buildDraftQuotationWritePayload(outcome.plan);

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
      writePayload: payload.ok ? payload.value : null,
    };
  }

  const saved = await persistDraftQuotation(input, {
    execute: executeRecordGraphql,
  });

  if (saved.kind === 'REJECTED') {
    return {
      success: false,
      code: saved.code,
      message: saved.message,
    };
  }

  return {
    success: true,
    persisted: true,
    quotationId: saved.quotationId,
    plan: {
      totalExact: saved.plan.totalExact,
      displayTotal: saved.plan.displayTotal,
      lineCount: saved.plan.lines.length,
    },
    message: 'پیش‌نویس پیش‌فاکتور ذخیره شد',
  };
};

export default defineLogicFunction({
  universalIdentifier: SAVE_DRAFT_QUOTATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'save-draft-quotation',
  description: 'اعتبارسنجی و ذخیره پیش‌نویس پیش‌فاکتور',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/save-draft',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
