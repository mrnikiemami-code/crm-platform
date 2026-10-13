import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  SMS_TEMPLATE_STUDIO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  SMS_TEMPLATE_STUDIO_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  SMS_TEMPLATE_STUDIO_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  SMS_TEMPLATE_STUDIO_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The SMS Template Studio — an app-owned STANDALONE_PAGE whose single widget is
// the studio front component. A standalone page (rather than a RECORD_PAGE)
// matches the task: one dedicated full-width studio with no record chrome and
// no "quick create" form.
//
// The layout holds NO storage: the studio reads and writes the existing native
// `messageTemplate` object through the app's own route.
export default definePageLayout({
  universalIdentifier: SMS_TEMPLATE_STUDIO_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'SMS Template Studio',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier:
        SMS_TEMPLATE_STUDIO_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Templates',
      position: 0,
      icon: 'IconTemplate',
      layoutMode: PageLayoutTabLayoutMode.GRID,
      widgets: [
        {
          universalIdentifier:
            SMS_TEMPLATE_STUDIO_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'SMS Template Studio',
          type: 'FRONT_COMPONENT',
          gridPosition: {
            row: 0,
            column: 0,
            rowSpan: 12,
            columnSpan: 12,
          },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              SMS_TEMPLATE_STUDIO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
