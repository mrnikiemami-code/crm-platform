import { defineCommandMenuItem } from 'twenty-sdk/define';

import {
  CATALOG_ITEM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  NEW_CATALOG_ITEM_COMMAND_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: NEW_CATALOG_ITEM_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'کالای جدید',
  shortLabel: 'کالای جدید',
  isPinned: false,
  availabilityType: 'GLOBAL',
  frontComponentUniversalIdentifier:
    CATALOG_ITEM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
