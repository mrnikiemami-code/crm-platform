import {
  defineField,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_TARGET_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: COMMUNICATION_TARGET_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'targetPerson',
  label: 'Person',
  description: 'Person this communication was addressed to',
  icon: 'IconUser',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier:
    COMMUNICATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'targetPersonId',
  },
});
