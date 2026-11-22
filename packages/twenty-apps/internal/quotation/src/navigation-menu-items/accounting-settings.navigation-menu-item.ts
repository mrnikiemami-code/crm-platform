import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  ACCOUNTING_SETTINGS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_SETTINGS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The destination is a workspace-wide decision, so it lives beside the tax settings in
// the sidebar instead of inside a quotation record tab.
export default defineNavigationMenuItem({
  universalIdentifier:
    ACCOUNTING_SETTINGS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'تنظیمات حسابداری',
  icon: 'IconPlugConnected',
  position: 37,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: ACCOUNTING_SETTINGS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
