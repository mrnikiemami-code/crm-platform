import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  ROUNDING_RULE_FIELDS,
  ROUNDING_RULE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Workspace catalog of named payable rounding rules. One row is one step an
// operator can pick on a quotation; the step lives here, never in code.
//
// WHY TEXT FOR stepRials: a numeric column would travel through the API float
// scalar. The stored form is a positive integer string of whole IRR.
//
// WHY code AND NOT ONLY THE RECORD ID ON A DOCUMENT: quotations snapshot the
// code + name + step so renaming or re-creating a row cannot reprice a sealed
// document. Deactivating stops new use; destroying used rules is refused.
export default defineObject({
  universalIdentifier: ROUNDING_RULE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'roundingRule',
  namePlural: 'roundingRules',
  labelSingular: 'قاعده رُند کردن',
  labelPlural: 'قواعد رُند کردن',
  description:
    'قواعد نام‌دار رُند کردن مبلغ نهایی قابل پرداخت به مضرب صحیح ریال. سند صادرشده مبنای خود را نگه می‌دارد.',
  icon: 'IconAdjustments',
  labelIdentifierFieldMetadataUniversalIdentifier: ROUNDING_RULE_FIELDS.name,
  isUICreatable: false,
  isUIEditable: false,
  fields: [
    {
      universalIdentifier: ROUNDING_RULE_FIELDS.name,
      type: FieldType.TEXT,
      name: 'name',
      label: 'نام قاعده',
      description: 'نامی که هنگام انتخاب مبنای رُند روی پیش‌فاکتور دیده می‌شود.',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: ROUNDING_RULE_FIELDS.code,
      type: FieldType.TEXT,
      name: 'code',
      label: 'کد قاعده',
      description:
        'شناسهٔ پایدار که روی سند و در Snapshot مهروموم ثبت می‌شود، مثلاً STEP_1000.',
      icon: 'IconHash',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: ROUNDING_RULE_FIELDS.stepRials,
      type: FieldType.TEXT,
      name: 'stepRials',
      label: 'مبنای رُند (ریال)',
      description:
        'مضرب صحیح مثبت برحسب ریال. مقادیر دلخواه مانند ۹۹ مجازند؛ صفر و اعشار پذیرفته نمی‌شوند.',
      icon: 'IconCurrencyIranianRial',
      isNullable: false,
      isUIEditable: false,
      defaultValue: "'1'",
    },
    {
      universalIdentifier: ROUNDING_RULE_FIELDS.isDefault,
      type: FieldType.BOOLEAN,
      name: 'isDefault',
      label: 'قاعده پیش‌فرض',
      description:
        'پیش‌فاکتور جدید با این قاعده شروع می‌شود. فقط یکی می‌تواند پیش‌فرض باشد.',
      icon: 'IconStar',
      isNullable: false,
      isUIEditable: false,
      defaultValue: false,
    },
    {
      universalIdentifier: ROUNDING_RULE_FIELDS.isActive,
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'فعال',
      description:
        'قاعده غیرفعال در پیش‌فاکتور جدید پیشنهاد نمی‌شود ولی اسناد قبلی معتبر می‌مانند.',
      icon: 'IconCircleCheck',
      isNullable: false,
      isUIEditable: false,
      defaultValue: true,
    },
  ],
});
