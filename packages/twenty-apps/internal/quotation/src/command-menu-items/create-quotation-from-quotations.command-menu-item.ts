import { defineCommandMenuItem } from 'twenty-sdk/define';
import {
  hasAnySoftDeleteFilterOnView,
  objectMetadataItem,
  objectPermissions,
} from 'twenty-sdk/define';

import {
  CREATE_QUOTATION_FROM_QUOTATIONS_COMMAND_UNIVERSAL_IDENTIFIER,
  QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The list page's create entry point. The platform's generic create is closed for
// quotation (`isUICreatable: false`), so this command is the only button that can
// start a quotation — and it always opens the professional draft form, never the
// generic record form. It is object-context, not selection-bound: an empty list
// must still offer it.
export default defineCommandMenuItem({
  universalIdentifier:
    CREATE_QUOTATION_FROM_QUOTATIONS_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'پیش‌فاکتور جدید',
  shortLabel: 'پیش‌فاکتور جدید',
  isPinned: true,
  availabilityType: 'GLOBAL_OBJECT_CONTEXT',
  // The object flags (`isUICreatable`, `isRemote`, `isUIEditable`) are already
  // enforced by the platform's own create-command template; repeating them here
  // would only duplicate a rule that lives in core.
  conditionalAvailabilityExpression:
    objectMetadataItem.nameSingular === 'quotation' &&
    objectPermissions.canUpdateObjectRecords &&
    !hasAnySoftDeleteFilterOnView,
  frontComponentUniversalIdentifier:
    QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
