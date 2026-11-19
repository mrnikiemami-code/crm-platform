import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  QUOTATION_ACTIONS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  QUOTATION_ACTIONS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
  QUOTATION_FIELDS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  QUOTATION_FIELDS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
  QUOTATION_LIFECYCLE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// App RECORD_PAGE replaces the default layout, so a FIELDS tab is required or
// the record shows "No Data". Lifecycle actions live on a second tab.
export default definePageLayout({
  universalIdentifier: QUOTATION_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'صفحه پیش‌فاکتور',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  tabs: [
    {
      universalIdentifier: QUOTATION_FIELDS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'فیلدها',
      position: 0,
      icon: 'IconList',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier:
            QUOTATION_FIELDS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'فیلدهای پیش‌فاکتور',
          type: 'FIELDS',
          configuration: {
            configurationType: 'FIELDS',
          },
        },
      ],
    },
    {
      universalIdentifier: QUOTATION_ACTIONS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'اقدامات',
      position: 50,
      icon: 'IconCheckbox',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier:
            QUOTATION_ACTIONS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'گردش وضعیت و PDF',
          type: 'FRONT_COMPONENT',
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              QUOTATION_LIFECYCLE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
