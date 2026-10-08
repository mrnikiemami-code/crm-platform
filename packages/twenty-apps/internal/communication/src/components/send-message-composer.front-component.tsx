import { defineFrontComponent } from 'twenty-sdk/define';
import {
  closeSidePanel,
  unmountFrontComponent,
  useLocale,
  useSelectedRecordIds,
  useTranslate,
} from 'twenty-sdk/front-component';

import { BulkPersonComposer } from 'src/components/bulk-composer';
import { composerStyles as styles, getTextDirection } from 'src/components/composer-shared';
import {
  resolveComposerMode,
  resolveSingleRecordId,
} from 'src/components/composer-selection-mode';
import { SinglePersonComposer } from 'src/components/single-person-composer';
import { SEND_MESSAGE_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// The Person "Send SMS" command entry point. It branches on the host's
// multi-record selection:
//  - one record  → the existing single-person form (unchanged behavior),
//  - many records → the bulk preview form (W15-A: preview only, no sending).
//
// The selection arrives through the locked SDK hook `useSelectedRecordIds()`,
// which the host populates from the record selection (record index or show
// page). No ids are invented and no core change is required.
const SendMessageComposer = () => {
  const { t } = useTranslate();
  const locale = useLocale();
  const selectedRecordIds = useSelectedRecordIds();

  const mode = resolveComposerMode(selectedRecordIds);
  const direction = getTextDirection(locale);

  if (mode === 'BULK') {
    return <BulkPersonComposer personIds={selectedRecordIds} />;
  }

  if (mode === 'SINGLE') {
    return <SinglePersonComposer personId={resolveSingleRecordId(selectedRecordIds)} />;
  }

  return (
    <div style={{ ...styles.container, direction }}>
      <p style={styles.heading}>{t('Send SMS')}</p>
      <p style={styles.hint}>{t('No person is selected.')}</p>
      <div style={styles.actions}>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => {
            unmountFrontComponent();
            closeSidePanel();
          }}
        >
          {t('Close')}
        </button>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: SEND_MESSAGE_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'send-message-composer',
  description: 'Composer to send an outbound message to one or more people.',
  component: SendMessageComposer,
});
