import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';
export default defineField({
  universalIdentifier: '48d7d3a8-2a81-53b7-89ad-c43e4ed4a1aa',
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: FieldType.TEXT,
  name: 'accountingFax',
  label: 'فکس',
  icon: 'IconId',
  isNullable: true,
  defaultValue: null,
});
