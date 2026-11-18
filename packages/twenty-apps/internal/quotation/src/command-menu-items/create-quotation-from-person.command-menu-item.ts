import { defineCommandMenuItem } from 'twenty-sdk/define';
import {
  numberOfSelectedRecords,
  objectMetadataItem,
  objectPermissions,
} from 'twenty-sdk/define';

import {
  CREATE_QUOTATION_FROM_PERSON_COMMAND_UNIVERSAL_IDENTIFIER,
  QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: CREATE_QUOTATION_FROM_PERSON_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'ایجاد پیش‌فاکتور',
  shortLabel: 'پیش‌فاکتور',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  conditionalAvailabilityExpression:
    objectMetadataItem.nameSingular === 'person' &&
    numberOfSelectedRecords === 1 &&
    objectPermissions.canUpdateObjectRecords,
  frontComponentUniversalIdentifier:
    QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
