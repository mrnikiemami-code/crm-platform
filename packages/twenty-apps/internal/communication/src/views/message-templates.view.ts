import { defineView, ViewType } from 'twenty-sdk/define';

import {
  MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// A workspace-owned templates list. Manifest views are always ADDITIONAL
// views, so this does not replace the engine default; it gives a discoverable
// default (title, channel, body). The object itself IS creatable/editable
// through the generic UI, so this view is the supported CRUD surface for
// workspace templates.
export default defineView({
  universalIdentifier: MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'Message templates',
  objectUniversalIdentifier: MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconTemplate',
  position: 1,
  fields: [
    {
      universalIdentifier: '101023b6-4456-46c3-a06e-7f8eba259817',
      fieldMetadataUniversalIdentifier:
        MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
      position: 0,
      isVisible: true,
      size: 180,
    },
    {
      universalIdentifier: '74f517f3-9859-48d5-9f83-cef80a70dc5f',
      fieldMetadataUniversalIdentifier:
        MESSAGE_TEMPLATE_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      position: 1,
      isVisible: true,
      size: 100,
    },
    {
      universalIdentifier: '359983a6-5f2a-4e75-876c-46ea37c35dca',
      fieldMetadataUniversalIdentifier:
        MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
      position: 2,
      isVisible: true,
      size: 360,
    },
  ],
});
