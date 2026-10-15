import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_VARIABLES_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_VARIABLES_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The record page for one message template.
//
// WHY ONLY ONE TAB: the page used to start with a `FIELDS` widget, which renders
// EVERY field of the object. That leaked this model's own technical identifiers
// (`sourceObjectUid`, `recipientRelationUid`), the relation's API name, and the
// engine's `name` field into the normal form — and it showed a SECOND source
// control beside the editor's. A field-list widget therefore cannot be used here.
//
// The template is edited through the app's own inline editor instead, which owns
// the whole flow: title, ONE source control, the RTL body, the variables, the
// sample person, the preview and Save/Cancel. That is this object's supported
// extension point, so no bespoke modal is introduced, and the stored fields are
// untouched — they are simply no longer rendered as a raw metadata list.
//
// The old field-list tab and its widget are REMOVED BY OMISSION: the manifest sync
// deletes an entity that is no longer declared. Reusing their identifiers for a
// different widget type would not work, because a manifest entity's type is
// immutable in place.
export default definePageLayout({
  universalIdentifier: MESSAGE_TEMPLATE_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Message template record page',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  tabs: [
    {
      universalIdentifier:
        MESSAGE_TEMPLATE_VARIABLES_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'ویرایشگر',
      position: 0,
      icon: 'IconTemplate',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier:
            MESSAGE_TEMPLATE_VARIABLES_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'الگو',
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
