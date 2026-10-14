import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The sidebar entry for «الگوهای پیامک», next to «ارتباطات».
//
// It is a VIEW item pointing at the app's own `messageTemplate` TABLE view, so it
// opens the PLATFORM's native list instead of a bespoke page: the native table
// with the native column header menu, search, filter and sort, and the native
// record create/edit/delete flow with the native record page.
//
// The sidebar label is the VIEW's own name resolved through the app catalog
// (`view.name`: 'SMS templates' → «الگوهای پیامک»), which is why this item
// declares no `name` — the platform renders `view.name` verbatim for a VIEW item.
//
// This replaces the PAGE_LAYOUT item that used to open the bespoke studio. A
// navigation item's TYPE cannot be changed once it exists, so the studio item is
// retired by dropping it from the manifest and this item — with its own stable
// identifier — is declared instead.
export default defineNavigationMenuItem({
  universalIdentifier:
    MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
  icon: 'IconTemplate',
  position: 41,
});
