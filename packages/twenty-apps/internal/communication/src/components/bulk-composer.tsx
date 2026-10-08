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
import { buildBulkConfirmationPlan } from 'src/components/bulk-confirmation-plan';
import {
  createBulkSendConnection,
  type BulkSendConnection,
  type BulkSendProgressState,
} from 'src/components/bulk-send-connection';
import {
  buildBulkExcludedDisplay,
  buildBulkRecipientDisplay,
  buildBulkSummaryPresentation,
  type BulkRecipientVariant,
} from 'src/components/bulk-send-presentation';
import {
  BULK_SEND_DEADLINE_MS,
  callAppRoute,
  composerStyles as styles,
  getTextDirection,
  phoneValueStyle,
} from 'src/components/composer-shared';
import {
  createPreviewConnection,
  type PreviewConnection,
} from 'src/components/preview-connection';

// The bulk form. W15-A previews the group; W15-B sends it. The send button is
// enabled only for a CURRENT, VALID preview, and sends the confirmed recipients
// ONE BY ONE through the existing send route (never batched).
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
  // The confirmation panel is shown for a current, valid preview.
  const [isConfirming, setIsConfirming] = useState(false);
  // A shared number needs its own explicit acknowledgement before sending.
  const [hasAcknowledgedSharedNumber, setHasAcknowledgedSharedNumber] =
    useState(false);
  const [sendState, setSendState] = useState<BulkSendProgressState>({
    isRunning: false,
    results: [],
    currentPersonId: null,
    summary: null,
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

  // One send connection for the component's lifetime: the SAME object the send
  // button calls, so the button and the coordinator cannot drift.
  const sendConnectionRef = useRef<BulkSendConnection | null>(null);

  if (sendConnectionRef.current === null) {
    sendConnectionRef.current = createBulkSendConnection({
      transport: (request) =>
        callAppRoute('/communication/send', 'POST', request, {
          // The bulk request gets a bounded client-side waiting deadline; the
          // single-send path keeps its original no-deadline behavior.
          timeoutMs: BULK_SEND_DEADLINE_MS,
        }),
      onState: (state) => setSendState(state),
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
  // request is silenced, so an old preview can never reappear. A stale preview
  // also closes the confirmation panel and resets the shared-number consent.
  useEffect(() => {
    previewConnectionRef.current?.invalidate();
    setPreviewState({ kind: 'IDLE' });
    setIsConfirming(false);
    setHasAcknowledgedSharedNumber(false);
  }, [body, selectedTemplateId, phoneSelections, removedPersonIds, personIdsKey]);

  // Cleanup on unmount: silence any in-flight preview AND stop the group. The
  // send connection's invalidate also clears pending results, so a closed form
  // can never re-run a stale group.
  useEffect(() => {
    const preview = previewConnectionRef.current;
    const send = sendConnectionRef.current;

    return () => {
      preview?.invalidate();
      send?.invalidate();
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

  // Every sendable recipient's CURRENT selection is sent as an override, so the
  // server evaluates exactly what the user sees. An EXPLICITLY empty selection
  // is sent as an empty string (not omitted) so the server reports it as an
  // invalid override instead of falling back to the Person's own number.
  const buildPhoneOverrides = (): Record<string, unknown> => {
    const overrides: Record<string, unknown> = {};

    for (const recipient of sendableRecipients) {
      const chosen = chosenPhoneByPersonId.get(recipient.personId);

      if (typeof chosen === 'string') {
        overrides[recipient.personId] = chosen;
      }
    }

    return overrides;
  };

  const handleSelectPhone = (personId: string, phone: string) => {
    setPhoneSelections((current) => ({ ...current, [personId]: phone }));
  };

  // The confirmed group: built ONLY from the current READY preview, so an
  // invalid or stale preview can never be sent. `null` when there is nothing to
  // confirm.
  const confirmationPlan = useMemo(() => {
    if (previewState.kind !== 'READY') {
      return null;
    }

    return buildBulkConfirmationPlan({
      recipients: visibleRecipients,
      previews: previewState.previews,
    });
  }, [previewState, visibleRecipients]);

  const canOpenConfirmation =
    !sendState.isRunning &&
    sendState.summary === null &&
    confirmationPlan !== null &&
    confirmationPlan.sendable.length > 0;

  const hasSharedNumber = (confirmationPlan?.sharedNumbers.length ?? 0) > 0;

  // The shared-number acknowledgement gates ONLY the final send button. Opening
  // the review panel never sends and never requires the acknowledgement.
  const isFinalSendEnabled =
    !sendState.isRunning &&
    confirmationPlan !== null &&
    confirmationPlan.sendable.length > 0 &&
    (!hasSharedNumber || hasAcknowledgedSharedNumber);

  const handleOpenConfirmation = () => {
    if (!canOpenConfirmation) {
      return;
    }

    // A fresh review always starts from "not acknowledged".
    setHasAcknowledgedSharedNumber(false);
    setIsConfirming(true);
  };

  const handleCancelConfirmation = () => {
    if (sendState.isRunning) {
      return;
    }

    // Cancelling discards the acknowledgement; reopening requires it again.
    setHasAcknowledgedSharedNumber(false);
    setIsConfirming(false);
  };

  const handleSend = async () => {
    if (!isFinalSendEnabled || confirmationPlan === null) {
      return;
    }

    // The plan is a fresh snapshot of the confirmed numbers and texts; inputs
    // are locked from here (the panel is replaced by the results view), so
    // nothing can change what is sent.
    setIsConfirming(false);

    await sendConnectionRef.current?.send({
      recipients: confirmationPlan.sendable,
      channel: 'SMS',
    });
  };

  const handleStop = () => {
    sendConnectionRef.current?.stop();
  };

  const handleDismissResults = () => {
    if (sendState.isRunning) {
      return;
    }

    // Discarding the finished run disposes it: results disappear and a new run
    // requires a FRESH preview and confirmation.
    sendConnectionRef.current?.invalidate();
    setSendState({
      isRunning: false,
      results: [],
      currentPersonId: null,
      summary: null,
    });
    setHasAcknowledgedSharedNumber(false);
    setIsConfirming(false);
    setPreviewState({ kind: 'IDLE' });
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
    // Closing the form prevents the NEXT request; the one in flight is never
    // relabelled. `unmountFrontComponent` runs the cleanup, which also clears
    // the pending results.
    sendConnectionRef.current?.stop();
    unmountFrontComponent();
    closeSidePanel();
  };

  // Inputs lock only while a run is actually in flight. Once it has finished,
  // the results stay visible but the form can be used again (a NEW run still
  // requires a fresh preview and confirmation).
  const isLocked = sendState.isRunning;

  const containerStyle = { ...styles.container, direction };

  // The four severity states must LOOK different.
  const variantBadgeStyle = (variant: BulkRecipientVariant) => {
    switch (variant) {
      case 'success':
        return { ...styles.recipientBadge, ...styles.badgeSuccess };
      case 'error':
        return { ...styles.recipientBadge, ...styles.badgeError };
      case 'warning':
        return { ...styles.recipientBadge, ...styles.badgeWarning };
      case 'neutral':
        return { ...styles.recipientBadge, ...styles.badgeNeutral };
    }
  };

  const recipientDisplays = buildBulkRecipientDisplay({
    results: sendState.results,
    currentPersonId: sendState.currentPersonId,
  });

  const excludedDisplays = buildBulkExcludedDisplay(
    confirmationPlan?.excluded ?? [],
  );

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
          {sendState.isRunning
            ? t('Sending. Inputs are locked until the group finishes.')
            : sendState.summary !== null
              ? t('The group has finished. Review the results below.')
              : t('Preview the group, then confirm to send to each person individually.')}
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
                      disabled={isLocked}
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
                      disabled={isLocked}
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
          disabled={templates.length === 0 || isLocked}
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
          disabled={isLocked}
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
                  (entry) =>
                    `${displayNameByPersonId.get(entry.personId) ?? entry.personId} (${t(
                      entry.reason === 'NOT_OWNED_BY_PERSON'
                        ? 'not a number of this person'
                        : entry.reason === 'EMPTY_SELECTION'
                          ? 'no number selected'
                          : 'invalid value',
                    )})`,
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

      {(sendState.isRunning || sendState.summary !== null) && (
        <div style={styles.field}>
          <span style={styles.label}>{t('Results')}</span>

          {sendState.summary !== null &&
            buildBulkSummaryPresentation(sendState.summary).stopNotice !==
              null && (
              <p style={styles.warning}>
                <strong>
                  {t(
                    buildBulkSummaryPresentation(sendState.summary).stopNotice
                      ?.title ?? '',
                  )}
                </strong>{' '}
                {t(
                  buildBulkSummaryPresentation(sendState.summary).stopNotice
                    ?.message ?? '',
                )}
              </p>
            )}

          {sendState.summary !== null && (
            <p style={styles.muted}>
              {t('Accepted')}: {sendState.summary.acceptedCount} ·{' '}
              {t('Failed')}: {sendState.summary.definiteFailureCount} ·{' '}
              {t('Unknown')}: {sendState.summary.unknownCount} ·{' '}
              {t('Not started')}: {sendState.summary.notStartedCount}
            </p>
          )}

          <ul style={styles.recipientList}>
            {recipientDisplays.map((result) => (
              <li key={result.personId} style={styles.recipientRow}>
                <div style={styles.recipientHeader}>
                  <span style={styles.recipientName}>{result.displayName}</span>
                  <span style={variantBadgeStyle(result.variant)}>
                    {t(result.label)}
                  </span>
                </div>
                <span style={{ ...styles.muted, ...phoneValueStyle }}>
                  {result.recipient}
                </span>
                {result.detail !== null &&
                  // The provider's own reason is shown VERBATIM; only app copy
                  // is translated.
                  (result.isProviderText ? (
                    <p style={styles.muted}>{result.detail}</p>
                  ) : (
                    <p style={styles.muted}>{t(result.detail)}</p>
                  ))}
              </li>
            ))}
          </ul>

          {sendState.summary !== null && (
            <div style={styles.actions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={handleDismissResults}
              >
                {t('Dismiss results')}
              </button>
            </div>
          )}
        </div>
      )}

      <div style={styles.actions}>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={handleClose}
        >
          {t('Close')}
        </button>

        {sendState.isRunning && (
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={handleStop}
          >
            {t('Stop after current')}
          </button>
        )}

        {!isLocked && sendState.summary === null && (
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
        )}

        {!isLocked && sendState.summary === null && (
          <button
            type="button"
            style={{
              ...styles.primaryButton,
              ...(canOpenConfirmation ? {} : styles.primaryButtonDisabled),
            }}
            onClick={handleOpenConfirmation}
            disabled={!canOpenConfirmation}
          >
            {t('Review and send')}
          </button>
        )}
      </div>

      {isConfirming && confirmationPlan !== null && (
        <div style={styles.field}>
          <span style={styles.label}>{t('Confirm sending')}</span>

          <p style={styles.muted}>
            {t('Recipients to send')}: {confirmationPlan.sendable.length} /{' '}
            {confirmationPlan.totalRecipients}
          </p>

          {excludedDisplays.length > 0 && (
            <div style={styles.warning}>
              <p style={styles.muted}>
                {t('Recipients set aside')}: {excludedDisplays.length}
              </p>
              <ul style={styles.recipientList}>
                {excludedDisplays.map((entry) => (
                  <li key={entry.personId} style={styles.recipientRow}>
                    <span style={styles.recipientName}>
                      {entry.displayName}
                    </span>
                    <span style={styles.muted}>{t(entry.reasonKey)}</span>
                    {entry.tokens.length > 0 && (
                      // Unresolved tokens are DATA, rendered separately — never
                      // concatenated into the translated reason.
                      <span style={{ ...styles.muted, ...phoneValueStyle }}>
                        {entry.tokens.join(', ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasSharedNumber && (
            <div style={styles.warning}>
              <p style={styles.muted}>
                {t('Some people share the same number:')}{' '}
                {confirmationPlan.sharedNumbers.join(', ')}
              </p>
              <label style={styles.field}>
                <input
                  type="checkbox"
                  checked={hasAcknowledgedSharedNumber}
                  onChange={(event) =>
                    setHasAcknowledgedSharedNumber(event.target.checked)
                  }
                />
                <span style={styles.muted}>
                  {t('I understand these people share a number and want to continue.')}
                </span>
              </label>
            </div>
          )}

          <ul style={styles.recipientList}>
            {confirmationPlan.sendable.map((entry) => (
              <li key={entry.personId} style={styles.recipientRow}>
                <div style={styles.recipientHeader}>
                  <span style={styles.recipientName}>{entry.displayName}</span>
                  <span style={{ ...styles.muted, ...phoneValueStyle }}>
                    {entry.recipient}
                  </span>
                </div>
                <p style={styles.preview}>{entry.body}</p>
              </li>
            ))}
          </ul>

          <div style={styles.actions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={handleCancelConfirmation}
            >
              {t('Cancel')}
            </button>
            <button
              type="button"
              style={{
                ...styles.primaryButton,
                ...(isFinalSendEnabled ? {} : styles.primaryButtonDisabled),
              }}
              onClick={handleSend}
              disabled={!isFinalSendEnabled}
            >
              {t('Send to each person')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
