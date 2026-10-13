import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  SMS_TEMPLATE_STUDIO_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  SMS_TEMPLATE_STUDIO_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The sidebar entry for the SMS Template Studio, next to «ارتباطات».
//
// It is a PAGE_LAYOUT item: the sidebar then renders exactly the item's own
// `name`, which is «الگوهای پیامک» — no `<view> · <object>` suffix and no
// object-plural derivation. W17-R1's OBJECT item is retired in the same change
// (the platform's manifest sync cannot change an existing item's type, so a new
// stable identifier is used and the old row is removed by dropping it from the
// manifest).
export default defineNavigationMenuItem({
  universalIdentifier:
    SMS_TEMPLATE_STUDIO_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'الگوهای پیامک',
  icon: 'IconTemplate',
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier:
    SMS_TEMPLATE_STUDIO_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  position: 41,
});
