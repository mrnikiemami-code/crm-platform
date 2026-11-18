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
  labelSingular: 'کالا / خدمت',
  labelPlural: 'کالا و خدمات',
  description:
    'کالا یا خدمت قابل افزودن به پیش‌فاکتور. موجودی و ارزش‌گذاری در سیستم حسابداری است، نه در CRM.',
  icon: 'IconBox',
  labelIdentifierFieldMetadataUniversalIdentifier: CATALOG_ITEM_FIELDS.name,
  fields: [
    {
      universalIdentifier: CATALOG_ITEM_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'نام',
      description: 'عنوانی که روی پیش‌فاکتور دیده می‌شود.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: '',
    },
    {
      universalIdentifier: CATALOG_ITEM_FIELDS.kind,
      type: FieldType.SELECT,
      name: 'kind',
      label: 'نوع',
      description:
        'کالا یا خدمت. برای اتصال حسابداری مشخص می‌کند آیا ردیف موجودی‌دار است.',
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
      label: 'کد کالا',
      description:
        'کد اختیاری. هویت رکورد نیست؛ تطبیق حسابداری فقط از طریق پیوند صریح انجام می‌شود.',
      icon: 'IconHash',
      isNullable: true,
    },
    {
      universalIdentifier: CATALOG_ITEM_FIELDS.unit,
      type: FieldType.TEXT,
      name: 'unit',
      label: 'واحد',
      description: 'واحد اندازه‌گیری کنار مقدار، مثلاً عدد یا ساعت.',
      icon: 'IconRuler',
      isNullable: false,
      defaultValue: '',
    },
    {
      universalIdentifier: CATALOG_ITEM_FIELDS.description,
      type: FieldType.TEXT,
      name: 'description',
      label: 'توضیح',
      description: 'متن پیش‌فرض ردیف هنگام افزودن به پیش‌فاکتور.',
      icon: 'IconFileText',
      isNullable: true,
    },
    {
      universalIdentifier: CATALOG_ITEM_FIELDS.isActive,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'فعال',
      description:
        'آیتم غیرفعال در پیش‌فاکتورهای قبلی می‌ماند ولی به ردیف جدید اضافه نمی‌شود.',
      icon: 'IconCircleCheck',
      isNullable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: RELATION_FIELDS.catalogItemQuotationLines,
      type: FieldType.RELATION,
      name: 'quotationLines',
      label: 'ردیف‌های پیش‌فاکتور',
      description: 'فقط برای گزارش؛ مبلغ از اینجا خوانده نمی‌شود.',
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
      label: 'قیمت‌ها',
      description: 'قیمت این آیتم در هر فهرست قیمت.',
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
      label: 'پیوند حسابداری',
      description: 'معادل این آیتم در سیستم‌های حسابداری متصل (جدا از پیش‌فاکتور).',
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
