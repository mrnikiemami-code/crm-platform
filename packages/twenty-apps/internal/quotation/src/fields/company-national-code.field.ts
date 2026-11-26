import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

// This is a field of the existing CRM record, not a second customer object.
export default defineField({
  universalIdentifier: 'd1b6ed95-cfd5-5b6c-817e-44145b6b9c9c',
  objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'nationalCode',
  label: 'شناسه ملی',
  description: 'شناسه هویتی مشتری برای تطبیق یکتای CRM و حسابداری.',
  icon: 'IconId',
  isNullable: true,
  isUnique: true,
});
