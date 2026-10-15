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
  // The label is Persian IN THE MANIFEST on purpose.
  //
  // Why not the app catalog: the platform's `CommandMenuItemRenderer` passes the
  // label straight through to the rendered text with no translation call — unlike
  // view names, object labels and this app's page-layout titles, which ARE
  // resolved through the catalog. An app command menu item's label is therefore
  // shown verbatim, so a catalog entry cannot translate it. Persian is declared
  // here, the same way the «موجودیت منبع» field label and the editor tab titles
  // already are.
  label: 'ویرایش الگو',
  shortLabel: 'ویرایش الگو',
  // PINNED so it renders as a visible button for the selected records instead of
  // hiding behind the command palette. Ctrl+K is then a shortcut, not the only
  // way to reach the editor.
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: MESSAGE_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    EDIT_TEMPLATE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
