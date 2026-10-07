import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  COMMUNICATIONS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Exposes the Communication object in the sidebar so recorded communications
// are discoverable without going through a Person record. The name is
// translated through the app catalog (`navigationMenuItem.name`), so the
// sidebar entry reads Persian on a Persian workspace.
export default defineNavigationMenuItem({
  universalIdentifier:
    COMMUNICATIONS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: COMMUNICATION_OBJECT_UNIVERSAL_IDENTIFIER,
  position: 40,
});
