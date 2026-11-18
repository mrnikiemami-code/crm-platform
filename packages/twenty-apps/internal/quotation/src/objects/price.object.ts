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
// ONE AMOUNT COLUMN, AND IT IS TEXT. The exact decimal is the amount; there is no second
// copy in a numeric column. A numeric column would go through Twenty's GraphQL `BigFloat`
// scalar, which parses with `parseFloat`, so a price above 2^53-1 micros (about 9 billion
// rial) comes back as a different number — silently. Sorting still works: the stored form is
// fixed-width (see `formatMicrosSortable`), so text ordering equals numeric ordering.
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
      universalIdentifier: PRICE_FIELDS.unitPriceExact,
      type: FieldType.TEXT,
      name: 'unitPriceExact',
      label: 'Unit price (exact)',
      description:
        'The amount, as an exact decimal with six fraction digits in the price list currency. The single authoritative copy.',
      icon: 'IconCurrencyIranianRial',
      isNullable: false,
      defaultValue: '0.000000',
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
