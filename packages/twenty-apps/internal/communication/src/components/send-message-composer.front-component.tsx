import { defineFrontComponent } from 'twenty-sdk/define';
import {
  closeSidePanel,
  unmountFrontComponent,
  useLocale,
  useSelectedRecordIds,
  useTranslate,
} from 'twenty-sdk/front-component';
import { useEffect, useState } from 'react';

import { BulkPersonComposer } from 'src/components/bulk-composer';
import {
  callAppRoute,
  composerStyles as styles,
  getTextDirection,
} from 'src/components/composer-shared';
import { parseEligibleSources } from 'src/components/eligible-sources';
import type { EligibleSource } from 'src/components/eligible-sources';
import { useObjectNameSingular } from 'src/components/use-object-name-singular';
import {
  resolveComposerMode,
  resolveSingleRecordId,
} from 'src/components/composer-selection-mode';
import { SinglePersonComposer } from 'src/components/single-person-composer';
import { SEND_MESSAGE_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { PERSON_SOURCE_OBJECT_NAME } from 'src/templates/data/find-eligible-template-sources';

// The "Send SMS" command entry point. It branches on the host's record
// selection AND on which object the records belong to:
//  - a Person selection → the existing single/bulk person forms (unchanged),
//  - any other eligible source (an Opportunity, …) → the composer for THAT source,
//    where the template list is filtered to it and the recipient is derived from
//    the selected record,
//  - an object that is not a source at all → a Persian explanation and NO send.
//
// The object identity matters because an id alone does not say which kind of
// record it is. It comes from the host's own command context (never guessed),
// and the command menu item is deliberately not bound to one object so the host
// can offer it for every record selection — which is what makes the explanation
// reachable instead of the command simply not existing there.
const SendMessageComposer = () => {
  const { t } = useTranslate();
  const locale = useLocale();
  const selectedRecordIds = useSelectedRecordIds();
  const objectNameSingular = useObjectNameSingular();

  const direction = getTextDirection(locale);

  const [eligibleSourcesState, setEligibleSourcesState] = useState<
    | { kind: 'LOADING' }
    | { kind: 'READY'; sources: EligibleSource[] }
    | { kind: 'ERROR' }
  >({ kind: 'LOADING' });

  const isPersonContext =
    objectNameSingular === null ||
    objectNameSingular.length === 0 ||
    objectNameSingular === PERSON_SOURCE_OBJECT_NAME;

  // The eligible sources are read from the SERVER, so the client never decides
  // which objects are template sources — it only looks up the identifier of the
  // one the host named.
  useEffect(() => {
    if (isPersonContext) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const response = await callAppRoute(
          '/communication/eligible-sources',
          'POST',
          {},
        );

        if (cancelled) {
          return;
        }

        const parsed = parseEligibleSources(response.data);

        setEligibleSourcesState({ kind: 'READY', sources: parsed });      } catch {
        if (!cancelled) {
          setEligibleSourcesState({ kind: 'ERROR' });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isPersonContext]);

  const selectedSource =
    eligibleSourcesState.kind === 'READY'
      ? eligibleSourcesState.sources.find(
          (entry) => entry.objectName === objectNameSingular,
        )
      : undefined;

  if (isPersonContext) {
    const mode = resolveComposerMode(selectedRecordIds);

    if (mode === 'BULK') {
      return <BulkPersonComposer personIds={selectedRecordIds} />;
    }

    if (mode === 'SINGLE') {
      return (
        <SinglePersonComposer
          personId={resolveSingleRecordId(selectedRecordIds)}
        />
      );
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
  }

  // A non-Person selection. Exactly ONE record is required: the recipient is
  // derived from that record's relation, so a multi-record selection has no single
  // unambiguous recipient and is refused rather than guessed.
  const isSingleRecord = selectedRecordIds.length === 1;

  if (eligibleSourcesState.kind === 'LOADING') {
    return (
      <div style={{ ...styles.container, direction }}>
        <p style={styles.muted}>{t('Loading…')}</p>
      </div>
    );
  }

  if (
    eligibleSourcesState.kind === 'READY' &&
    selectedSource !== undefined &&
    isSingleRecord
  ) {
    return (
      <SinglePersonComposer
        personId={null}
        contextSourceObjectUid={selectedSource.objectUid}
        contextObjectName={selectedSource.objectName}
        contextRecordId={selectedRecordIds[0]}
        contextRelationUid={
          selectedSource.relations.length === 1
            ? selectedSource.relations[0].relationUid
            : null
        }
      />
    );
  }

  return (
    <div style={{ ...styles.container, direction }} data-composer-unsupported>
      <p style={styles.heading}>{t('Send SMS')}</p>
      <p style={styles.hint}>
        {selectedRecordIds.length > 1
          ? t(
              'Select exactly one record: the recipient is taken from that record.',
            )
          : t(
              'This command sends to people. For records of this type, open the record and use the template editor there.',
            )}
      </p>
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
