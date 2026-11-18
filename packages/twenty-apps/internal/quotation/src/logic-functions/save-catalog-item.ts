import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { SAVE_CATALOG_ITEM_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { executeRecordGraphql } from 'src/data/record-api';
import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import { type MoneyUnit } from 'src/domain/money/currency';
import { persistCatalogItem } from 'src/services/quotation-persist.service';
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
  const input = {
    id: readString(body.id) || null,
    kind: (readString(body.kind) === 'SERVICE' ? 'SERVICE' : 'PRODUCT') as CatalogItemKind,
    name: readString(body.name),
    sku: readString(body.sku) || null,
    unit: readString(body.unit),
    description: readString(body.description) || null,
    isActive: body.isActive !== false,
    defaultUnitPriceText: readString(body.defaultUnitPriceText) || null,
    moneyUnit: (readString(body.moneyUnit) === 'IRR' ? 'IRR' : 'TOMAN') as MoneyUnit,
  };

  if (!process.env.TWENTY_API_URL || !process.env.TWENTY_APP_ACCESS_TOKEN) {
    const outcome = validateCatalogItemUpsert(input);

    if (outcome.kind === 'REJECTED') {
      return {
        success: false,
        code: outcome.code,
        message: outcome.message,
      };
    }

    const payload = buildCatalogItemWritePayload(outcome.plan);

    return {
      success: true,
      persisted: false,
      reason: 'APP_NOT_INSTALLED',
      message:
        'کالا/خدمت معتبر است؛ برای نوشتن در پایگاه، اپ باید روی فضای کاری نصب شود.',
      writePayload: payload.ok ? payload.value : null,
    };
  }

  const saved = await persistCatalogItem(input, {
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
    itemId: saved.itemId,
    message: 'کالا/خدمت ذخیره شد',
  };
};

export default defineLogicFunction({
  universalIdentifier: SAVE_CATALOG_ITEM_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'save-catalog-item',
  description: 'اعتبارسنجی و ذخیره کالا یا خدمت',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/save-catalog-item',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
