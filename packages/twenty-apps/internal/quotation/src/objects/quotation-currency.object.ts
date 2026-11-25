import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  QUOTATION_CURRENCY_FIELDS,
  QUOTATION_CURRENCY_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Workspace currency catalog. Phase 1 operational amounts stay IRR; other rows may
// exist for codes/defaults later, but mixed-currency documents are not activated.
//
// WHY NOT ON THE CONNECTION: CRM accounting codes for a currency are owned here.
// Connection settings may only map vendor destination values when an adapter proves need.
export default defineObject({
  universalIdentifier: QUOTATION_CURRENCY_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'quotationCurrency',
  namePlural: 'quotationCurrencies',
  labelSingular: 'ارز',
  labelPlural: 'ارزها',
  description:
    'فهرست ارزهای فضای کاری. ارز پیش‌فرض برای پیش‌فاکتور جدید؛ کد حسابداری اختیاری است.',
  icon: 'IconCurrencyIranianRial',
  labelIdentifierFieldMetadataUniversalIdentifier: QUOTATION_CURRENCY_FIELDS.name,
  isUICreatable: false,
  isUIEditable: false,
  fields: [
    {
      universalIdentifier: QUOTATION_CURRENCY_FIELDS.code,
      type: FieldType.TEXT,
      name: 'code',
      label: 'کد ارز',
      description: 'شناسهٔ پایدار سه‌حرفی، مثلاً IRR. روی سند و Snapshot ثبت می‌شود.',
      icon: 'IconHash',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_CURRENCY_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'نام ارز',
      description: 'نام نمایشی برای اپراتور فارسی‌زبان.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: QUOTATION_CURRENCY_FIELDS.isDefault,
      type: FieldType.BOOLEAN,
      name: 'isDefault',
      label: 'ارز پیش‌فرض',
      description: 'پیش‌فاکتور جدید با این ارز شروع می‌شود. فقط یکی می‌تواند پیش‌فرض باشد.',
      icon: 'IconStar',
      isNullable: false,
      isUIEditable: false,
      defaultValue: false,
    },
    {
      universalIdentifier: QUOTATION_CURRENCY_FIELDS.isActive,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'فعال',
      description: 'ارز غیرفعال برای اسناد جدید پیشنهاد نمی‌شود.',
      icon: 'IconCircleCheck',
      isNullable: false,
      isUIEditable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: QUOTATION_CURRENCY_FIELDS.accountingCode,
      type: FieldType.TEXT,
      name: 'accountingCode',
      label: 'کد حسابداری',
      description:
        'کد دفتر کل این ارز (اختیاری). خالی مجاز است؛ پس از نخستین Snapshot غیرخالی قفل می‌شود.',
      icon: 'IconHash',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
  ],
});
