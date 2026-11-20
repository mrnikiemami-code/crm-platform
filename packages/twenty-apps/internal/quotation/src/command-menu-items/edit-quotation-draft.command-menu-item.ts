import { defineCommandMenuItem } from 'twenty-sdk/define';
import {
  numberOfSelectedRecords,
  objectMetadataItem,
  objectPermissions,
} from 'twenty-sdk/define';

import {
  EDIT_QUOTATION_DRAFT_COMMAND_UNIVERSAL_IDENTIFIER,
  QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The draft form is the only place a saved draft may be edited. Offering it on
// the quotation record itself is what removes the old dead end where a record
// opened from the list showed fields but no way to change them.
export default defineCommandMenuItem({
  universalIdentifier: EDIT_QUOTATION_DRAFT_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'ویرایش پیش‌نویس',
  shortLabel: 'ویرایش',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  conditionalAvailabilityExpression:
    objectMetadataItem.nameSingular === 'quotation' &&
    numberOfSelectedRecords === 1 &&
    objectPermissions.canUpdateObjectRecords,
  frontComponentUniversalIdentifier:
    QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
