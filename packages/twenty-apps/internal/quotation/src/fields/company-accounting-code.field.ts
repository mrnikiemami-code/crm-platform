import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

import { COMPANY_ACCOUNTING_CODE_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// CRM ledger code on the company record. Distinct from accountingPartyLink.externalPartyId.
export default defineField({
  universalIdentifier: COMPANY_ACCOUNTING_CODE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'accountingCode',
  label: 'کد حسابداری',
  description:
    'کد دفتر کل این شرکت در CRM (اختیاری). با شناسهٔ مشتری در نرم‌افزار مقصد یکی نیست.',
  icon: 'IconHash',
  isNullable: true,
  defaultValue: "''",
});
