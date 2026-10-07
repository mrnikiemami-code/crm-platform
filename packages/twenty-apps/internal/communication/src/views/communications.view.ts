import {
  defineView,
  ViewType,
} from 'twenty-sdk/define';

import {
  COMMUNICATION_BODY_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_PROVIDER_ID_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_QUEUED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_RECIPIENT_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATION_TARGET_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  COMMUNICATIONS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// A read-only history view for recorded communications. Manifest views are
// always ADDITIONAL views, so this does not replace the engine default; it
// gives a discoverable, useful default (Person, recipient, body, channel,
// provider, status, time). The object itself is not creatable/editable through
// the generic UI, so nothing here can trigger a send.
export default defineView({
  universalIdentifier: COMMUNICATIONS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Communications',
  objectUniversalIdentifier: COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconSend',
  position: 0,
  fields: [
    {
      universalIdentifier: 'd7e4b9c0-8f53-4ab2-9c4d-9e3f1a5b6c72',
      fieldMetadataUniversalIdentifier:
        COMMUNICATION_TARGET_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
      position: 0,
      isVisible: true,
      size: 160,
    },
    {
      universalIdentifier: 'e8f5cad1-9064-4bc3-ad5e-af402b6c7d83',
      fieldMetadataUniversalIdentifier:
        COMMUNICATION_RECIPIENT_FIELD_UNIVERSAL_IDENTIFIER,
      position: 1,
      isVisible: true,
      size: 140,
    },
    {
      universalIdentifier: 'f906dbe2-a175-4cd4-be6f-b0513c7d8e94',
      fieldMetadataUniversalIdentifier:
        COMMUNICATION_BODY_FIELD_UNIVERSAL_IDENTIFIER,
      position: 2,
      isVisible: true,
      size: 260,
    },
    {
      universalIdentifier: '0a17ecf3-b286-4de5-8f70-c1624d8e9fa5',
      fieldMetadataUniversalIdentifier:
        COMMUNICATION_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      position: 3,
      isVisible: true,
      size: 100,
    },
    {
      universalIdentifier: '1b28fd04-c397-4ef6-9081-d2735e9fa0b6',
      fieldMetadataUniversalIdentifier:
        COMMUNICATION_PROVIDER_ID_FIELD_UNIVERSAL_IDENTIFIER,
      position: 4,
      isVisible: true,
      size: 120,
    },
    {
      universalIdentifier: '2c390e15-d4a8-4f07-9192-e3846fa0b1c7',
      fieldMetadataUniversalIdentifier:
        COMMUNICATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      position: 5,
      isVisible: true,
      size: 110,
    },
    {
      universalIdentifier: '3d4a0f26-e5b9-4018-92a3-f49570a1b2d8',
      fieldMetadataUniversalIdentifier:
        COMMUNICATION_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER,
      position: 6,
      isVisible: true,
      size: 140,
    },
    {
      universalIdentifier: '4e5b1037-f6ca-4129-a3b4-05a681b2c3e9',
      fieldMetadataUniversalIdentifier:
        COMMUNICATION_QUEUED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      position: 7,
      isVisible: false,
      size: 140,
    },
  ],
});
