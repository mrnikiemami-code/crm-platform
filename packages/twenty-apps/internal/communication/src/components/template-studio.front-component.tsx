import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useLocale, useTranslate } from 'twenty-sdk/front-component';

import {
  callAppRoute,
  composerStyles as styles,
  getTextDirection,
} from 'src/components/composer-shared';
import { StudioCombobox } from 'src/components/studio-combobox';
import {
  collectFocusCycle,
  focusElementSafely,
  isInsideContainer,
  readActiveElement,
  setSelectionRangeSafely,
} from 'src/components/studio-dom';
import { templateStudioStyles as studioStyles } from 'src/components/template-studio-styles';
import { SMS_TEMPLATE_STUDIO_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
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
  filterStudioTemplates,
  findAuthorizedFieldByToken,
  formatStudioUpdatedAt,
  getStudioTargetAdapter,
  groupStudioFields,
  hasFieldDragPayload,
  insertTokenAtSelection,
  isFieldActivationKey,
  isStudioDraftDirty,
  mergeStudioPeople,
  readDroppedTokenSafely,
  readTextareaSelection,
  resolveDroppedFieldToken,
  resolveInsertSelection,
  resolvePreviewBlockReason,
  STUDIO_FIELD_ACTIVATION,
  STUDIO_FIELD_DRAG_MIME,
  targetValueLabel,
  toStudioDraft,
  toTargetComboboxOptions,
  validateStudioDraft,
  type StudioDraft,
  type StudioField,
  type StudioFieldActivation,
  type StudioPerson,
  type StudioSelection,
  type StudioTemplate,
} from 'src/studio/template-studio-logic';

// A VISIBLE build marker, rendered in the studio header next to the page title.
//
// WHY it exists: a front component is served as a bundle the browser may cache,
// so "did the new deployment actually reach this browser?" is otherwise
// unanswerable — and a stale bundle looks exactly like a broken one. The marker
// makes the loaded revision self-evident to both the user and the agent.
//
// It is intentionally NOT hand-maintained: `studio-build-marker.test.ts` fails
// if it drifts from `package.json`, so it can never lie about the revision.
export const STUDIO_BUILD_MARKER = '0.1.46';

// The SMS Template Studio.
//
// A table page (title search, row actions, Persian delete confirmation) plus a
// focused create/edit modal. Storage is the existing NATIVE `messageTemplate`
// object, reached through the app's own workspace-scoped route; the page re-reads
// the list after every successful write, so it can never show a template the
// workspace does not actually have.
//
// The body holds the CANONICAL token text. A field's Persian label is
// presentation only and is never persisted as a substitution identifier.
type ModalState = {
  draft: StudioDraft;
  /** The saved values the draft was loaded from, for dirty-tracking. */
  baseline: StudioDraft | null;
} | null;

export const TemplateStudio = () => {
  const { t } = useTranslate();
  const locale = useLocale();
  const direction = getTextDirection(locale);

  const [state, setState] = useState<StudioLoadState>({ kind: 'LOADING' });
  const [tableQuery, setTableQuery] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudioTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldQuery, setFieldQuery] = useState('');
  const [selectedFieldToken, setSelectedFieldToken] = useState<string | null>(
    null,
  );
  const [isBodyDragOver, setIsBodyDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  // W19-A preview state.
  const [people, setPeople] = useState<StudioPerson[]>([]);
  // Paged sample-Person loading. `peopleQuery` is the SERVER search term (name
  // or phone); `peopleEndCursor` walks the connection so ~100k People are loaded
  // 100 at a time instead of all at once.
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleEndCursor, setPeopleEndCursor] = useState<string | null>(null);
  const [hasMorePeople, setHasMorePeople] = useState(false);
  const [isLoadingMorePeople, setIsLoadingMorePeople] = useState(false);
  const [peopleErrorCode, setPeopleErrorCode] = useState<
    'LOAD_FAILED' | null
  >(null);
  const [isPeopleLoading, setIsPeopleLoading] = useState(true);
  const peopleRequestIdRef = useRef(0);
  const [samplePersonId, setSamplePersonId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<StudioPreviewState>({
    kind: 'IDLE',
  });

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  // The body's last valid selection, captured when the caret moves.
  const rememberedSelectionRef = useRef<StudioSelection | null>(null);
  // The token currently being dragged. The drop falls back to this when the
  // payload cannot be read, so a drag never throws on a missing `dataTransfer`.
  const draggedTokenRef = useRef<string | null>(null);
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

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      previewRequestIdRef.current += 1;
    };
  }, []);

  // --- paged, searchable sample People -------------------------------------

  const loadPeoplePage = useCallback(
    async ({
      query,
      after,
    }: {
      query: string;
      after: string | null;
    }) => {
      peopleRequestIdRef.current += 1;
      const requestId = peopleRequestIdRef.current;

      if (after === null) {
        setIsPeopleLoading(true);
      } else {
        setIsLoadingMorePeople(true);
      }

      try {
        const response = await callAppRoute(
          '/communication/template-studio',
          'POST',
          { action: 'search-people', search: query, after },
        );

        // A newer request (or an unmount) owns the state now.
        if (!isMountedRef.current || requestId !== peopleRequestIdRef.current) {
          return;
        }

        const result = resolveStudioPeople(response);

        if (!result.ok) {
          setPeopleErrorCode('LOAD_FAILED');
          return;
        }

        setPeopleErrorCode(null);
        // Appending is what makes the list grow as the user scrolls, and
        // de-duplicating by id keeps keys stable across page boundaries.
        setPeople((current) =>
          after === null
            ? result.people
            : mergeStudioPeople(current, result.people),
        );
        setPeopleEndCursor(result.endCursor);
        setHasMorePeople(result.hasMore);
      } catch {
        if (isMountedRef.current && requestId === peopleRequestIdRef.current) {
          setPeopleErrorCode('LOAD_FAILED');
        }
      } finally {
        if (isMountedRef.current && requestId === peopleRequestIdRef.current) {
          setIsPeopleLoading(false);
          setIsLoadingMorePeople(false);
        }
       }
    },
    // No dependencies: `t` is deliberately not used inside, so this callback is
    // stable and the search effect below cannot re-trigger itself in a loop.
    [],
  );

  // Reload the FIRST page whenever the search term changes. The debounce keeps a
  // fast typist from firing one request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      void loadPeoplePage({ query: peopleQuery, after: null });
    }, 300);

    return () => clearTimeout(handle);
  }, [peopleQuery, loadPeoplePage]);

  /** Appends the next page when the list is scrolled near its end. */
  const handleLoadMorePeople = useCallback(() => {
    if (
      !hasMorePeople ||
      isLoadingMorePeople ||
      isPeopleLoading ||
      peopleEndCursor === null
    ) {
      return;
    }

    void loadPeoplePage({ query: peopleQuery, after: peopleEndCursor });
  }, [
    hasMorePeople,
    isLoadingMorePeople,
    isPeopleLoading,
    peopleEndCursor,
    peopleQuery,
    loadPeoplePage,
  ]);

  const templates = state.kind === 'READY' ? state.templates : [];
  const fields = state.kind === 'READY' ? state.fields : [];
  const catalogUnavailable =
    state.kind === 'READY' && state.catalogStatus === 'UNAVAILABLE';
  const isCatalogAvailable =
    state.kind === 'READY' && state.catalogStatus === 'READY';

  const visibleTemplates = useMemo(
    () => filterStudioTemplates(templates, tableQuery),
    [templates, tableQuery],
  );

  const draft = modal?.draft ?? null;
  const isDirty =
    modal !== null && isStudioDraftDirty(modal.draft, modal.baseline);

  /** Replaces the draft while preserving the loaded baseline. */
  const updateDraft = (next: StudioDraft) => {
    setModal((current) =>
      current === null ? null : { draft: next, baseline: current.baseline },
    );
  };

  const draftBodyKey = draft?.body ?? '';

  // A body or recipient change makes any earlier preview stale immediately, and
  // bumping the request id silences the in-flight one.
  useEffect(() => {
    previewRequestIdRef.current += 1;
    setPreviewState({ kind: 'IDLE' });
  }, [draftBodyKey, samplePersonId]);

  const groupedFields = useMemo(
    () => groupStudioFields(filterStudioFields(fields, fieldQuery)),
    [fields, fieldQuery],
  );

  const personOptions = useMemo(
    () =>
      people.map((person) => {
        const name =
          person.displayName.length > 0 ? person.displayName : person.id;
        // The phone is shown next to the name so a phone search is verifiable,
        // and so two people with the same name stay distinguishable.
        const phone = person.phone ?? '';

        return {
          value: person.id,
          label: phone.length > 0 ? `${name} — ${phone}` : name,
        };
      }),
    [people],
  );

  const targetOptions = useMemo(
    () =>
      // The adapter supplies the SOURCE label; translation happens here so the
      // control shows workspace copy, never the adapter's English source string.
      toTargetComboboxOptions(
        getStudioTargetAdapter(TEMPLATE_TARGET_OBJECT.PERSON),
      ).map((option) => ({ ...option, label: t(option.label) })),
    [t],
  );

  const previewBlockReason = resolvePreviewBlockReason({
    personId: samplePersonId,
    body: draft?.body ?? '',
    isCatalogAvailable,
  });

  const canPreview = draft !== null && previewBlockReason === null && !isSaving;

  // --- editor lifecycle ------------------------------------------------------

  const openEditor = (template: StudioTemplate | null) => {
    const next =
      template === null ? { ...EMPTY_STUDIO_DRAFT } : toStudioDraft(template);

    setModal({
      draft: next,
      baseline: template === null ? null : toStudioDraft(template),
    });
    setSamplePersonId(null);
    setFieldQuery('');
    setSelectedFieldToken(null);
    setModalError(null);
    setIsConfirmingDiscard(false);
    setNotice(null);
    setError(null);
    draggedTokenRef.current = null;
    setIsBodyDragOver(false);
    rememberedSelectionRef.current = null;
  };

  const closeEditor = () => {
    setModal(null);
    setIsConfirmingDiscard(false);
    setIsSaving(false);
    setModalError(null);
    setSamplePersonId(null);
    // Never leave drag state behind a closed modal.
    draggedTokenRef.current = null;
    setIsBodyDragOver(false);
    rememberedSelectionRef.current = null;
    setPreviewState({ kind: 'IDLE' });
  };

  /** Escape, backdrop and «انصراف» all go through the unsaved-change guard. */
  const requestClose = () => {
    if (isDirty) {
      setIsConfirmingDiscard(true);
      return;
    }

    closeEditor();
  };

  const handleModalKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {    if (event.key === 'Escape') {
      // A combobox that owns the key already stopped propagation, so reaching
      // here means the EDITOR should handle Escape.
      event.stopPropagation();
      requestClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    // Only genuinely focusable values enter the cycle: a renderer proxy without
    // a `focus` method is dropped, and every focus call is guarded, so the trap
    // can never throw the live "focus is not a function" error.
    const focusable = collectFocusCycle(modalRef.current);

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = readActiveElement();

    if (event.shiftKey && active === first) {
      event.preventDefault();
      focusElementSafely(last);
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      focusElementSafely(first);
    }
  };

  /**
   * Escape is also handled at the DOCUMENT level.
   *
   * The dialog's own `onKeyDown` only fires while focus is inside it, so a user
   * who clicked the backdrop, the body or any non-focusable area could not close
   * the editor with Escape. Listening on the document makes Escape work from
   * anywhere — and it is deliberately skipped while a combobox list is open, so
   * Escape closes the LIST first and the editor only on the next press.
   */
  useEffect(() => {
    if (modal === null) {
      return;
    }

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      const active = document.activeElement as
        | (Element & { getAttribute?: (name: string) => string | null })
        | null;

      // A combobox owns Escape while its list is expanded.
      if (
        active !== null &&
        typeof active.getAttribute === 'function' &&
        active.getAttribute('aria-expanded') === 'true'
      ) {
        return;
      }

      event.preventDefault();
      requestClose();
    };

    document.addEventListener('keydown', handleEscape);

    return () => document.removeEventListener('keydown', handleEscape);
  }, [modal, isDirty]);

  // --- field interaction -----------------------------------------------------

  const handleInsertField = (token: string) => {
    if (draft === null) {
      return;
    }

    // Only a token in the CURRENT authorized catalog may be inserted.
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
        typeof document !== 'undefined' && document.activeElement === textarea,
    });

    const next = insertTokenAtSelection({
      body: draft.body,
      selectionStart: selection.start,
      selectionEnd: selection.end,
      token: field.token,
    });

    updateDraft({ ...draft, body: next.body });
    rememberedSelectionRef.current = { start: next.caret, end: next.caret };

    // Restoring focus and the caret is best-effort: the renderer may hand back a
    // value without those methods, and a focus failure must never crash.
    focusElementSafely(textarea);
    setSelectionRangeSafely(textarea, next.caret, next.caret);
  };

  // A single click only SELECTS a field, so the two clicks of a double-click can
  // never produce extra insertions.
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
    const textarea = bodyRef.current;

    // Only remember while the textarea still owns focus: a blur resets
    // `selectionStart` to the end of the value, so reading after a blur would
    // overwrite the real caret with a useless position.
    if (
      textarea === null ||
      (typeof document !== 'undefined' && document.activeElement !== textarea)
    ) {
      return;
    }

    const selection = readTextareaSelection(textarea);

    if (selection !== null) {
      rememberedSelectionRef.current = selection;
    }
  };

  // --- drag and drop --------------------------------------------------------

  const handleBodyDragOver = (event: DragEvent<HTMLTextAreaElement>) => {
    // Preventing the default is what makes a drop possible at all; it is safe
    // even when the event carries no usable payload.
    event.preventDefault();

    const transfer = (event as unknown as { dataTransfer?: unknown })
      .dataTransfer;

    if (transfer !== null && transfer !== undefined) {
      // `dropEffect` is best-effort: the property is read-only in some engines
      // and assigning it must never break the drag.
      try {
        (transfer as { dropEffect?: string }).dropEffect = hasFieldDragPayload(
          transfer,
        )
          ? 'copy'
          : 'none';
      } catch {
        // Ignore: the visual effect is not worth an exception.
      }
    }

    setIsBodyDragOver(true);
  };

  const handleBodyDragLeave = () => {
    setIsBodyDragOver(false);
  };

  // The drop is handled ONCE, here. `dragend` performs no insertion, so a native
  // drop plus this handler cannot double-insert.
  const handleBodyDrop = (event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setIsBodyDragOver(false);

    const transfer = (event as unknown as { dataTransfer?: unknown })
      .dataTransfer;

    // Remember where the drop landed before the caret is restored.
    const textarea = bodyRef.current;
    const selection = readTextareaSelection(textarea);

    if (selection !== null) {
      rememberedSelectionRef.current = selection;
    }

    // The payload is only a LOOKUP KEY; the remembered drag token is the
    // fallback. Anything else (a file, a text selection, a fabricated token)
    // resolves to null and changes nothing.
    const token = resolveDroppedFieldToken({
      typedToken: readDroppedTokenSafely(transfer),
      rememberedToken: draggedTokenRef.current,
      fields,
    });

    draggedTokenRef.current = null;

    if (token === null) {
      return;
    }

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

    const transfer = (event as unknown as { dataTransfer?: unknown })
      .dataTransfer;

    if (transfer !== null && transfer !== undefined) {
      try {
        const typed = transfer as {
          setData: (format: string, value: string) => void;
          effectAllowed?: string;
        };

        typed.setData(STUDIO_FIELD_DRAG_MIME, field.token);
        typed.setData('text/plain', field.token);
        typed.effectAllowed = 'copy';
      } catch {
        // The remembered token still makes the drop work.
      }
    }

    draggedTokenRef.current = field.token;
    setSelectedFieldToken(field.token);
    handleRememberSelection();
  };

  const handleFieldDragEnd = () => {
    draggedTokenRef.current = null;
    setIsBodyDragOver(false);
  };

  // --- persistence ----------------------------------------------------------

  const handleSave = async () => {
    if (draft === null || isSaving) {
      return;
    }

    const validationErrors = validateStudioDraft(draft);

    if (validationErrors.length > 0) {
      setModalError(
        validationErrors.includes('TITLE_REQUIRED')
          ? t('A title is required.')
          : t('The message body is required.'),
      );
      return;
    }

    setIsSaving(true);
    setModalError(null);

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
        setModalError(t('The template could not be saved.'));
        return;
      }

      closeEditor();
      setNotice(t('The template was saved.'));
      await load();
    } catch {
      setModalError(t('The template could not be saved.'));
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
      await load();
    } catch {
      setError(t('The template could not be deleted.'));
    }
  };

  // --- preview --------------------------------------------------------------

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
        { action: 'preview', personId: samplePersonId, body: draft.body },
      );

      if (!isMountedRef.current || requestId !== previewRequestIdRef.current) {
        return;
      }

      const payload = response.data as { catalogStatus?: unknown } | null;

      if (payload !== null && payload.catalogStatus === 'UNAVAILABLE') {
        setPreviewState({ kind: 'IDLE' });
        setModalError(t('Authorized variables are unavailable right now.'));
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

  // --- render ---------------------------------------------------------------

  const containerStyle = { ...styles.container, direction };

  return (
    <div style={containerStyle}>
      <div style={studioStyles.page}>
        <div style={studioStyles.pageHeader}>
          <div style={styles.field}>
            <p style={{ ...styles.heading, fontSize: 16 }}>
              {t('SMS template management')}{' '}
              {/* The loaded revision, visible at a glance. */}
              <span
                style={studioStyles.buildMarker}
                title={t('Loaded studio revision')}
              >
                v{STUDIO_BUILD_MARKER}
              </span>
            </p>
            <p style={styles.hint}>
              {t(
                'Create and manage the reusable SMS templates of this workspace.',
              )}
            </p>
          </div>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => openEditor(null)}
          >
            {t('Create new template')}
          </button>
        </div>

        {notice !== null && <p style={studioStyles.notice}>{notice}</p>}
        {error !== null && <p style={styles.error}>{error}</p>}

        {state.kind === 'LOADING' && (
          <p style={styles.muted}>{t('Loading templates…')}</p>
        )}

        {state.kind === 'ERROR' && (
          <p style={styles.error}>{t('Templates could not be loaded.')}</p>
        )}

        {state.kind === 'READY' && (
          <>
            <div style={studioStyles.toolbar}>
              <input
                type="text"
                aria-label={t('Search by title')}
                placeholder={t('Search by title')}
                value={tableQuery}
                onChange={(event) => setTableQuery(event.target.value)}
                style={{ ...styles.control, ...studioStyles.searchInput }}
              />
              {catalogUnavailable && (
                <p
                  style={styles.warning}
                  data-catalog-stage={state.catalogStage}
                >
                  {t('Authorized variables are unavailable right now.')}
                </p>
              )}
            </div>

            <table style={studioStyles.table}>
              <thead>
                <tr>
                  <th style={studioStyles.tableHeaderCell}>{t('Title')}</th>
                  <th style={studioStyles.tableHeaderCell}>
                    {t('Target entity')}
                  </th>
                  <th style={studioStyles.tableHeaderCell}>
                    {t('Last update')}
                  </th>
                  <th
                    style={{
                      ...studioStyles.tableHeaderCell,
                      textAlign: 'end',
                    }}
                  >
                    {t('Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleTemplates.length === 0 ? (
                  <tr>
                    <td style={studioStyles.tableCell} colSpan={4}>
                      <span style={styles.muted}>
                        {templates.length === 0
                          ? t('No templates yet.')
                          : t('No template matches this title.')}
                      </span>
                    </td>
                  </tr>
                ) : (
                  visibleTemplates.map((template) => (
                    <tr key={template.id}>
                      <td style={studioStyles.tableCell}>
                        {template.title.length > 0
                          ? template.title
                          : template.id}
                      </td>
                      <td style={studioStyles.tableCell}>
                        {t(targetValueLabel(template.targetObject))}
                      </td>
                      <td
                        style={{
                          ...studioStyles.tableCell,
                          direction: 'ltr',
                          textAlign: 'start',
                        }}
                      >
                        {formatStudioUpdatedAt(template.updatedAt).length > 0
                          ? formatStudioUpdatedAt(template.updatedAt)
                          : t('Unknown')}
                      </td>
                      <td style={studioStyles.tableActionsCell}>
                        <div style={studioStyles.tableActions}>
                          <button
                            type="button"
                            style={studioStyles.compactButton}
                            onClick={() => openEditor(template)}
                          >
                            {t('Edit')}
                          </button>
                          <button
                            type="button"
                            style={studioStyles.dangerButton}
                            onClick={() => setDeleteTarget(template)}
                          >
                            {t('Delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* --- create / edit modal --------------------------------------------- */}
      {modal !== null && draft !== null && (
        <div
          style={studioStyles.modalBackdrop}
          // A backdrop click may ONLY close when the click did not land inside
          // the dialog. The container check is stronger than comparing
          // `target`/`currentTarget`: a click on any input, combobox, field card,
          // scrollbar or the textarea is provably inside the dialog and can never
          // be mistaken for a backdrop click.
          onClick={(event) => {
            if (isInsideContainer(modalRef.current, event.target)) {
              return;
            }

            requestClose();
          }}
        >
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-label={t('SMS template management')}
              style={studioStyles.modal}
              onKeyDown={handleModalKeyDown}
            >
              {/* FIXED header: never scrolls, so the dialog identity stays visible. */}
              <div style={studioStyles.modalHeader}>
                <p style={{ ...styles.heading, fontSize: 15 }}>
                  {draft.id === null
                    ? t('Create new template')
                    : t('Edit template')}
                </p>
                <button
                  type="button"
                  aria-label={t('Close')}
                  style={studioStyles.compactButton}
                  onClick={requestClose}
                >
                  {t('Close')}
                </button>
              </div>

              {/*
                The save/validation failure is pinned UNDER the header, outside
                the scrolling body. Previously it rendered at the top of the
                scrollable body, so a user standing at the bottom saw the Save
                button "do nothing" — the message existed but was scrolled out
                of view.
              */}
              {modalError !== null && (
                <p style={studioStyles.modalNotice}>{modalError}</p>
              )}

              {/* The ONLY scrolling region: bounded, so nothing escapes the viewport. */}
              <div style={studioStyles.modalBody}>
                {isConfirmingDiscard && (
              <div style={styles.warning}>
                <p style={styles.muted}>
                  {t('This template has unsaved changes.')}
                </p>
                <div style={styles.actions}>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => setIsConfirmingDiscard(false)}
                  >
                    {t('Keep editing')}
                  </button>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={closeEditor}
                  >
                    {t('Discard changes')}
                  </button>
                </div>
              </div>
            )}

            <div style={studioStyles.modalColumns}>
              <div style={studioStyles.modalMain}>
                <label style={styles.field}>
                  <span style={styles.label}>{t('Title')}</span>
                  <input
                    type="text"
                    aria-label={t('Title')}
                    value={draft.title}
                    onChange={(event) =>
                      updateDraft({ ...draft, title: event.target.value })
                    }
                    style={styles.control}
                  />
                </label>

                <StudioCombobox
                  options={targetOptions}
                  value={draft.targetObject}
                  onChange={(nextValue) => {
                    if (nextValue !== null) {
                      updateDraft({
                        ...draft,
                        // The stored value comes from the adapter, never from the
                        // label shown to the user.
                        targetObject: nextValue as typeof draft.targetObject,
                      });
                    }
                  }}
                  label={t('Target entity')}
                  placeholder={t('Choose a target entity')}
                  emptyLabel={t('No matching target.')}
                  clearLabel={t('Clear')}
                />

                <label style={styles.field}>
                  <span style={styles.label}>{t('Message body')}</span>
                  <textarea
                    ref={bodyRef}
                    aria-label={t('Message body')}
                    value={draft.body}
                    onChange={(event) =>
                      updateDraft({ ...draft, body: event.target.value })
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
                      // The inline style is what actually guarantees the RTL
                      // alignment in this app's renderer.
                      ...(direction === 'rtl'
                        ? { direction: 'rtl' as const, textAlign: 'right' as const }
                        : { direction: 'ltr' as const, textAlign: 'left' as const }),
                      ...(isBodyDragOver ? studioStyles.bodyDropActive : {}),
                    }}
                  />
                  <p style={styles.muted}>
                    {t(
                      'Double-click a field, or drag it here, to insert it at the cursor.',
                    )}
                  </p>
                </label>
              </div>

              <div style={studioStyles.modalSide}>
                <div style={styles.field}>
                  <span style={styles.label}>{t('Usable variables')}</span>

                  {catalogUnavailable ? (
                    <p
                      style={styles.warning}
                      data-catalog-stage={state.kind === 'READY' ? state.catalogStage : 'UNKNOWN'}
                    >
                      {t('Authorized variables are unavailable right now.')}
                    </p>
                  ) : (
                    <>
                      <input
                        type="text"
                        aria-label={t('Search fields')}
                        placeholder={t('Search fields')}
                        value={fieldQuery}
                        onChange={(event) => setFieldQuery(event.target.value)}
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
                        // The palette has its OWN bounded height and scrolling,
                        // so a long catalog can never grow the dialog.
                        <div style={studioStyles.variablePalette}>
                          {groupedFields.map((grouping) => (
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
                                    onDragEnd={handleFieldDragEnd}
                                  >
                                    <span style={studioStyles.fieldLabel}>
                                      {t(field.label)}
                                    </span>
                                    {/* Forced LTR + bidi isolation so the token
                                        always READS as `@person.firstName`. */}
                                    <span style={studioStyles.fieldToken}>
                                      {field.token}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div style={styles.field}>
                  <span style={styles.label}>{t('Sample preview')}</span>

                  {!isCatalogAvailable ? (
                    <p style={styles.warning}>
                      {t('Authorized variables are unavailable right now.')}
                    </p>
                  ) : (
                    <StudioCombobox
                      options={personOptions}
                      value={samplePersonId}
                      onChange={setSamplePersonId}
                      label={t('Sample person')}
                      placeholder={t('Search people')}
                      emptyLabel={t('No matching person.')}
                      clearLabel={t('Clear')}
                      isLoading={isPeopleLoading}
                      loadingLabel={t('Loading people…')}
                      hasMore={hasMorePeople}
                      isLoadingMore={isLoadingMorePeople}
                      loadingMoreLabel={t('Loading more…')}
                      onLoadMore={handleLoadMorePeople}
                      onSearchChange={setPeopleQuery}
                      errorLabel={
                        peopleErrorCode === null
                          ? null
                          : t('The people could not be loaded.')
                      }
                    />
                  )}

                  {/* Always rendered and disabled until every gate passes, so
                      the button and the request share ONE decision. */}
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
                      <p style={styles.preview}>{previewState.resolvedText}</p>
                      {previewState.issues.length > 0 && (
                        <p style={styles.warning}>
                          {t('Unresolved variables:')}{' '}
                          <span style={studioStyles.fieldToken}>
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
                      {t('No usable number was resolved for this person.')}
                    </p>
                  )}

                  {previewState.kind === 'EMPTY_BODY' && (
                    <p style={styles.warning}>{t('The message is empty.')}</p>
                  )}

                  {previewState.kind === 'ERROR' && (
                    <p style={styles.error}>
                      {t('The preview could not be built.')}
                    </p>
                  )}
                </div>
              </div>
            </div>
            </div>

            {/* FIXED actions: always reachable, never scrolled away. */}
            <div style={studioStyles.modalFooter}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={requestClose}
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
          </div>
        </div>
      )}

      {/* --- delete confirmation --------------------------------------------- */}
      {deleteTarget !== null && (
        <div
          style={studioStyles.modalBackdrop}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setDeleteTarget(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('Delete template')}
            style={studioStyles.modal}
          >
            <p style={styles.heading}>{t('Delete template')}</p>
            <p style={styles.muted}>
              {t('Delete this template permanently?')}{' '}
              {deleteTarget.title.length > 0
                ? deleteTarget.title
                : deleteTarget.id}
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
                style={studioStyles.dangerButton}
                onClick={() => void handleDelete()}
              >
                {t('Delete')}
              </button>
            </div>
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
    'Manages this workspace SMS templates: a searchable table plus a create/edit modal with the authorized fields and a sample preview.',
  component: TemplateStudio,
});
