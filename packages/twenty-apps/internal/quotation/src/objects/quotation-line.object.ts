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
  SELECT_OPTION_IDS,
} from 'src/constants/universal-identifiers';

// One line of a quotation.
//
// SNAPSHOT, NOT REFERENCE: the description, unit, kind and unit price are copied onto
// the line when it is added. If the catalog price changes tomorrow, yesterday's
// quotation must still show yesterday's price, so a line may not read its amount
// through the item relation.
//
// AMOUNTS ARE EXACT STRINGS ONLY. A line is a calculation result, not something a
// person sorts by; the document's `totalExact` carries the display copy. Writing a
// CURRENCY column here as well would double the two-column problem for no benefit.
export default defineObject({
  universalIdentifier: QUOTATION_LINE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'quotationLine',
  namePlural: 'quotationLines',
  labelSingular: 'ردیف پیش‌فاکتور',
  labelPlural: 'ردیف‌های پیش‌فاکتور',
  description:
    'ردیف قیمت‌گذاری‌شده با مقادیر کپی‌شده در لحظهٔ افزودن.',
  icon: 'IconListDetails',
  labelIdentifierFieldMetadataUniversalIdentifier: QUOTATION_LINE_FIELDS.name,
  fields: [
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'نام',
      description: 'عنوان کوتاه ردیف، معمولاً نام کالا یا خدمت.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.kind,
      type: FieldType.SELECT,
      name: 'kind',
      label: 'نوع',
      description:
        'کالا یا خدمت در لحظهٔ افزودن. اسنپ‌شات است؛ با تغییر کاتالوگ عوض نمی‌شود.',
      icon: 'IconCategory',
      isNullable: false,
      defaultValue: `'PRODUCT'`,
      options: [
        {
          id: SELECT_OPTION_IDS.quotationLineKindProduct,
          value: 'PRODUCT',
          label: 'کالا',
          color: 'blue',
          position: 0,
        },
        {
          id: SELECT_OPTION_IDS.quotationLineKindService,
          value: 'SERVICE',
          label: 'خدمت',
          color: 'green',
          position: 1,
        },
      ],
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.description,
      type: FieldType.TEXT,
      name: 'description',
      label: 'توضیح',
      description: 'متن چاپ‌شده روی پیش‌فاکتور برای این ردیف.',
      icon: 'IconFileText',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.unit,
      type: FieldType.TEXT,
      name: 'unit',
      label: 'واحد',
      description: 'واحد اندازه‌گیری، کپی‌شده از کاتالوگ در زمان افزودن.',
      icon: 'IconRuler',
      isNullable: true,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.quantityMilli,
      type: FieldType.TEXT,
      name: 'quantityExact',
      label: 'مقدار (دقیق)',
      description:
        'مقدار با شش رقم اعشار دقیق. متن است تا از دست رفتن دقت GraphQL رخ ندهد. از فرم ویرایش، نه جدول، تغییر می‌کند.',
      icon: 'IconHash',
      isNullable: false,
      defaultValue: "'0.000000'",
      isUIEditable: false,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.unitPriceExact,
      type: FieldType.TEXT,
      name: 'unitPriceExact',
      label: 'قیمت واحد (دقیق، ریال)',
      description: 'قیمت واحد به ریال دقیق، ثابت‌شده در لحظهٔ افزودن.',
      icon: 'IconCurrencyIranianRial',
      isNullable: false,
      defaultValue: "'0.000000'",
      isUIEditable: false,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.grossExact,
      type: FieldType.TEXT,
      name: 'grossExact',
      label: 'ناخالص ردیف (دقیق، ریال)',
      description: 'مقدار × قیمت واحد قبل از تخفیف.',
      icon: 'IconCurrencyIranianRial',
      isNullable: false,
      defaultValue: "'0.000000'",
      isUIEditable: false,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.discountExact,
      type: FieldType.TEXT,
      name: 'discountExact',
      label: 'تخفیف ردیف (دقیق، ریال)',
      description: 'مبلغ تخفیف سطح ردیف به ریال دقیق.',
      icon: 'IconPercentage',
      isNullable: false,
      defaultValue: "'0.000000'",
      isUIEditable: false,
    },
    {
      // Kept so editing a draft can show the same discount the operator typed.
      // The amount is the authority; this only explains how it was requested.
      universalIdentifier: QUOTATION_LINE_FIELDS.discountKind,
      type: FieldType.TEXT,
      name: 'discountKind',
      label: 'نوع تخفیف ردیف',
      description: 'NONE یا RATE یا AMOUNT — ورودی اپراتور برای تخفیف ردیف.',
      icon: 'IconList',
      isNullable: true,
      defaultValue: "'NONE'",
      isUIEditable: false,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.discountInputExact,
      type: FieldType.TEXT,
      name: 'discountInputExact',
      label: 'ورودی تخفیف ردیف (دقیق)',
      description:
        'برای RATE درصد به‌صورت اعشار دقیق؛ برای AMOUNT مبلغ ریال دقیق؛ برای NONE صفر.',
      icon: 'IconHash',
      isNullable: true,
      defaultValue: "'0.000000'",
      isUIEditable: false,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.documentDiscountExact,
      type: FieldType.TEXT,
      name: 'documentDiscountExact',
      label: 'سهم تخفیف کل (دقیق، ریال)',
      description: 'سهم تخصیص‌یافته از تخفیف سطح سند به این ردیف.',
      icon: 'IconPercentage',
      isNullable: false,
      defaultValue: "'0.000000'",
      isUIEditable: false,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.taxExact,
      type: FieldType.TEXT,
      name: 'taxExact',
      label: 'مالیات (دقیق، ریال)',
      description: 'مالیات روی مبلغ پس از تخفیف ردیف و سهم تخفیف کل.',
      icon: 'IconPercentage',
      isNullable: false,
      defaultValue: "'0.000000'",
      isUIEditable: false,
    },
    {
      // WS3: line may override the document default policy; rates freeze at save.
      universalIdentifier: QUOTATION_LINE_FIELDS.taxPolicy,
      type: FieldType.TEXT,
      name: 'taxPolicy',
      label: 'سیاست مالیات ردیف',
      description:
        'شناسهٔ سیاست مالیات/عوارض این ردیف. مستقل از سایر ردیف‌ها؛ پیش‌فرض از سند.',
      icon: 'IconPercentage',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.taxRateBasisPoints,
      type: FieldType.TEXT,
      name: 'taxRateBasisPoints',
      label: 'نرخ مالیات ردیف (پایه‌واحد)',
      description:
        'نرخ مالیات فریزشدهٔ این ردیف؛ ۹۰۰ یعنی ۹٪. برای بازخوانی و صدور، نه ویرایش دستی.',
      icon: 'IconPercentage',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.dutyRateBasisPoints,
      type: FieldType.TEXT,
      name: 'dutyRateBasisPoints',
      label: 'نرخ عوارض ردیف (پایه‌واحد)',
      description:
        'نرخ عوارض فریزشدهٔ این ردیف؛ ۴۰۰ یعنی ۴٪. با مالیات جمع می‌شود ولی جدا می‌ماند.',
      icon: 'IconReceiptTax',
      isNullable: true,
      isUIEditable: false,
    },
    {
      // Server-only CRM ledger snapshot of this line's tax policy (C3/C4).
      universalIdentifier: QUOTATION_LINE_FIELDS.taxAccountingCode,
      type: FieldType.TEXT,
      name: 'taxAccountingCode',
      label: 'کد حسابداری مالیات ردیف (اسنپ‌شات)',
      description:
        'کد دفتر کل سیاست مالیات ردیف در لحظهٔ ذخیره. فقط سرور می‌نویسد؛ در فرم دیده نمی‌شود.',
      icon: 'IconHash',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.taxPolicyRecordId,
      type: FieldType.TEXT,
      name: 'taxPolicyRecordId',
      label: 'شناسه رکورد سیاست مالیات ردیف',
      description:
        'شناسهٔ رکورد سیاست مالیات مرجع این ردیف برای قفل کد حسابداری. فقط سرور می‌نویسد.',
      icon: 'IconKey',
      isNullable: true,
      isUIEditable: false,
    },
    {
      // WS4: inherits document currency. Independent per-line currency stays behind
      // MULTI_CURRENCY_DOCUMENTS (off); server writes the document code on save.
      universalIdentifier: QUOTATION_LINE_FIELDS.currencyCode,
      type: FieldType.TEXT,
      name: 'currencyCode',
      label: 'ارز ردیف',
      description:
        'کد ارز این ردیف. در فاز ۱ همیشه برابر ارز سند (IRR) است؛ انتخاب جداگانه در فرم نیست.',
      icon: 'IconCurrencyIranianRial',
      isNullable: true,
      isUIEditable: false,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.totalExact,
      type: FieldType.TEXT,
      name: 'totalExact',
      label: 'جمع ردیف (دقیق، ریال)',
      description: 'خالص به‌علاوه مالیات.',
      icon: 'IconFileText',
      isNullable: false,
      defaultValue: "'0.000000'",
      isUIEditable: false,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.sortOrder,
      type: FieldType.NUMBER,
      name: 'sortOrder',
      label: 'ترتیب',
      description: 'جایگاه ردیف روی سند.',
      icon: 'IconListNumbers',
      isNullable: false,
      defaultValue: 0,
      isUIEditable: false,
    },
    {
      universalIdentifier: QUOTATION_LINE_FIELDS.quotation,
      type: FieldType.RELATION,
      name: 'quotation',
      label: 'پیش‌فاکتور',
      description: 'پیش‌فاکتور مالک این ردیف.',
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
      label: 'کالا / خدمت',
      description:
        'ارجاع اختیاری به کاتالوگ. قیمت از اینجا خوانده نمی‌شود؛ فقط برای گزارش.',
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
