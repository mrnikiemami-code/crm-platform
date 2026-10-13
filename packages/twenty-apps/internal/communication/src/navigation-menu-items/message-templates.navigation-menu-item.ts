import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Exposes the workspace's message templates in the sidebar, next to
// «ارتباطات», so a template can be created, edited, searched and deleted
// without going through the composer.
//
// It is an OBJECT item: the sidebar then renders exactly the object's plural
// label, translated through the app catalog (`objectMetadata.labelPlural`:
// "SMS templates" → «الگوهای پیامک»), with NO `· <object>` suffix. A VIEW item
// would append the object plural to the view name, which is why W17's VIEW item
// was retired in W17-R1.
export default defineNavigationMenuItem({
  universalIdentifier:
    MESSAGE_TEMPLATES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  position: 41,
});
