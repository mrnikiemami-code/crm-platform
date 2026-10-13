import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useLocale, useTranslate } from 'twenty-sdk/front-component';

import {
  callAppRoute,
  composerStyles as styles,
  getTextDirection,
} from 'src/components/composer-shared';
import { SMS_TEMPLATE_STUDIO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { templateStudioStyles as studioStyles } from 'src/components/template-studio-styles';
import { TEMPLATE_TARGET_OBJECT } from 'src/studio/template-studio-contract';
import {
  resolveStudioLoadState,
  resolveStudioMutationResult,
  resolveStudioPeople,
  resolveStudioPreviewState,
  type StudioLoadState,
  type StudioPreviewState,
} from 'src/studio/template-studio-client';
import {
  doesFieldActivationInsert,
  EMPTY_STUDIO_DRAFT,
  filterStudioFields,
  filterStudioPeople,
  findAuthorizedFieldByToken,
  groupStudioFields,
  insertTokenAtSelection,
  isFieldActivationKey,
  isStudioDraftDirty,
  readDroppedToken,
  readTextareaSelection,
  resolveInsertSelection,
  resolvePreviewBlockReason,
  STUDIO_FIELD_ACTIVATION,
  STUDIO_FIELD_DRAG_MIME,
  toStudioDraft,
  validateStudioDraft,
  type StudioDraft,
  type StudioField,
  type StudioFieldActivation,
  type StudioPerson,
  type StudioSelection,
  type StudioTemplate,
} from 'src/studio/template-studio-logic';

// The SMS Template Studio.
//
// Storage: the existing NATIVE `messageTemplate` object, through the app's own
// workspace-scoped route. Nothing is kept locally; the list is re-read from the
// server after every successful write, so the UI can never show a template the
// workspace does not actually have.
//
// The body is the canonical technical text. Inserting a field writes its
// `@token` at the caret — the Persian label is presentation only and is never
// stored as a substitution identifier.
type PendingIntent =
  | { kind: 'select'; template: StudioTemplate }
  | { kind: 'new' }
  | { kind: 'close' };

// Exported so the real production component can be rendered directly by the
// wiring test; the SDK entry point below is the default export.
export const TemplateStudio = () => {
  const { t } = useTranslate();
  const locale = useLocale();
  const direction = getTextDirection(locale);

  const [state, setState] = useState<StudioLoadState>({ kind: 'LOADING' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const [baseline, setBaseline] = useState<StudioDraft | null>(null);
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudioTemplate | null>(null);
  const [fieldQuery, setFieldQuery] = useState('');
  const [selectedFieldToken, setSelectedFieldToken] = useState<string | null>(
    null,
  );
  const [isBodyDragOver, setIsBodyDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // W18-B preview state.
  const [people, setPeople] = useState<StudioPerson[]>([]);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [samplePersonId, setSamplePersonId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<StudioPreviewState>({
    kind: 'IDLE',
  });

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  // The body's last valid selection, captured when focus leaves for the field
  // palette, so an insertion still lands where the user left the caret.
  const rememberedSelectionRef = useRef<StudioSelection | null>(null);
  // Monotonic request id: a late preview response can never overwrite a newer
  // one, and unmount silences every pending publication.
  const previewRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const load = async () => {
    setState({ kind: 'LOADING' });

    try {
      const response = await callAppRoute(
        '/communication/template-studio',
        'POST',
        { action: 'list' },
      );

      setState(resolveStudioLoadState(response));
    } catch {
      setState({ kind: 'ERROR', code: 'UNEXPECTED' });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Unmounting invalidates every in-flight preview so a late response can never
  // publish state into an unmounted component.
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      previewRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPeople = async () => {
      try {
        const response = await callAppRoute(
          '/communication/template-studio',
          'POST',
          { action: 'search-people' },
        );

        if (cancelled) {
          return;
        }

        const result = resolveStudioPeople(response);

        if (result.ok) {
          setPeople(result.people);
        }
      } catch {
        // The picker simply stays empty; the preview button stays disabled.
      }
    };

    void loadPeople();

    return () => {
      cancelled = true;
    };
  }, []);

  const templates = state.kind === 'READY' ? state.templates : [];
  const fields = state.kind === 'READY' ? state.fields : [];
  const catalogUnavailable =
    state.kind === 'READY' && state.catalogStatus === 'UNAVAILABLE';

  const isDirty = draft !== null && isStudioDraftDirty(draft, baseline);

  // A stable key for the body so the invalidation effect depends on its VALUE,
  // not on the draft object's identity (which changes on every keystroke state
  // update for unrelated fields).
  const draftBodyKey = draft?.body ?? '';

  const groupedFields = useMemo(
    () => groupStudioFields(filterStudioFields(fields, fieldQuery)),
    [fields, fieldQuery],
  );

  const visiblePeople = useMemo(
    () => filterStudioPeople(people, peopleQuery),
    [people, peopleQuery],
  );

  // A body or recipient change makes any earlier preview stale IMMEDIATELY, and
  // bumping the request id silences the in-flight one so a late response cannot
  // republish it.
  useEffect(() => {
    previewRequestIdRef.current += 1;
    setPreviewState({ kind: 'IDLE' });
  }, [draftBodyKey, samplePersonId]);

  const isCatalogAvailable =
    state.kind === 'READY' && state.catalogStatus === 'READY';

  const previewBlockReason = resolvePreviewBlockReason({
    personId: samplePersonId,
    body: draft?.body ?? '',
    isCatalogAvailable,
  });

  const canPreview =
    draft !== null && previewBlockReason === null && !isSaving;

  const handlePreview = async () => {
    if (draft === null || samplePersonId === null || !canPreview) {
      return;
    }

    previewRequestIdRef.current += 1;
    const requestId = previewRequestIdRef.current;

    setPreviewState({ kind: 'LOADING' });

    try {
      const response = await callAppRoute(
        '/communication/template-studio',
        'POST',
        {
          action: 'preview',
          personId: samplePersonId,
          body: draft.body,
        },
      );

      // A newer request (or unmount) has taken over: this response is dropped.
      if (!isMountedRef.current || requestId !== previewRequestIdRef.current) {
        return;
      }

      const payload = response.data as { catalogStatus?: unknown } | null;

      if (
        payload !== null &&
        payload.catalogStatus === 'UNAVAILABLE'
      ) {
        setPreviewState({ kind: 'IDLE' });
        setError(t('Authorized variables are unavailable right now.'));
        return;
      }

      setPreviewState(
        resolveStudioPreviewState({ response, personId: samplePersonId }),
      );
    } catch {
      if (isMountedRef.current && requestId === previewRequestIdRef.current) {
        setPreviewState({ kind: 'ERROR' });
      }
    }
  };

  const activeTemplateId = draft?.id ?? selectedId;

  const openEditor = (template: StudioTemplate | null) => {
    const next =
      template === null ? { ...EMPTY_STUDIO_DRAFT } : toStudioDraft(template);

    setDraft(next);
    setBaseline(template === null ? null : toStudioDraft(template));
    setSelectedId(template?.id ?? null);
    setNotice(null);
    setError(null);
    setPendingIntent(null);
  };

  // Every transition that would discard a dirty draft is routed through the
  // pending-intent guard, so an accidental click can never lose typed text.
  const guard = (intent: PendingIntent) => {
    if (isDirty) {
      setPendingIntent(intent);
      return;
    }

    apply(intent);
  };

  const apply = (intent: PendingIntent) => {
    setPendingIntent(null);

    if (intent.kind === 'select') {
      openEditor(intent.template);
      return;
    }

    if (intent.kind === 'new') {
      openEditor(null);
      return;
    }

    setDraft(null);
    setBaseline(null);
    setSelectedId(null);
  };

  const handleSelect = (template: StudioTemplate) => {
    if (template.id === activeTemplateId && draft !== null) {
      return;
    }

    guard({ kind: 'select', template });
  };

  const handleInsertField = (token: string) => {
    if (draft === null) {
      return;
    }

    // Only a token that is in the CURRENT authorized catalog may be inserted,
    // whatever the caller passed in.
    const field = findAuthorizedFieldByToken(fields, token);

    if (field === null) {
      return;
    }

    const textarea = bodyRef.current;
    const selection = resolveInsertSelection({
      bodyLength: draft.body.length,
      liveSelection: readTextareaSelection(textarea),
      rememberedSelection: rememberedSelectionRef.current,
      isTextareaFocused:
        typeof document !== 'undefined' &&
        document.activeElement === textarea &&
        textarea !== null,
    });

    const next = insertTokenAtSelection({
      body: draft.body,
      selectionStart: selection.start,
      selectionEnd: selection.end,
      token: field.token,
    });

    setDraft({ ...draft, body: next.body });
    rememberedSelectionRef.current = { start: next.caret, end: next.caret };

    // Restore the caret immediately after the inserted token, so consecutive
    // inserts land in the order the user activated them.
    if (textarea !== null) {
      textarea.focus();
      textarea.setSelectionRange(next.caret, next.caret);
    }
  };

  // A single click only SELECTS a field. Nothing is inserted here, so the two
  // clicks of a double-click can never produce extra insertions.
  const handleFieldActivation = (
    field: StudioField,
    activation: StudioFieldActivation,
  ) => {
    setSelectedFieldToken(field.token);

    if (doesFieldActivationInsert(activation)) {
      handleInsertField(field.token);
    }
  };

  const handleRememberSelection = () => {
    const selection = readTextareaSelection(bodyRef.current);

    if (selection !== null) {
      rememberedSelectionRef.current = selection;
    }
  };

  const handleBodyDragOver = (event: DragEvent<HTMLTextAreaElement>) => {
    // Claim the drop only while a field drag is in flight, so an unrelated file
    // or text drag is left to the browser and changes nothing.
    event.preventDefault();
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes(
      STUDIO_FIELD_DRAG_MIME,
    )
      ? 'copy'
      : 'none';
    setIsBodyDragOver(true);
  };

  const handleBodyDragLeave = () => {
    setIsBodyDragOver(false);
  };

  // The drop is handled ONCE, here. `dragend` performs no insertion, so a native
  // drop plus a custom handler cannot double-insert.
  const handleBodyDrop = (event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setIsBodyDragOver(false);

    const textarea = bodyRef.current;

    if (textarea !== null) {
      // Remember where the drop landed before the caret is restored.
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (start !== null && end !== null) {
        rememberedSelectionRef.current = { start, end };
      }
    }

    const token = readDroppedToken(event.dataTransfer);

    // The payload is only a LOOKUP KEY: an unauthorized, stale or hand-crafted
    // token resolves to null and the drop changes nothing.
    handleInsertField(token);
  };

  const handleFieldDragStart = (
    event: DragEvent<HTMLElement>,
    field: StudioField,
  ) => {
    if (findAuthorizedFieldByToken(fields, field.token) === null) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData(STUDIO_FIELD_DRAG_MIME, field.token);
    event.dataTransfer.setData('text/plain', field.token);
    event.dataTransfer.effectAllowed = 'copy';
    setSelectedFieldToken(field.token);
    handleRememberSelection();
  };

  const handleSave = async () => {
    if (draft === null || isSaving) {
      return;
    }

    const validationErrors = validateStudioDraft(draft);

    if (validationErrors.length > 0) {
      setError(
        validationErrors.includes('TITLE_REQUIRED')
          ? t('A title is required.')
          : t('The message body is required.'),
      );
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await callAppRoute(
        '/communication/template-studio',
        'POST',
        {
          action: draft.id === null ? 'create' : 'update',
          templateId: draft.id,
          title: draft.title,
          body: draft.body,
          targetObject: draft.targetObject,
        },
      );

      const result = resolveStudioMutationResult(response);

      if (!result.ok) {
        setError(t('The template could not be saved.'));
        return;
      }

      setNotice(t('The template was saved.'));
      await load();
      setDraft(null);
      setBaseline(null);
      setSelectedId(result.template?.id ?? null);
    } catch {
      setError(t('The template could not be saved.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget === null) {
      return;
    }

    const target = deleteTarget;

    setDeleteTarget(null);
    setError(null);

    try {
      const response = await callAppRoute(
        '/communication/template-studio',
        'POST',
        { action: 'delete', templateId: target.id },
      );

      const result = resolveStudioMutationResult(response);

      if (!result.ok) {
        setError(t('The template could not be deleted.'));
        return;
      }

      setNotice(t('The template was deleted.'));
      setDraft(null);
      setBaseline(null);
      setSelectedId(null);
      await load();
    } catch {
      setError(t('The template could not be deleted.'));
    }
  };

  const containerStyle = { ...styles.container, direction };

  return (
    <div style={containerStyle}>
      <div style={styles.field}>
        <p style={styles.heading}>{t('SMS Template Studio')}</p>
        <p style={styles.hint}>
          {t(
            'Write the message with the usable variables, then save the template.',
          )}
        </p>
      </div>

      {state.kind === 'LOADING' && (
        <p style={styles.muted}>{t('Loading templates…')}</p>
      )}

      {state.kind === 'ERROR' && (
        <p style={styles.error}>{t('Templates could not be loaded.')}</p>
      )}

      {notice !== null && <p style={studioStyles.notice}>{notice}</p>}
      {error !== null && <p style={styles.error}>{error}</p>}

      {state.kind === 'READY' && (
        <div style={studioStyles.columns}>
          <div style={studioStyles.listColumn}>
            <div style={studioStyles.listHeader}>
              <span style={styles.label}>{t('Templates')}</span>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => guard({ kind: 'new' })}
              >
                {t('New template')}
              </button>
            </div>

            {templates.length === 0 ? (
              <p style={styles.muted}>{t('No templates yet.')}</p>
            ) : (
              <ul style={styles.recipientList}>
                {templates.map((template) => (
                  <li key={template.id} style={styles.recipientRow}>
                    <div style={styles.recipientHeader}>
                      <button
                        type="button"
                        style={
                          template.id === activeTemplateId
                            ? studioStyles.selectedItem
                            : studioStyles.item
                        }
                        onClick={() => handleSelect(template)}
                      >
                        {template.title.length > 0
                          ? template.title
                          : template.id}
                      </button>
                    </div>
                    <div style={studioStyles.rowActions}>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => handleSelect(template)}
                      >
                        {t('Edit')}
                      </button>
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => setDeleteTarget(template)}
                      >
                        {t('Delete')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={studioStyles.editorColumn}>
            {draft === null ? (
              <p style={styles.muted}>
                {t('Select a template to edit, or create a new one.')}
              </p>
            ) : (
              <>
                <label style={styles.field}>
                  <span style={styles.label}>{t('Title')}</span>
                  <input
                    type="text"
                    aria-label={t('Title')}
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                    style={styles.control}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>{t('Target entity')}</span>
                  <select
                    aria-label={t('Target entity')}
                    value={draft.targetObject}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        targetObject:
                          event.target.value === TEMPLATE_TARGET_OBJECT.PERSON
                            ? TEMPLATE_TARGET_OBJECT.PERSON
                            : draft.targetObject,
                      })
                    }
                    style={styles.control}
                  >
                    <option value={TEMPLATE_TARGET_OBJECT.PERSON}>
                      {t('People')}
                    </option>
                  </select>
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>{t('Message body')}</span>
                  <textarea
                    ref={bodyRef}
                    aria-label={t('Message body')}
                    value={draft.body}
                    onChange={(event) =>
                      setDraft({ ...draft, body: event.target.value })
                    }
                    onBlur={handleRememberSelection}
                    onSelect={handleRememberSelection}
                    onKeyUp={handleRememberSelection}
                    onClick={handleRememberSelection}
                    onDragOver={handleBodyDragOver}
                    onDragLeave={handleBodyDragLeave}
                    onDrop={handleBodyDrop}
                    rows={8}
                    dir={direction}
                    style={{
                      ...styles.control,
                      ...studioStyles.body,
                      ...(isBodyDragOver ? studioStyles.bodyDropActive : {}),
                    }}
                  />
                  <p style={styles.muted}>
                    {t(
                      'Double-click a field, or drag it here, to insert it at the cursor.',
                    )}
                  </p>
                </label>

                <div style={styles.actions}>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => guard({ kind: 'close' })}
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                  >
                    {isSaving ? t('Saving…') : t('Save')}
                  </button>
                </div>

                <div style={styles.field}>
                  <span style={styles.label}>{t('Usable variables')}</span>
                  {catalogUnavailable ? (
                    <p style={styles.warning}>
                      {t('Authorized variables are unavailable right now.')}
                    </p>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={fieldQuery}
                        onChange={(event) => setFieldQuery(event.target.value)}
                        placeholder={t('Search fields')}
                        style={styles.control}
                      />
                      <p style={styles.muted}>
                        {t(
                          'Double-click a field, or drag it here, to insert it at the cursor.',
                        )}
                      </p>

                      {groupedFields.length === 0 ? (
                        <p style={styles.muted}>{t('No matching fields.')}</p>
                      ) : (
                        groupedFields.map((grouping) => (
                          <div key={grouping.group} style={styles.field}>
                            <span style={styles.label}>
                              {t(grouping.label)}
                            </span>
                            <div style={studioStyles.fieldGrid}>
                              {grouping.fields.map((field) => (
                                <div
                                  key={field.token}
                                  role="button"
                                  tabIndex={0}
                                  draggable
                                  aria-pressed={
                                    selectedFieldToken === field.token
                                  }
                                  data-studio-field-token={field.token}
                                  style={
                                    selectedFieldToken === field.token
                                      ? {
                                          ...studioStyles.fieldButton,
                                          ...studioStyles.fieldButtonSelected,
                                        }
                                      : studioStyles.fieldButton
                                  }
                                  onClick={() =>
                                    handleFieldActivation(
                                      field,
                                      STUDIO_FIELD_ACTIVATION.CLICK,
                                    )
                                  }
                                  // Insertion happens EXACTLY ONCE here. The two
                                  // preceding clicks only select.
                                  onDoubleClick={() =>
                                    handleFieldActivation(
                                      field,
                                      STUDIO_FIELD_ACTIVATION.DOUBLE_CLICK,
                                    )
                                  }
                                  onKeyDown={(event) => {
                                    if (isFieldActivationKey(event.key)) {
                                      // Stop the browser's own activation from
                                      // also firing, so the keyboard path cannot
                                      // insert twice.
                                      event.preventDefault();
                                      handleFieldActivation(
                                        field,
                                        STUDIO_FIELD_ACTIVATION.KEYBOARD,
                                      );
                                    }
                                  }}
                                  onDragStart={(event) =>
                                    handleFieldDragStart(event, field)
                                  }
                                >
                                  <span style={studioStyles.fieldLabel}>
                                    {t(field.label)}
                                  </span>
                                  <span
                                    style={{
                                      ...styles.muted,
                                      direction: 'ltr',
                                    }}
                                  >
                                    {field.token}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>

                <div style={styles.field}>
                  <span style={styles.label}>{t('Sample preview')}</span>

                  {catalogUnavailable && (
                    <p style={styles.warning}>
                      {t('Authorized variables are unavailable right now.')}
                    </p>
                  )}

                  {!catalogUnavailable && (
                    <>
                      <input
                        type="text"
                        value={peopleQuery}
                        onChange={(event) => setPeopleQuery(event.target.value)}
                        placeholder={t('Search people')}
                        style={styles.control}
                      />

                      <select
                        aria-label={t('Sample person')}
                        value={samplePersonId ?? ''}
                        onChange={(event) =>
                          setSamplePersonId(
                            event.target.value.length > 0
                              ? event.target.value
                              : null,
                          )
                        }
                        style={styles.control}
                      >
                        <option value="">{t('No sample person')}</option>
                        {visiblePeople.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.displayName.length > 0
                              ? person.displayName
                              : person.id}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {/* The button is ALWAYS rendered and disabled until every gate
                      passes, so its state and the request share one decision. */}
                  <div style={styles.actions}>
                    <button
                      type="button"
                      style={{
                        ...styles.secondaryButton,
                        ...(canPreview ? {} : styles.primaryButtonDisabled),
                      }}
                      onClick={() => void handlePreview()}
                      disabled={!canPreview}
                    >
                      {previewState.kind === 'LOADING'
                        ? t('Previewing…')
                        : t('Preview')}
                    </button>
                  </div>

                  {!catalogUnavailable && previewBlockReason === 'NO_PERSON' && (
                    <p style={styles.muted}>
                      {t('Select a sample person to preview.')}
                    </p>
                  )}

                  {!catalogUnavailable && previewBlockReason === 'EMPTY_BODY' && (
                    <p style={styles.muted}>
                      {t('Write the message body to preview it.')}
                    </p>
                  )}

                      {previewState.kind === 'READY' && (
                        <>
                          <p style={styles.preview}>
                            {previewState.resolvedText}
                          </p>
                          {previewState.issues.length > 0 && (
                            <p style={styles.warning}>
                              {t('Unresolved variables:')}{' '}
                              <span style={{ direction: 'ltr' }}>
                                {previewState.issues
                                  .map(
                                    (issue) =>
                                      `${issue.token} (${
                                        issue.kind === 'EMPTY_FIELD'
                                          ? t('Empty field')
                                          : t('Unknown variable')
                                      })`,
                                  )
                                  .join(', ')}
                              </span>
                            </p>
                          )}
                        </>
                      )}

                      {previewState.kind === 'PERSON_NOT_ACCESSIBLE' && (
                        <p style={styles.warning}>
                          {t('This person could not be read.')}
                        </p>
                      )}

                      {previewState.kind === 'NOT_SENDABLE' && (
                        <p style={styles.warning}>
                          {t(
                            'No usable number was resolved for this person.',
                          )}
                        </p>
                      )}

                      {previewState.kind === 'EMPTY_BODY' && (
                        <p style={styles.warning}>
                          {t('The message is empty.')}
                        </p>
                      )}

                      {previewState.kind === 'ERROR' && (
                        <p style={styles.error}>
                          {t('The preview could not be built.')}
                        </p>
                      )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {pendingIntent !== null && (
        <div style={styles.warning}>
          <p style={styles.muted}>
            {t('This template has unsaved changes.')}
          </p>
          <div style={styles.actions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setPendingIntent(null)}
            >
              {t('Keep editing')}
            </button>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => apply(pendingIntent)}
            >
              {t('Discard changes')}
            </button>
          </div>
        </div>
      )}

      {deleteTarget !== null && (
        <div style={styles.error}>
          <p style={styles.muted}>
            {t('Delete this template permanently?')}{' '}
            {deleteTarget.title.length > 0 ? deleteTarget.title : deleteTarget.id}
          </p>
          <div style={styles.actions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setDeleteTarget(null)}
            >
              {t('Cancel')}
            </button>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => void handleDelete()}
            >
              {t('Delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    SMS_TEMPLATE_STUDIO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'sms-template-studio',
  description:
    'Manages this workspace SMS templates: list, create, edit, delete and insert authorized fields.',
  component: TemplateStudio,
});
