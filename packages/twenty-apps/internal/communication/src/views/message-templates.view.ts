import { defineView, ViewType } from 'twenty-sdk/define';

import {
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_TARGET_OBJECT_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_TARGET_OBJECT_VIEW_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_UPDATED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_UPDATED_AT_VIEW_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// The workspace templates list, opened by the «الگوهای پیامک» sidebar entry.
//
// The columns are the three a template manager actually reads: the title, the
// source entity the template is written for, and when it was last changed. The
// `updatedAt` column is the platform's own SYSTEM field, referenced by its
// derived universal identifier — a manifest view can only reference fields by
// universal identifier, and system fields are not declared by the app.
//
// Everything else is the platform's: the table itself, the column header menu,
// search, filter, sort, paging, and the record create/edit/delete flow. This
// view only chooses which columns the list starts with; it is never a parallel
// data surface.
export default defineView({
  universalIdentifier: MESSAGE_TEMPLATES_VIEW_UNIVERSAL_IDENTIFIER,
  // The sidebar entry renders `<view name> · <object plural>`, so the view is
  // named «همهٔ الگوها» and the sidebar reads «همهٔ الگوها · الگوهای پیامک» instead
  // of repeating the object name twice.
  name: 'All templates',
  objectUniversalIdentifier: MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: ViewType.TABLE,
  icon: 'IconTemplate',
  position: 1,
  fields: [
    {
      universalIdentifier: '101023b6-4456-46c3-a06e-7f8eba259817',
      fieldMetadataUniversalIdentifier:
        MESSAGE_TEMPLATE_TITLE_FIELD_UNIVERSAL_IDENTIFIER,
      position: 0,
      isVisible: true,
      size: 240,
    },
    {
      // A NEW view-field identifier: a view field's target field is its identity,
      // so the previous channel column cannot be repointed and is simply no
      // longer declared (the sync removes it).
      universalIdentifier:
        MESSAGE_TEMPLATE_TARGET_OBJECT_VIEW_FIELD_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        MESSAGE_TEMPLATE_TARGET_OBJECT_FIELD_UNIVERSAL_IDENTIFIER,
      position: 1,
      isVisible: true,
      size: 140,
    },
    {
      universalIdentifier:
        MESSAGE_TEMPLATE_UPDATED_AT_VIEW_FIELD_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier:
        MESSAGE_TEMPLATE_UPDATED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      position: 2,
      isVisible: true,
      size: 160,
    },
  ],
});
