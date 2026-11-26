import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';

// This is a field of the existing CRM record, not a second customer object.
export default defineField({
  universalIdentifier: '98f756cf-5b42-5d0b-99f0-211efc65c501',
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'nationalCode',
  label: 'کد ملی',
  description: 'شناسه هویتی مشتری برای تطبیق یکتای CRM و حسابداری.',
  icon: 'IconId',
  isNullable: true,
  isUnique: true,
});
