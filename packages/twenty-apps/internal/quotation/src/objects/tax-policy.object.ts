import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  TAX_POLICY_FIELDS,
  TAX_POLICY_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The workspace's tax and VAT policies. One row is one policy an operator can pick
// on a quotation; the rate lives here, never in code, because the correct rate and
// its legal basis are an accounting decision that changes over time.
//
// WHY THE RATE IS TEXT AND IN BASIS POINTS: a numeric column would travel through
// the API's float scalar, and a percentage that arrives as 9.0000000001 is a tax
// amount nobody agreed to. The stored form is an integer count of basis points
// (900 = 9%, 1050 = 10.5%), so the domain can divide exactly.
//
// WHY `code` AND NOT THE RECORD ID ON A DOCUMENT: a quotation stores the code, so
// renaming a policy or re-creating a row cannot change what a sealed document meant.
//
// WHY NOTHING IS EVER DESTROYED FROM HERE: a policy is referenced by quotations and
// by sealed snapshots. Deactivating it stops new use; deleting it would make old
// documents unexplainable, so the settings page never offers a destroy.
export default defineObject({
  universalIdentifier: TAX_POLICY_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'taxPolicy',
  namePlural: 'taxPolicies',
  labelSingular: 'سیاست مالیات',
  labelPlural: 'مالیات و عوارض',
  description:
    'سیاست‌های مالیات و ارزش افزودهٔ این فضای کاری: نرخ، پیش‌فرض بودن، فعال بودن و معافیت. سند صادرشده نرخ خود را نگه می‌دارد.',
  icon: 'IconPercentage',
  labelIdentifierFieldMetadataUniversalIdentifier: TAX_POLICY_FIELDS.name,
  // Records are created and edited through the tax settings panel, which enforces
  // "one default policy" and "zero rate means exempt". The generic record form has
  // no way to keep those two invariants.
  isUICreatable: false,
  isUIEditable: false,
  fields: [
    {
      universalIdentifier: TAX_POLICY_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'نام سیاست',
      description: 'نامی که هنگام انتخاب نرخ روی پیش‌فاکتور دیده می‌شود.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: TAX_POLICY_FIELDS.code,
      type: FieldType.TEXT,
      name: 'code',
      label: 'کد سیاست',
      description:
        'شناسهٔ پایدار که روی سند و در Snapshot مهروموم ثبت می‌شود، مثلاً IR_VAT_9.',
      icon: 'IconHash',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: TAX_POLICY_FIELDS.rateBasisPoints,
      type: FieldType.TEXT,
      name: 'rateBasisPoints',
      label: 'نرخ (پایه‌واحد)',
      description:
        '۹۰۰ یعنی ۹٪ و ۱۰۵۰ یعنی ۱۰٫۵٪. عدد صحیح، تا محاسبه هیچ‌گاه از ممیز شناور نگذرد.',
      icon: 'IconPercentage',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "'0'",
    },
    {
      universalIdentifier: TAX_POLICY_FIELDS.dutyRateBasisPoints,
      type: FieldType.TEXT,
      name: 'dutyRateBasisPoints',
      label: 'نرخ عوارض (پایه‌واحد)',
      description:
        'بخش عوارض همان سیاست؛ ۴۰۰ یعنی ۴٪. مالیات و عوارض دو مؤلفهٔ یک سیاست‌اند، نه دو سیاست.',
      icon: 'IconReceiptTax',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "'0'",
    },
    {
      universalIdentifier: TAX_POLICY_FIELDS.isDefault,
      type: FieldType.BOOLEAN,
      name: 'isDefault',
      label: 'سیاست پیش‌فرض',
      description: 'پیش‌فاکتور جدید با این سیاست شروع می‌شود. فقط یکی می‌تواند پیش‌فرض باشد.',
      icon: 'IconStar',
      isNullable: false,
      isUIEditable: false,
      defaultValue: false,
    },
    {
      universalIdentifier: TAX_POLICY_FIELDS.isActive,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'فعال',
      description:
        'سیاست غیرفعال در پیش‌فاکتور جدید پیشنهاد نمی‌شود ولی اسناد قبلی معتبر می‌مانند.',
      icon: 'IconCircleCheck',
      isNullable: false,
      isUIEditable: false,
      defaultValue: true,
    },
    {
      universalIdentifier: TAX_POLICY_FIELDS.isExempt,
      type: FieldType.BOOLEAN,
      name: 'isExempt',
      label: 'معاف از مالیات',
      description: 'معافیت فقط با نرخ صفر معنا دارد؛ نرخ غیرصفر با معافیت پذیرفته نمی‌شود.',
      icon: 'IconShield',
      isNullable: false,
      isUIEditable: false,
      defaultValue: false,
    },
  ],
});
