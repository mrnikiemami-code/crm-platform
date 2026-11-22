import {
  type PageLayoutWidgetManifest,
  definePageLayout,
  PageLayoutTabLayoutMode,
} from 'twenty-sdk/define';

import {
  ACCOUNTING_SETTINGS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_SETTINGS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_SETTINGS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  ACCOUNTING_SETTINGS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The pinned app SDK (2.35.0) predates heightBehavior; the 2.42 server validates and
// stores it, and the panel owns its scroll container instead of the page.
type ViewportWidgetManifest = PageLayoutWidgetManifest & {
  heightBehavior?: 'TAB_VIEWPORT';
};

const ACCOUNTING_SETTINGS_WIDGET: ViewportWidgetManifest = {
  universalIdentifier: ACCOUNTING_SETTINGS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
  title: 'تنظیمات حسابداری',
  type: 'FRONT_COMPONENT',
  heightBehavior: 'TAB_VIEWPORT',
  configuration: {
    configurationType: 'FRONT_COMPONENT',
    frontComponentUniversalIdentifier:
      ACCOUNTING_SETTINGS_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  },
};

// Workspace settings, deliberately independent of any quotation. The record tab keeps
// document-specific operations only; both read the same connection through the same app
// service, so there is one form and one contract.
export default definePageLayout({
  universalIdentifier: ACCOUNTING_SETTINGS_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'تنظیمات حسابداری',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: ACCOUNTING_SETTINGS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'تنظیمات حسابداری',
      position: 0,
      icon: 'IconPlugConnected',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [ACCOUNTING_SETTINGS_WIDGET],
    },
  ],
});
