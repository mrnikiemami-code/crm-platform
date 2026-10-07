import {
  defineCommandMenuItem,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  SEND_MESSAGE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  SEND_MESSAGE_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: SEND_MESSAGE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  // Names the actual capability, so it is not confused with creating a record.
  // Translated through the app catalog (`commandMenuItem.label`/`shortLabel`).
  label: 'Send SMS',
  shortLabel: 'Send SMS',
  // The icon comes from the application, so it is intentionally not set here.
  isPinned: false,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  frontComponentUniversalIdentifier:
    SEND_MESSAGE_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
