import { defineCommandMenuItem } from 'twenty-sdk/define';

import {
  EDIT_TEMPLATE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  EDIT_TEMPLATE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// A visible, named «ویرایش الگو» action for a selected template.
//
// WHY: the native table renders no per-row action button for this object, so the
// only discoverable way to edit was to notice that the row's title is a link. This
// declares the action through the platform's OWN command mechanism — select a
// template in the list and the command appears with the others — so editing has
// an explicit entry point without a bespoke table or a new modal.
//
// It is `RECORD_SELECTION` on `messageTemplate` and nothing else: the command can
// only ever be offered for this app's own object, and it only navigates.
export default defineCommandMenuItem({
  universalIdentifier: EDIT_TEMPLATE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  // Persian copy through the app catalog (`commandMenuItem.label`/`shortLabel`).
  label: 'Edit template',
  shortLabel: 'Edit template',
  isPinned: false,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    EDIT_TEMPLATE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
