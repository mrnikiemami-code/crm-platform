import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { SAVE_CATALOG_ITEM_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import { type MoneyUnit } from 'src/domain/money/currency';
import {
  buildCatalogItemWritePayload,
  validateCatalogItemUpsert,
} from 'src/services/quotation-save.service';

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const handler = async (event: RoutePayload<unknown>) => {
  const body = asRecord(event.body);

  const outcome = validateCatalogItemUpsert({
    id: readString(body.id) || null,
    kind: (readString(body.kind) === 'SERVICE' ? 'SERVICE' : 'PRODUCT') as CatalogItemKind,
    name: readString(body.name),
    sku: readString(body.sku) || null,
    unit: readString(body.unit),
    description: readString(body.description) || null,
    isActive: body.isActive !== false,
    defaultUnitPriceText: readString(body.defaultUnitPriceText) || null,
    moneyUnit: (readString(body.moneyUnit) === 'IRR' ? 'IRR' : 'TOMAN') as MoneyUnit,
  });

  if (outcome.kind === 'REJECTED') {
    return {
      success: false,
      code: outcome.code,
      message: outcome.message,
    };
  }

  const payload = buildCatalogItemWritePayload(outcome.plan);

  if (!payload.ok) {
    return {
      success: false,
      code: payload.refusal.code,
      message: payload.refusal.detail,
    };
  }

  return {
    success: true,
    persisted: false,
    reason: process.env.TWENTY_API_URL
      ? 'PERSISTENCE_NOT_WIRED'
      : 'APP_NOT_INSTALLED',
    message:
      'کالا/خدمت معتبر است؛ نوشتن در پایگاه پس از نصب اپ و تأیید معمار انجام می‌شود.',
    writePayload: payload.value,
  };
};

export default defineLogicFunction({
  universalIdentifier: SAVE_CATALOG_ITEM_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'save-catalog-item',
  description: 'اعتبارسنجی و آماده‌سازی ذخیره کالا یا خدمت',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/save-catalog-item',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
