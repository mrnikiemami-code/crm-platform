import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_BODY_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_BODY_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_FIELDS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_FIELDS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_VARIABLES_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_VARIABLES_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The record page for one message template. It gives template management its
// own layout: a compact fields tab (title, channel) and a "Message" tab that
// pairs the native SMS body editor with the «متغیرهای قابل استفاده» guide, so
// the variables are visible exactly where the body is written.
//
// A manifest page layout is an ADDITIONAL layout: the engine default remains,
// so this only adds the app's own tabs. The body is edited through the native
// FIELD widget (the platform's own editor) and the guide is a FRONT_COMPONENT
// widget that reads the SAME catalog the server evaluates.
export default definePageLayout({
  universalIdentifier: MESSAGE_TEMPLATE_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Message template record page',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  tabs: [
    {
      universalIdentifier:
        MESSAGE_TEMPLATE_FIELDS_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Fields',
      position: 0,
      icon: 'IconList',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier:
            MESSAGE_TEMPLATE_FIELDS_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Fields',
          type: 'FIELDS',
          configuration: {
            configurationType: 'FIELDS',
          },
        },
      ],
    },
    {
      universalIdentifier:
        MESSAGE_TEMPLATE_BODY_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Message',
      position: 1,
      icon: 'IconMessage',
      layoutMode: PageLayoutTabLayoutMode.GRID,
      widgets: [
        {
          universalIdentifier:
            MESSAGE_TEMPLATE_BODY_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Message',
          type: 'FIELD',
          objectUniversalIdentifier: MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
          gridPosition: {
            row: 0,
            column: 0,
            rowSpan: 12,
            columnSpan: 12,
          },
          configuration: {
            configurationType: 'FIELD',
            fieldMetadataId: MESSAGE_TEMPLATE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
            fieldDisplayMode: 'EDITOR',
          },
        },
      ],
    },
    {
      universalIdentifier:
        MESSAGE_TEMPLATE_VARIABLES_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Variables',
      position: 2,
      icon: 'IconVariable',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier:
            MESSAGE_TEMPLATE_VARIABLES_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Usable variables',
          type: 'FRONT_COMPONENT',
          objectUniversalIdentifier: MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
