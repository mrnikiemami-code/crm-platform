import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  TAX_POLICY_SETTINGS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  TAX_POLICY_SETTINGS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Administrators open the tax settings from the sidebar, because this fork does not
// expose Settings → Applications where the settings component would otherwise live.
export default defineNavigationMenuItem({
  universalIdentifier:
    TAX_POLICY_SETTINGS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'پیش‌نیازهای حسابداری',
  icon: 'IconPercentage',
  position: 36,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: TAX_POLICY_SETTINGS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
