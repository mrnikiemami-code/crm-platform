import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT,
} from 'twenty-sdk/define';

import {
  QUOTATION_FIELDS,
  QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  RELATION_FIELDS,
} from 'src/constants/universal-identifiers';

// The "one" side of quotation <-> person. A relation is declared on both objects, so
// this field lives on the standard person object while remaining owned by this app.
export default defineField({
  universalIdentifier: RELATION_FIELDS.personQuotations,
  objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'quotations',
  label: 'Quotations',
  description: 'Pro-forma quotations issued to this person.',
  icon: 'IconFileInvoice',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier: QUOTATION_FIELDS.person,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
