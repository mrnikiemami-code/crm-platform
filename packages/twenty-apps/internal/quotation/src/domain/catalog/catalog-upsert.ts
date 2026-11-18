import {
  validateCatalogItem,
  type CatalogItem,
  type CatalogItemKind,
} from 'src/domain/catalog/catalog-item';
import {
  parseMoneyInput,
  type MoneyUnit,
} from 'src/domain/money/currency';
import { formatMicrosExact } from 'src/domain/money/micros';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Validates a catalog item create/update from the operator form. Optional default
// price is stored as exact IRR text on `price`, never on the item itself.

export type CatalogItemUpsertInput = {
  id: string | null;
  kind: CatalogItemKind;
  name: string;
  sku: string | null;
  unit: string;
  description: string | null;
  isActive: boolean;
  defaultUnitPriceText: string | null;
  moneyUnit: MoneyUnit;
};

export type CatalogItemUpsertPlan = {
  item: CatalogItem;
  defaultUnitPriceExact: string | null;
};

export const buildCatalogItemUpsertPlan = (
  input: CatalogItemUpsertInput,
): Result<CatalogItemUpsertPlan> => {
  const item = validateCatalogItem({
    id: input.id ?? 'new',
    kind: input.kind,
    name: input.name,
    sku: input.sku,
    unit: input.unit,
    isActive: input.isActive,
  });

  if (!item.ok) {
    return refused(
      item.refusal.code,
      toPersianCatalogMessage(item.refusal.code, item.refusal.detail),
    );
  }

  let defaultUnitPriceExact: string | null = null;

  if (
    input.defaultUnitPriceText !== null &&
    input.defaultUnitPriceText.trim() !== ''
  ) {
    const price = parseMoneyInput(input.defaultUnitPriceText, input.moneyUnit);

    if (!price.ok) {
      return refused('UNIT_PRICE_INVALID', 'قیمت واحد معتبر نیست');
    }

    if (price.value.irrMicros < 0n) {
      return refused('UNIT_PRICE_NEGATIVE', 'قیمت نمی‌تواند منفی باشد');
    }

    defaultUnitPriceExact = formatMicrosExact(price.value.irrMicros);
  }

  return accepted({
    item: {
      ...item.value,
      // Fresh creates get a real id from the platform; keep placeholder out of the plan.
      id: input.id ?? item.value.id,
    },
    defaultUnitPriceExact,
  });
};

const toPersianCatalogMessage = (code: string, fallback: string): string => {
  switch (code) {
    case 'ITEM_ID_MISSING':
      return 'شناسهٔ کالا یا خدمت نامعتبر است';
    case 'ITEM_NAME_MISSING':
      return 'نام کالا یا خدمت الزامی است';
    case 'ITEM_NAME_TOO_LONG':
      return 'نام بیش از حد طولانی است';
    case 'ITEM_UNIT_INVALID':
      return 'واحد اندازه‌گیری الزامی است (مثلاً عدد، ساعت، کیلوگرم)';
    case 'ITEM_SKU_INVALID':
      return 'کد کالا معتبر نیست';
    default:
      return fallback;
  }
};
