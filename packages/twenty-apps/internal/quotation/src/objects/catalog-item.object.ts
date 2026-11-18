import {
  defineObject,
  FieldType,
  RelationType,
} from 'twenty-sdk/define';

import {
  ACCOUNTING_ITEM_LINK_FIELDS,
  ACCOUNTING_ITEM_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
  CATALOG_ITEM_FIELDS,
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  PRICE_FIELDS,
  PRICE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_LINE_FIELDS,
  QUOTATION_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
  SELECT_OPTION_IDS,
} from 'src/constants/universal-identifiers';

// A product or a service that can appear on a quotation line.
//
// NO INVENTORY FIELD, ON PURPOSE: stock and valuation stay in the accounting or
// inventory system by the agreed boundary. A CRM-side quantity would be a second
// answer to "how many are left" and it would drift from the first.
//
// NO PRICE FIELD EITHER: a price is a fact about (item, price list, period), not
// about the item, so it lives on `price`. Putting a single price here would force
// every workspace into one currency and one validity period.
export default defineObject({
  universalIdentifier: CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'catalogItem',
  namePlural: 'catalogItems',
  labelSingular: 'Catalog item',
  labelPlural: 'Catalog items',
  description:
    'A product or service that can be quoted. Inventory and valuation live in the accounting system.',
  icon: 'IconBox',
  labelIdentifierFieldMetadataUniversalIdentifier: CATALOG_ITEM_FIELDS.name,
  fields: [
    {
      universalIdentifier: CATALOG_ITEM_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'What the item is called on a quotation.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: '',
    },
    {
      universalIdentifier: CATALOG_ITEM_FIELDS.kind,
      type: FieldType.SELECT,
      name: 'kind',
      label: 'Kind',
      description:
        'Product or service. Decides whether the accounting system must treat the line as inventory-bearing.',
      icon: 'IconCategory',
      isNullable: false,
      defaultValue: `'PRODUCT'`,
      options: [
        {
          id: SELECT_OPTION_IDS.catalogItemKindProduct,
          value: 'PRODUCT',
          label: 'کالا',
          color: 'blue',
          position: 0,
        },
        {
          id: SELECT_OPTION_IDS.catalogItemKindService,
          value: 'SERVICE',
          label: 'خدمت',
          color: 'green',
          position: 1,
        },
      ],
    },
    {
      universalIdentifier: CATALOG_ITEM_FIELDS.sku,
      type: FieldType.TEXT,
      name: 'sku',
      label: 'SKU',
      description:
        'Optional stock code. Not an identity: two items may share one, and matching an external item on it is forbidden.',
      icon: 'IconHash',
      isNullable: true,
    },
    {
      universalIdentifier: CATALOG_ITEM_FIELDS.unit,
      type: FieldType.TEXT,
      name: 'unit',
      label: 'Unit',
      description: 'Unit of measure shown next to the quantity, for example عدد or ساعت.',
      icon: 'IconRuler',
      isNullable: false,
      defaultValue: '',
    },
    {
      universalIdentifier: CATALOG_ITEM_FIELDS.description,
      type: FieldType.TEXT,
      name: 'description',
      label: 'Description',
      description: 'Default wording used on a line that references this item.',
      icon: 'IconFileText',
      isNullable: true,
    },
    {
      universalIdentifier: CATALOG_ITEM_FIELDS.isActive,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Active',
      description:
        'An inactive item stays on historical quotations but cannot be added to a new line.',
      icon: 'IconCircleCheck',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: RELATION_FIELDS.catalogItemQuotationLines,
      type: FieldType.RELATION,
      name: 'quotationLines',
      label: 'Quotation lines',
      description: 'Lines that reference this item. Reporting only; an amount is never read from here.',
      icon: 'IconListDetails',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        QUOTATION_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        QUOTATION_LINE_FIELDS.item,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: RELATION_FIELDS.catalogItemPrices,
      type: FieldType.RELATION,
      name: 'prices',
      label: 'Prices',
      description: 'This item priced in every price list, one entry per period.',
      icon: 'IconCurrencyIranianRial',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        PRICE_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier: PRICE_FIELDS.item,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: RELATION_FIELDS.catalogItemAccountingLinks,
      type: FieldType.RELATION,
      name: 'accountingLinks',
      label: 'Accounting links',
      description: 'Counterparts of this item in every connected accounting package.',
      icon: 'IconLink',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        ACCOUNTING_ITEM_LINK_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        ACCOUNTING_ITEM_LINK_FIELDS.item,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
