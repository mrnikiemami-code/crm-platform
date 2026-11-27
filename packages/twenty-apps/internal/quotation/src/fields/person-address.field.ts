import { defineField, FieldType, STANDARD_OBJECT } from 'twenty-sdk/define';
export default defineField({
  universalIdentifier: '48d7d3a8-2a81-53b7-89ad-c43e4ed4a1a3',
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: FieldType.ADDRESS,
  // Person does not have a standard address field; `address` is reserved by metadata.
  name: 'accountingAddress',
  label: 'نشانی',
  icon: 'IconId',
  isNullable: true,
  defaultValue: null,
});
