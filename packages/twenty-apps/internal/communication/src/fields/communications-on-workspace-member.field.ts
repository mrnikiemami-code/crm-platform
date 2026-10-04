import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_SENDER_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATIONS_ON_WORKSPACE_MEMBER_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier:
    COMMUNICATIONS_ON_WORKSPACE_MEMBER_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier,
  type: FieldType.RELATION,
  name: 'sentCommunications',
  label: 'Sent communications',
  description: 'Communications sent by this workspace member',
  icon: 'IconSend',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    COMMUNICATION_SENDER_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
  isUIEditable: false,
});
