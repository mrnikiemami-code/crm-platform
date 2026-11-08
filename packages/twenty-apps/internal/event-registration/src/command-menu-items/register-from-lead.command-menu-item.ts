import { defineCommandMenuItem } from 'twenty-sdk/define';
import { numberOfSelectedRecords, objectMetadataItem } from 'twenty-sdk/define';

import {
  REGISTER_FROM_LEAD_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  REGISTRATION_FORM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Entry point 1 of 2. Both command items open the SAME front component, so the
// form has one implementation and one save path.
//
// WHY NOT `availabilityObjectUniversalIdentifier`: that binding takes the
// workspace's own object id, which every workspace generates for itself, so a
// shipped app would point at nothing anywhere else. The object is selected by
// NAME instead, using the expression form the SDK supports — the same data the
// platform's own "Edit Layout" command reads.
//
// The condition is written as a real expression (not a string literal) because
// the build plugin only rewrites unquoted expressions; a quoted one would ship
// verbatim and never evaluate.
export default defineCommandMenuItem({
  universalIdentifier: REGISTER_FROM_LEAD_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'ثبت‌نام',
  shortLabel: 'ثبت‌نام',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  conditionalAvailabilityExpression:
    objectMetadataItem.nameSingular === 'eventLead' &&
    numberOfSelectedRecords === 1,
  frontComponentUniversalIdentifier:
    REGISTRATION_FORM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
