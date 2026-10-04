import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_TARGET_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: COMMUNICATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'communications',
  label: 'Communications',
  description: 'Communications addressed to this person',
  icon: 'IconSend',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    COMMUNICATION_TARGET_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
  isUIEditable: false,
});
