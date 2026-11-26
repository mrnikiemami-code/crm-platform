import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';
export default defineField({
  universalIdentifier: '48d7d3a8-2a81-53b7-89ad-c43e4ed4a1a4',
  objectUniversalIdentifier: STANDARD_OBJECT.company.universalIdentifier,
  type: FieldType.TEXT,
  name: 'registrationNumber',
  label: 'شماره ثبت',
  icon: 'IconId',
  isNullable: true,
  defaultValue: null,
});
