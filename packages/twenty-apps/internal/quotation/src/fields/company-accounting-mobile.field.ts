import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

// This is a field of the existing CRM record, not a second customer object.
export default defineField({
  universalIdentifier: 'f813a2c0-3586-5e90-ae19-98326883084b',
  objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'accountingMobile',
  label: 'شماره تماس حسابداری',
  description: 'شماره تماس مشتری که از حسابداری دریافت شده است.',
  icon: 'IconPhone',
  isNullable: true,
});
