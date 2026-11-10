import { defineCommandMenuItem } from 'twenty-sdk/define';
import {
  numberOfSelectedRecords,
  objectMetadataItem,
  objectPermissions,
} from 'twenty-sdk/define';

import {
  REGISTER_FROM_INTERACTION_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  REGISTRATION_FORM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Entry point 2 of 2. Identical to the lead command except for which record it
// appears on; the component behind it is the same, so a registration created
// from an interaction and one created from a lead cannot drift apart.
//
// Same operator-permission guard as the lead command: it hides the button, and
// the server's role intersection remains the real authorization.
export default defineCommandMenuItem({
  universalIdentifier:
    REGISTER_FROM_INTERACTION_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'ثبت‌نام',
  shortLabel: 'ثبت‌نام',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  conditionalAvailabilityExpression:
    objectMetadataItem.nameSingular === 'salesInteraction' &&
    numberOfSelectedRecords === 1 &&
    objectPermissions.canUpdateObjectRecords,
  frontComponentUniversalIdentifier:
    REGISTRATION_FORM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
