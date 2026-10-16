import { defineCommandMenuItem } from 'twenty-sdk/define';

import {
  SEND_MESSAGE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  SEND_MESSAGE_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: SEND_MESSAGE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  // The label is Persian IN THE MANIFEST on purpose, for the same reason the
  // «ویرایش الگو» command is: the platform's `CommandMenuItemRenderer` passes an
  // app command's label straight to the rendered text with no translation call,
  // so an app catalog entry cannot translate it.
  label: 'ارسال پیامک',
  shortLabel: 'ارسال پیامک',
  // The icon comes from the application, so it is intentionally not set here.
  isPinned: false,
  availabilityType: 'RECORD_SELECTION',
  // DELIBERATELY UNBOUND. `doesCommandMenuItemMatchObjectMetadataId` treats a
  // missing object binding as "matches every object", so leaving it out is what
  // makes the command reachable from a record selection of ANY object. Binding it
  // to Person would mean the command does not exist at all on an Opportunity, and
  // the user would get no explanation — only silence. The component itself decides
  // what it can act on and explains the rest.
  frontComponentUniversalIdentifier:
    SEND_MESSAGE_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
