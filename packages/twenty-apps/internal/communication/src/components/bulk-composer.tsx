import { useCallback, useEffect, useRef, useState } from 'react';
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
  resolveBulkRecipientsLoadState,
  resolvePreviewLoadState,
  resolveTemplatesLoadState,
} from 'src/components/bulk-composer-state';
import {
  callAppRoute,
  composerStyles as styles,
  getTextDirection,
  phoneValueStyle,
} from 'src/components/composer-shared';

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
  const [previewError, setPreviewError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  // Monotonic request ids: a slow earlier response can never overwrite a newer
  // one for either read-only route.
  const recipientsRequestIdRef = useRef(0);
  const previewRequestIdRef = useRef(0);

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

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

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

  // A caller may have chosen an alternate number for a person. Only the changed
  // ones are sent as overrides.
  const buildPhoneOverrides = (): Record<string, string> => {
    const overrides: Record<string, string> = {};

    for (const recipient of visibleRecipients) {
      const chosen = phoneSelections[recipient.personId];

      if (chosen !== undefined && chosen !== recipient.selectedPhone) {
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

    previewRequestIdRef.current += 1;
    const requestId = previewRequestIdRef.current;

    setPreviewError(null);
    setPreviewState({ kind: 'LOADING' });

    try {
      const response = await callAppRoute(
        '/communication/preview-template',
        'POST',
        {
          body,
          personIds: effectivePersonIds,
          phoneOverrides: buildPhoneOverrides(),
        },
      );

      if (requestId !== previewRequestIdRef.current) {
        return;
      }

      setPreviewState(resolvePreviewLoadState(response));
    } catch {
      if (requestId !== previewRequestIdRef.current) {
        return;
      }

      setPreviewError(t('Unable to build the preview.'));
      setPreviewState({ kind: 'ERROR' });
    }
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

  const templates = templatesState.kind === 'READY' ? templatesState.templates : [];
  const variables = templatesState.kind === 'READY' ? templatesState.variables : [];

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
              const chosen =
                phoneSelections[recipient.personId] ??
                recipient.selectedPhone ??
                '';

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

        {recipientsState.kind === 'READY' &&
          recipientsState.sharedPhoneWarnings.length > 0 && (
            <p style={styles.warning}>
              {t('Some people share the same number:')}{' '}
              {describeSharedPhoneWarnings(
                recipientsState.sharedPhoneWarnings,
              ).join(', ')}
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
            {templates.length === 0 ? t('No templates available') : t('Choose a template')}
          </option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title.length > 0 ? template.title : template.id}
            </option>
          ))}
        </select>
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

      {previewError !== null && <p style={styles.error}>{previewError}</p>}

      {previewState.kind === 'READY' && (
        <div style={styles.field}>
          <span style={styles.label}>
            {t('Preview')} — {t('Ready')}: {previewState.readyCount}/
            {previewState.previews.length}
          </span>

          {previewState.hasUnresolvedVariables && (
            <p style={styles.warning}>
              {t('Some variables could not be resolved and are not ready to send.')}
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
