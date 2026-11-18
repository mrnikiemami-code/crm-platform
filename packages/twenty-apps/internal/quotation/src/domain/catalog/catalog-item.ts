import { accepted, refused, type Result } from 'src/domain/shared/result';

// What a quotation line points at. One object serves products and services so a
// mixed quotation needs no second join, and `kind` is what lets the accounting
// adapter decide whether the row is inventory-bearing.
export const CATALOG_ITEM_KINDS = ['PRODUCT', 'SERVICE'] as const;

export type CatalogItemKind = (typeof CATALOG_ITEM_KINDS)[number];

export type CatalogItem = {
  id: string;
  kind: CatalogItemKind;
  name: string;
  // Optional, and deliberately NOT an identity. Two suppliers can use the same
  // code, and an accounting package will have its own. Identity is `id`; the link
  // to an external system lives in AccountingItemLink.
  sku: string | null;
  unit: string;
  isActive: boolean;
};

const MAX_NAME_LENGTH = 200;
const MAX_UNIT_LENGTH = 32;
const MAX_SKU_LENGTH = 64;

export const validateCatalogItem = (candidate: {
  id: string;
  kind: CatalogItemKind;
  name: string;
  sku: string | null;
  unit: string;
  isActive: boolean;
}): Result<CatalogItem> => {
  const name = candidate.name.trim();
  const unit = candidate.unit.trim();
  const sku = candidate.sku === null ? null : candidate.sku.trim();

  if (candidate.id.trim() === '') {
    return refused('ITEM_ID_MISSING', 'a catalog item needs a stable id');
  }

  if (name === '') {
    return refused('ITEM_NAME_MISSING', 'a catalog item needs a name');
  }

  if (name.length > MAX_NAME_LENGTH) {
    return refused(
      'ITEM_NAME_TOO_LONG',
      `a catalog item name may be at most ${MAX_NAME_LENGTH} characters`,
    );
  }

  if (unit === '' || unit.length > MAX_UNIT_LENGTH) {
    return refused(
      'ITEM_UNIT_INVALID',
      'a catalog item needs a unit of measure (for example عدد, ساعت, کیلوگرم)',
    );
  }

  if (sku !== null && (sku === '' || sku.length > MAX_SKU_LENGTH)) {
    return refused(
      'ITEM_SKU_INVALID',
      `a SKU is either absent or 1-${MAX_SKU_LENGTH} characters`,
    );
  }

  return accepted({
    id: candidate.id.trim(),
    kind: candidate.kind,
    name,
    sku,
    unit,
    isActive: candidate.isActive,
  });
};

// Inventory is NOT owned by the CRM. The architect's boundary puts stock and
// valuation in the accounting/inventory system, so a CRM-side stock number would be
// a second truth that drifts. Refusing the field is cheaper than explaining later
// why two systems disagree about how many items are on the shelf.
export const CATALOG_ITEM_UNSUPPORTED_CRM_FIELD = 'inventoryQuantity';
