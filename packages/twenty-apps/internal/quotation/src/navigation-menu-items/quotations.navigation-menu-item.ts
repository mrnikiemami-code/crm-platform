import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  QUOTATIONS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  QUOTATIONS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Sidebar entry for «همهٔ پیش‌فاکتورها» so the list is reachable from CRM nav
// without digging through Settings → Objects.
export default defineNavigationMenuItem({
  universalIdentifier: QUOTATIONS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: QUOTATIONS_VIEW_UNIVERSAL_IDENTIFIER,
  icon: 'IconFileInvoice',
  position: 35,
});
