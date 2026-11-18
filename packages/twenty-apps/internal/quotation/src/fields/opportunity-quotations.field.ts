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

// The "one" side of quotation <-> opportunity. Present for reporting and for the deal
// page, but conversion is never driven by the opportunity stage: this workspace's
// pipeline has no WON value.
export default defineField({
  universalIdentifier: RELATION_FIELDS.opportunityQuotations,
  objectUniversalIdentifier: STANDARD_OBJECT.opportunity.universalIdentifier,
  type: FieldType.RELATION,
  name: 'quotations',
  label: 'Quotations',
  description: 'Pro-forma quotations attached to this opportunity.',
  icon: 'IconFileInvoice',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier: QUOTATION_FIELDS.opportunity,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
