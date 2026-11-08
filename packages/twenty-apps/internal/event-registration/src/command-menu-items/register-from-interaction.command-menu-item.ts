import { defineCommandMenuItem } from 'twenty-sdk/define';
import { numberOfSelectedRecords, objectMetadataItem } from 'twenty-sdk/define';

import {
  REGISTER_FROM_INTERACTION_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  REGISTRATION_FORM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Entry point 2 of 2. Identical to the lead command except for which record it
// appears on; the component behind it is the same, so a registration created
// from an interaction and one created from a lead cannot drift apart.
export default defineCommandMenuItem({
  universalIdentifier:
    REGISTER_FROM_INTERACTION_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'ثبت‌نام',
  shortLabel: 'ثبت‌نام',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  conditionalAvailabilityExpression:
    objectMetadataItem.nameSingular === 'salesInteraction' &&
    numberOfSelectedRecords === 1,
  frontComponentUniversalIdentifier:
    REGISTRATION_FORM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
