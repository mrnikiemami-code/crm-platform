import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  QUOTATION_ACTIONS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  QUOTATION_ACTIONS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
  QUOTATION_FIELDS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  QUOTATION_FIELDS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
  QUOTATION_LIFECYCLE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTATION_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// A quotation is a document with lines and exact-money calculations, not a bag
// of editable database fields. Reuse the same professional editor that creates
// quotations; the record widget receives its quotation id from the host.
// Lifecycle operations remain on the separate Actions tab.
export default definePageLayout({
  universalIdentifier: QUOTATION_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'صفحه پیش‌فاکتور',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: QUOTATION_OBJECT_UNIVERSAL_IDENTIFIER,
  tabs: [
    {
      universalIdentifier: QUOTATION_FIELDS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'پیش‌فاکتور',
      position: 0,
      icon: 'IconFileInvoice',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier:
            QUOTATION_FIELDS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'مشخصات و ردیف‌های پیش‌فاکتور',
          type: 'FRONT_COMPONENT',
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              QUOTATION_DRAFT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
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
