import {
  defineObject,
  FieldType,
  RelationType,
} from 'twenty-sdk/define';

import {
  CATALOG_ITEM_FIELDS,
  CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_UNIT_FIELDS,
  QUOTATION_UNIT_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
} from 'src/constants/universal-identifiers';

// Workspace unit-of-measure catalog (Goal 040 U01). Operator enters accounting codes;
// internal `code` is assigned by server authority and never edited in the UI.
//
// WHY NOT ON THE CONNECTION: vendor unit ids map here, not on accountingConnection.
export default defineObject({
  universalIdentifier: QUOTATION_UNIT_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'quotationUnit',
  namePlural: 'quotationUnits',
  labelSingular: 'واحد اندازه‌گیری',
  labelPlural: 'واحدهای اندازه‌گیری',
  description:
    'فهرست واحدهای فضای کاری. کد حسابداری اختیاری است؛ پس از اولین استفاده با کد غیرخالی در پیش‌فاکتور قفل می‌شود.',
  icon: 'IconRuler',
  labelIdentifierFieldMetadataUniversalIdentifier: QUOTATION_UNIT_FIELDS.name,
  isUICreatable: false,
  isUIEditable: false,
  fields: [
    {
      universalIdentifier: QUOTATION_UNIT_FIELDS.code,
      type: FieldType.TEXT,
      name: 'code',
      label: 'کد داخلی',
      description: 'شناسهٔ پایدار داخلی؛ توسط سرور اختصاص می‌یابد و در UI ویرایش نمی‌شود.',
      icon: 'IconHash',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_UNIT_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'نام واحد',
      description: 'نام نمایشی برای اپراتور فارسی‌زبان.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_UNIT_FIELDS.isActive,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'فعال',
      description: 'واحد غیرفعال برای انتخاب جدید پیشنهاد نمی‌شود.',
      icon: 'IconCircleCheck',
      isNullable: false,
      isUIEditable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: QUOTATION_UNIT_FIELDS.accountingCode,
      type: FieldType.TEXT,
      name: 'accountingCode',
      label: 'کد حسابداری',
      description:
        'کد دفتر کل این واحد (اختیاری). خالی مجاز است؛ پس از اولین ذخیره ردیف با کد غیرخالی قفل می‌شود.',
      icon: 'IconHash',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_UNIT_FIELDS.accountingCodeLocked,
      type: FieldType.BOOLEAN,
      name: 'accountingCodeLocked',
      label: 'قفل دائمی کد حسابداری',
      description: 'پس از اولین ذخیره موفق ردیف با کد غیرخالی، فقط سرور ثبت می‌کند.',
      icon: 'IconLock',
      isNullable: false,
      isUIEditable: false,
      defaultValue: false,
    },
    {
      universalIdentifier: RELATION_FIELDS.quotationUnitCatalogItems,
      type: FieldType.RELATION,
      name: 'catalogItems',
      label: 'کالا و خدمات',
      description: 'آیتم‌هایی که این واحد را به‌عنوان مرجع دارند.',
      icon: 'IconBox',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        CATALOG_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        CATALOG_ITEM_FIELDS.unitRecord,
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});