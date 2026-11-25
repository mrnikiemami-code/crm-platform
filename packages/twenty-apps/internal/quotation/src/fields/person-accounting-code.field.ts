import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { PERSON_ACCOUNTING_CODE_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// CRM ledger code on the person record. Not the destination party id on
// accountingPartyLink — that link stays the only match key for sync.
export default defineField({
  universalIdentifier: PERSON_ACCOUNTING_CODE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'accountingCode',
  label: 'کد حسابداری',
  description:
    'کد دفتر کل این شخص در CRM (اختیاری). با شناسهٔ مشتری در نرم‌افزار مقصد یکی نیست.',
  icon: 'IconHash',
  isNullable: true,
  defaultValue: "''",
});
