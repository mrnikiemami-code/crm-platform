import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  closeSidePanel,
  unmountFrontComponent,
  useLocale,
  useTranslate,
} from 'twenty-sdk/front-component';

import {
  type BulkRecipientsLoadState,
  type BulkRecipient,
  type PreviewLoadState,
  type TemplatesLoadState,
  describeSharedPhoneWarnings,
  recomputeVisibleSharedPhoneWarnings,
  resolveBulkRecipientsLoadState,
  resolveTemplatesLoadState,
} from 'src/components/bulk-composer-state';
import {
  callAppRoute,
  composerStyles as styles,
  getTextDirection,
  phoneValueStyle,
} from 'src/components/composer-shared';
import {
  createPreviewConnection,
  type PreviewConnection,
} from 'src/components/preview-connection';

// The bulk form. W15-A is PREVIEW ONLY: it resolves recipients, lets a user
// pick a template, choose a number per person, remove recipients and see a
// per-recipient preview. The bulk send action is deliberately disabled until
// the safe bulk execution path ships in W15-B.
export const BulkPersonComposer = ({ personIds }: { personIds: string[] }) => {
  const { t } = useTranslate();
  const locale = useLocale();

  const direction = getTextDirection(locale);

  const [recipientsState, setRecipientsState] =
    useState<BulkRecipientsLoadState>({ kind: 'LOADING' });
  const [templatesState, setTemplatesState] = useState<TemplatesLoadState>({
    kind: 'LOADING',
  });
  const [removedPersonIds, setRemovedPersonIds] = useState<string[]>([]);
  const [phoneSelections, setPhoneSelections] = useState<Record<string, string>>(
    {},
  );
  const [body, setBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [previewState, setPreviewState] = useState<PreviewLoadState>({
    kind: 'IDLE',
  });

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  // Monotonic request id for the recipients read, so a slow earlier response
  // cannot overwrite a newer one.
  const recipientsRequestIdRef = useRef(0);

  // The selection is passed as a stable string key so the load effect depends on
  // its VALUE, not on a new array identity on every render (which would loop).
  const personIdsKey = personIds.join(',');

  const loadRecipients = useCallback(async () => {
    recipientsRequestIdRef.current += 1;
    const requestId = recipientsRequestIdRef.current;

    const ids = personIdsKey.length > 0 ? personIdsKey.split(',') : [];

    setRecipientsState({ kind: 'LOADING' });

    try {
      const response = await callAppRoute(
        '/communication/bulk-recipients',
        'POST',
        { personIds: ids },
      );

      if (requestId !== recipientsRequestIdRef.current) {
        return;
      }

      setRecipientsState(resolveBulkRecipientsLoadState(response));
    } catch {
      if (requestId !== recipientsRequestIdRef.current) {
        return;
      }

      setRecipientsState({ kind: 'ERROR' });
    }
  }, [personIdsKey]);

  const loadTemplates = useCallback(async () => {
    try {
      const response = await callAppRoute(
        '/communication/message-templates',
        'POST',
      );

      setTemplatesState(resolveTemplatesLoadState(response));
    } catch {
      setTemplatesState({ kind: 'ERROR' });
    }
  }, []);

  // One preview connection for the component's lifetime. Its request-id counter
  // is shared across every preview, so `invalidate()` can silence an in-flight
  // request and only the latest one may publish state.
  const previewConnectionRef = useRef<PreviewConnection | null>(null);

  if (previewConnectionRef.current === null) {
    previewConnectionRef.current = createPreviewConnection({
      transport: (request) =>
        callAppRoute('/communication/preview-template', 'POST', request),
      onState: (state) => setPreviewState(state),
    });
  }

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  // A change to the message, template, numbers, recipient set or selection
  // makes the previous preview stale: it is voided immediately and any in-flight
  // request is silenced, so an old preview can never reappear.
  useEffect(() => {
    previewConnectionRef.current?.invalidate();
    setPreviewState({ kind: 'IDLE' });
  }, [body, selectedTemplateId, phoneSelections, removedPersonIds, personIdsKey]);

  // Cleanup on unmount: silence any in-flight preview for good.
  useEffect(() => {
    const connection = previewConnectionRef.current;

    return () => {
      connection?.invalidate();
    };
  }, []);

  const allRecipients: BulkRecipient[] =
    recipientsState.kind === 'READY' ? recipientsState.recipients : [];

  const visibleRecipients = allRecipients.filter(
    (recipient) => !removedPersonIds.includes(recipient.personId),
  );

  const effectivePersonIds = visibleRecipients.map(
    (recipient) => recipient.personId,
  );

  const sendableRecipients = visibleRecipients.filter(
    (recipient) => recipient.status === 'SENDABLE',
  );

  const unsendableRecipients = visibleRecipients.filter(
    (recipient) => recipient.status !== 'SENDABLE',
  );

  // The number each remaining recipient would actually use right now: the
  // chosen alternate when present, otherwise the default.
  const chosenPhoneByPersonId = new Map<string, string | null>(
    visibleRecipients.map((recipient) => [
      recipient.personId,
      phoneSelections[recipient.personId] ?? recipient.selectedPhone,
    ]),
  );

  // Recomputed from the CURRENT numbers and the REMAINING recipients, so the
  // warning updates live as recipients are removed or numbers are switched.
  const liveSharedPhoneWarnings = useMemo(
    () =>
      recomputeVisibleSharedPhoneWarnings(
        visibleRecipients.map((recipient) => ({
          personId: recipient.personId,
          selectedPhone:
            phoneSelections[recipient.personId] ?? recipient.selectedPhone,
        })),
      ),
    [visibleRecipients, phoneSelections],
  );

  // Every sendable recipient's CURRENT number is sent as an override, so the
  // server evaluates exactly the numbers the user sees. A value the server does
  // not recognise as belonging to that Person is reported as invalid.
  const buildPhoneOverrides = (): Record<string, string> => {
    const overrides: Record<string, string> = {};

    for (const recipient of sendableRecipients) {
      const chosen = chosenPhoneByPersonId.get(recipient.personId);

      if (typeof chosen === 'string' && chosen.length > 0) {
        overrides[recipient.personId] = chosen;
      }
    }

    return overrides;
  };

  const handleSelectPhone = (personId: string, phone: string) => {
    setPhoneSelections((current) => ({ ...current, [personId]: phone }));
  };

  const handleRemoveRecipient = (personId: string) => {
    setRemovedPersonIds((current) =>
      current.includes(personId) ? current : [...current, personId],
    );
  };

  const handleInsertVariable = (token: string) => {
    const textarea = bodyRef.current;

    if (textarea === null) {
      setBody((current) => `${current}${token}`);
      return;
    }

    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const nextBody = `${body.slice(0, start)}${token}${body.slice(end)}`;

    setBody(nextBody);

    // Restore the caret after the inserted token on the next paint.
    setTimeout(() => {
      textarea.focus();
      const caret = start + token.length;

      textarea.setSelectionRange(caret, caret);
    }, 0);
  };

  const handlePreview = async () => {
    if (effectivePersonIds.length === 0) {
      return;
    }

    await previewConnectionRef.current?.start({
      body,
      personIds: effectivePersonIds,
      phoneOverrides: buildPhoneOverrides(),
    });
  };

  const handleClose = () => {
    unmountFrontComponent();
    closeSidePanel();
  };

  const containerStyle = { ...styles.container, direction };

  const recipientsPlaceholder =
    recipientsState.kind === 'LOADING'
      ? t('Loading recipients…')
      : t('Unable to load recipients.');

  const templates =
    templatesState.kind === 'READY' ? templatesState.templates : [];
  const variables =
    templatesState.kind === 'READY' || templatesState.kind === 'EMPTY'
      ? templatesState.variables
      : [];

  const templatesPlaceholder =
    templatesState.kind === 'LOADING'
      ? t('Loading templates…')
      : templatesState.kind === 'ERROR'
        ? t('Unable to load templates.')
        : t('No templates available');

  const displayNameByPersonId = new Map(
    visibleRecipients.map((recipient) => [
      recipient.personId,
      recipient.displayName,
    ]),
  );

  return (
    <div style={containerStyle}>
      <div style={styles.field}>
        <p style={styles.heading}>{t('Send SMS to multiple people')}</p>
        <p style={styles.hint}>
          {t('Preview only. Bulk sending is not available yet.')}
        </p>
      </div>

      <div style={styles.field}>
        <span style={styles.label}>
          {t('Recipients')} ({visibleRecipients.length})
        </span>

        {recipientsState.kind === 'LOADING' || recipientsState.kind === 'ERROR' ? (
          <p style={styles.muted}>{recipientsPlaceholder}</p>
        ) : (
          <ul style={styles.recipientList}>
            {visibleRecipients.map((recipient) => {
              const isSendable = recipient.status === 'SENDABLE';
              const chosen = chosenPhoneByPersonId.get(recipient.personId) ?? '';

              return (
                <li key={recipient.personId} style={styles.recipientRow}>
                  <div style={styles.recipientHeader}>
                    <span style={styles.recipientName}>{recipient.displayName}</span>
                    {!isSendable && (
                      <span style={styles.recipientBadge}>
                        {recipient.status === 'NO_PHONE'
                          ? t('No phone number')
                          : t('Not accessible')}
                      </span>
                    )}
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => handleRemoveRecipient(recipient.personId)}
                    >
                      {t('Remove')}
                    </button>
                  </div>

                  {isSendable && (
                    <select
                      value={chosen}
                      onChange={(event) =>
                        handleSelectPhone(recipient.personId, event.target.value)
                      }
                      style={{ ...styles.control, ...phoneValueStyle }}
                    >
                      {recipient.phones.map((phone) => (
                        <option key={phone.id} value={phone.value}>
                          {phone.value}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {recipientsState.kind === 'READY' && (
          <p style={styles.muted}>
            {t('Sendable')}: {sendableRecipients.length} · {t('Unsendable')}:{' '}
            {unsendableRecipients.length}
          </p>
        )}

        {recipientsState.kind === 'READY' &&
          recipientsState.duplicatePersonIds.length > 0 && (
            <p style={styles.warning}>
              {t('Duplicate selections were removed:')}{' '}
              {recipientsState.duplicatePersonIds.length}
            </p>
          )}

        {liveSharedPhoneWarnings.length > 0 && (
          <p style={styles.warning}>
            {t('Some people share the same number:')}{' '}
            {describeSharedPhoneWarnings(liveSharedPhoneWarnings).join(', ')}
          </p>
        )}
      </div>

      <label style={styles.field}>
        <span style={styles.label}>{t('Template')}</span>
        <select
          value={selectedTemplateId}
          onChange={(event) => {
            const template = templates.find(
              (candidate) => candidate.id === event.target.value,
            );

            setSelectedTemplateId(event.target.value);

            if (template !== undefined) {
              setBody(template.body);
            }
          }}
          disabled={templates.length === 0}
          style={styles.control}
        >
          <option value="">
            {templates.length === 0
              ? templatesPlaceholder
              : t('Choose a template')}
          </option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title.length > 0 ? template.title : template.id}
            </option>
          ))}
        </select>
        {templatesState.kind === 'ERROR' && (
          <p style={styles.error}>{t('Unable to load templates.')}</p>
        )}
      </label>

      <div style={styles.field}>
        <span style={styles.label}>{t('Variables')}</span>
        <div style={styles.variableChips}>
          {variables.map((variable) => (
            <button
              key={variable.token}
              type="button"
              style={styles.chip}
              onClick={() => handleInsertVariable(variable.token)}
            >
              {t(variable.label)} ({variable.token})
            </button>
          ))}
        </div>
        <p style={styles.muted}>
          {t('Variables are resolved on the server for each recipient.')}
        </p>
      </div>

      <label style={styles.field}>
        <span style={styles.label}>{t('Message')}</span>
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          style={{ ...styles.control, resize: 'vertical' }}
        />
      </label>

      {previewState.kind === 'ERROR' && (
        <p style={styles.error}>{t('Unable to build the preview.')}</p>
      )}

      {previewState.kind === 'READY' && (
        <div style={styles.field}>
          <span style={styles.label}>
            {t('Preview')} — {t('Ready')}: {previewState.readyCount}/
            {previewState.previews.length}
          </span>

          {previewState.isBodyEmpty && (
            <p style={styles.warning}>{t('The message is empty.')}</p>
          )}

          {previewState.hasUnresolvedVariables && (
            <p style={styles.warning}>
              {t('Some variables could not be resolved and are not ready to send.')}
            </p>
          )}

          {previewState.invalidOverrides.length > 0 && (
            <p style={styles.warning}>
              {t('Some selected numbers were invalid and were ignored:')}{' '}
              {previewState.invalidOverrides
                .map(
                  (personId) =>
                    displayNameByPersonId.get(personId) ?? personId,
                )
                .join(', ')}
            </p>
          )}

          {previewState.sharedPhoneWarnings.length > 0 && (
            <p style={styles.warning}>
              {t('Some people share the same number:')}{' '}
              {describeSharedPhoneWarnings(
                previewState.sharedPhoneWarnings,
              ).join(', ')}
            </p>
          )}

          <ul style={styles.recipientList}>
            {previewState.previews.map((preview) => (
              <li key={preview.personId} style={styles.recipientRow}>
                <div style={styles.recipientHeader}>
                  <span style={styles.recipientName}>{preview.displayName}</span>
                  {!preview.isReadyToSend && (
                    <span style={styles.recipientBadge}>
                      {t('Not ready')}
                    </span>
                  )}
                </div>
                {preview.phone !== null && (
                  <span style={{ ...styles.muted, ...phoneValueStyle }}>
                    {preview.phone}
                  </span>
                )}
                <p style={styles.preview}>{preview.previewText}</p>
                {preview.issues.length > 0 && (
                  <p style={styles.warning}>
                    {preview.issues
                      .map((issue) =>
                        issue.kind === 'EMPTY_FIELD'
                          ? `${issue.token}: ${t('Empty field')}`
                          : `${issue.token}: ${t('Unknown variable')}`,
                      )
                      .join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={styles.actions}>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={handleClose}
        >
          {t('Cancel')}
        </button>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={handlePreview}
          disabled={
            previewState.kind === 'LOADING' || effectivePersonIds.length === 0
          }
        >
          {previewState.kind === 'LOADING' ? t('Loading...') : t('Preview')}
        </button>
        <button
          type="button"
          style={{ ...styles.primaryButton, ...styles.primaryButtonDisabled }}
          disabled
        >
          {t('Bulk sending is not available yet.')}
        </button>
      </div>
    </div>
  );
};
