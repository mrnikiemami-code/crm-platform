import { useEffect } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  AppPath,
  navigate,
  useSelectedRecordIds,
  useTranslate,
} from 'twenty-sdk/front-component';

import { composerStyles as styles } from 'src/components/composer-shared';
import { EDIT_TEMPLATE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// The record-selection command behind the visible «ویرایش» action.
//
// WHY THIS EXISTS: the native table has no per-row action button for this object,
// so the only discoverable way to edit was to notice that the title is a link.
// This command puts an explicit, named Edit entry on the platform's OWN row
// command bar: select a template, and «ویرایش الگو» appears with the other
// commands. That is the supported mechanism — no bespoke table or modal.
//
// It only NAVIGATES to the record page, which is the app's editor surface. It
// reads the selection the host already made; it never writes anything, so it
// cannot alter a template by being clicked.
const EditTemplateCommand = () => {
  const { t } = useTranslate();
  const selectedRecordIds = useSelectedRecordIds();

  useEffect(() => {
    const firstId = selectedRecordIds[0];

    if (firstId === undefined) {
      return;
    }

    void navigate(AppPath.RecordShowPage, {
      objectNameSingular: 'messageTemplate',
      objectRecordId: firstId,
    });
  }, [selectedRecordIds]);

  return (
    <div style={styles.container}>
      <p style={styles.muted}>{t('Opening the template editor…')}</p>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: EDIT_TEMPLATE_EDITOR_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'edit-template-command',
  description:
    'Opens the selected template in the app editor from the row command bar.',
  component: EditTemplateCommand,
});
