import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_LINE_FIELDS,
  QUOTATION_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
} from 'src/constants/universal-identifiers';

// One line of a quotation.
//
// SNAPSHOT, NOT REFERENCE: the description, unit and unit price are copied onto the
// line when it is added. If the catalog price changes tomorrow, yesterday's quotation
// must still show yesterday's price, so a line may not read its amount through the
// item relation.
//
// AMOUNTS ARE EXACT STRINGS ONLY. A line is a calculation result, not something a
// person sorts by; the document's `total` carries the display copy. Writing a CURRENCY
// column here as well would double the two-column problem for no benefit.
export default defineObject({
  universalIdentifier: QUOTATION_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'quotationLine',
  namePlural: 'quotationLines',
  labelSingular: 'Quotation line',
  labelPlural: 'Quotation lines',
  description:
    'A priced line on a quotation, with the values copied in at the time it was added.',
  icon: 'IconListDetails',
  labelIdentifierFieldMetadataUniversalIdentifier: QUOTATION_LINE_FIELDS.name,
  fields: [
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'Short label for the line, normally the item name.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: '',
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.description,
      type: FieldType.TEXT,
      name: 'description',
      label: 'Description',
      description: 'Wording printed on the quotation for this line.',
      icon: 'IconFileText',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.unit,
      type: FieldType.TEXT,
      name: 'unit',
      label: 'Unit',
      description: 'Unit of measure, copied from the item at the time of quoting.',
      icon: 'IconRuler',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.quantityMilli,
      type: FieldType.TEXT,
      name: 'quantityExact',
      label: 'Quantity (exact)',
      description:
        'Quantity as an exact decimal with six fraction digits, so 1.5 is 1.500000. Text rather than a number: a quantity must not drift, and a NUMERIC column would go through the GraphQL BigFloat scalar.',
      icon: 'IconHash',
      isNullable: false,
      defaultValue: '0.000000',
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.unitPriceExact,
      type: FieldType.TEXT,
      name: 'unitPriceExact',
      label: 'Unit price (exact)',
      description: 'Unit price in micros as an exact decimal, frozen when the line was added.',
      icon: 'IconCurrencyIranianRial',
      isNullable: false,
      defaultValue: '0.000000',
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.discountExact,
      type: FieldType.TEXT,
      name: 'discountExact',
      label: 'Discount (exact)',
      description: 'Discount amount in micros as an exact decimal.',
      icon: 'IconPercentage',
      isNullable: false,
      defaultValue: '0.000000',
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.taxExact,
      type: FieldType.TEXT,
      name: 'taxExact',
      label: 'Tax (exact)',
      description: 'Tax amount in micros as an exact decimal, computed on the discounted amount.',
      icon: 'IconPercentage',
      isNullable: false,
      defaultValue: '0.000000',
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.totalExact,
      type: FieldType.TEXT,
      name: 'totalExact',
      label: 'Line total (exact)',
      description: 'Net plus tax in micros as an exact decimal.',
      icon: 'IconFileText',
      isNullable: false,
      defaultValue: '0.000000',
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.sortOrder,
      type: FieldType.NUMBER,
      name: 'sortOrder',
      label: 'Order',
      description: 'Position of the line on the printed document.',
      icon: 'IconListNumbers',
      isNullable: false,
      defaultValue: 0,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.quotation,
      type: FieldType.RELATION,
      name: 'quotation',
      label: 'Quotation',
      description: 'The quotation this line belongs to.',
      icon: 'IconFileInvoice',
      isNullable: false,
      relationTargetObjectMetadataUniversalIdentifier:
        QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.quotationLines,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.CASCADE,
        joinColumnName: 'quotationId',
      },
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.item,
      type: FieldType.RELATION,
      name: 'item',
      label: 'Catalog item',
      description:
        'Optional reference to the catalog item. Never used to read the price; it exists so reports can group by item.',
      icon: 'IconBox',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        RELATION_FIELDS.catalogItemQuotationLines,
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'itemId',
      },
    },
  ],
});
