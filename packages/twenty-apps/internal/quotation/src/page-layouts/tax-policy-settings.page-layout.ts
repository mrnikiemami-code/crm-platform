import {
  type PageLayoutWidgetManifest,
  definePageLayout,
  PageLayoutTabLayoutMode,
} from 'twenty-sdk/define';

import {
  TAX_POLICY_SETTINGS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  TAX_POLICY_SETTINGS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  TAX_POLICY_SETTINGS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  TAX_POLICY_SETTINGS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The pinned app SDK (2.35.0) predates heightBehavior; the 2.42 server validates and
// stores it, and the tax panel needs to own its scroll container instead of the page.
type ViewportWidgetManifest = PageLayoutWidgetManifest & {
  heightBehavior?: 'TAB_VIEWPORT';
};

const TAX_POLICY_SETTINGS_WIDGET: ViewportWidgetManifest = {
  universalIdentifier: TAX_POLICY_SETTINGS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
  title: 'پیش‌نیازهای حسابداری',
  type: 'FRONT_COMPONENT',
  heightBehavior: 'TAB_VIEWPORT',
  configuration: {
    configurationType: 'FRONT_COMPONENT',
    frontComponentUniversalIdentifier:
      TAX_POLICY_SETTINGS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  },
};

// The reachable tax settings surface, rendered as one viewport-height widget.
export default definePageLayout({
  universalIdentifier: TAX_POLICY_SETTINGS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'پیش‌نیازهای حسابداری',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: TAX_POLICY_SETTINGS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'پیش‌نیازهای حسابداری',
      position: 0,
      icon: 'IconPercentage',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [TAX_POLICY_SETTINGS_WIDGET],
    },
  ],
});
