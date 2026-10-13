import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Exposes the workspace's message templates in the sidebar, next to
// «ارتباطات», so a template can be created, edited, searched and deleted
// without going through the composer. It points at the SAME native
// `messageTemplate` view the composer reads — one storage, one set of records,
// no parallel list.
//
// It stays a VIEW item (its original type in W15-A) rather than switching to an
// OBJECT item: the platform's manifest sync updates an existing navigation menu
// item in place and cannot change its TYPE (the same limitation that forbids a
// field type change), so a VIEW→OBJECT rewrite would fail the upgrade. A view
// item renders as `<view name> · <object plural label>`, so the view is named
// «الگوهای پیامک» / "SMS templates" — the required sidebar label — through the
// app catalog (`view.name`).
export default defineNavigationMenuItem({
  universalIdentifier:
    MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
  position: 41,
});
