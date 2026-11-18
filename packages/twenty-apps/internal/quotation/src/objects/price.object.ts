import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  PRICE_FIELDS,
  PRICE_LIST_OBJECT_UNIVERSAL_IDENTIFIER,
  PRICE_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
} from 'src/constants/universal-identifiers';

// The price of one item in one price list for one period.
//
// TWO AMOUNT COLUMNS, AND THAT IS DELIBERATE:
//  - `unitPriceMicros` is a NUMBER so the platform can sort and aggregate it, and so
//    it renders as an amount. It crosses the API as a JS number, which is exact only
//    up to 2^53-1 micros.
//  - `unitPriceExact` is the authoritative value as an exact decimal STRING, written
//    by the same code that writes the number.
// A price list entry beyond 2^53-1 micros (about 9 billion rial) cannot be held
// exactly by the number column, so the string is the record and the number is the
// view. This duplication is the cost of using a platform whose numeric boundary is a
// double; it is flagged in the S1 report as a decision to confirm.
export default defineObject({
  universalIdentifier: PRICE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'price',
  namePlural: 'prices',
  labelSingular: 'Price',
  labelPlural: 'Prices',
  description: 'The price of one catalog item in one price list, over a period.',
  icon: 'IconPercentage',
  labelIdentifierFieldMetadataUniversalIdentifier: PRICE_FIELDS.unitPriceExact,
  fields: [
    {
      universalIdentifier: PRICE_FIELDS.unitPriceMicros,
      type: FieldType.NUMERIC,
      name: 'unitPriceMicros',
      label: 'Unit price (micros)',
      description:
        'Unit price in micros of the price list currency. Exact only within 2^53-1; the exact decimal column is authoritative.',
      icon: 'IconCurrencyIranianRial',
      isNullable: false,
      defaultValue: '0',
    },
    {
      universalIdentifier: PRICE_FIELDS.unitPriceExact,
      type: FieldType.TEXT,
      name: 'unitPriceExact',
      label: 'Unit price (exact)',
      description:
        'The authoritative unit price as an exact decimal with six fraction digits, written alongside the number.',
      icon: 'IconFileText',
      isNullable: false,
      defaultValue: '',
    },
    {
      universalIdentifier: PRICE_FIELDS.validFrom,
      type: FieldType.DATE,
      name: 'validFrom',
      label: 'Valid from',
      description: 'First day this price applies. Empty means "since forever".',
      icon: 'IconCalendarStats',
      isNullable: true,
    },
    {
      universalIdentifier: PRICE_FIELDS.validTo,
      type: FieldType.DATE,
      name: 'validTo',
      label: 'Valid to',
      description: 'Last day this price applies. Empty means "until replaced".',
      icon: 'IconCalendarStats',
      isNullable: true,
    },
    {
      universalIdentifier: PRICE_FIELDS.item,
      type: FieldType.RELATION,
      name: 'item',
      label: 'Catalog item',
      description: 'The item this price belongs to.',
      icon: 'IconBox',
      isNullable: false,
      relationTargetObjectMetadataUniversalIdentifier:
        CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.catalogItemPrices,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'itemId',
      },
    },
    {
      universalIdentifier: PRICE_FIELDS.priceList,
      type: FieldType.RELATION,
      name: 'priceList',
      label: 'Price list',
      description: 'The list whose currency this price is expressed in.',
      icon: 'IconCurrencyIranianRial',
      isNullable: false,
      relationTargetObjectMetadataUniversalIdentifier:
        PRICE_LIST_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.priceListPrices,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'priceListId',
      },
    },
  ],
});
