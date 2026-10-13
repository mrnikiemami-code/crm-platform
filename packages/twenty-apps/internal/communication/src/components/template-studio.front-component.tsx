import { useEffect, useMemo, useRef, useState } from 'react';
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
  type StudioLoadState,
} from 'src/studio/template-studio-client';
import {
  EMPTY_STUDIO_DRAFT,
  filterStudioFields,
  groupStudioFields,
  insertTokenAtSelection,
  isStudioDraftDirty,
  toStudioDraft,
  validateStudioDraft,
  type StudioDraft,
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

const TemplateStudio = () => {
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
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

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

  const templates = state.kind === 'READY' ? state.templates : [];
  const fields = state.kind === 'READY' ? state.fields : [];
  const catalogUnavailable =
    state.kind === 'READY' && state.catalogStatus === 'UNAVAILABLE';

  const isDirty = draft !== null && isStudioDraftDirty(draft, baseline);

  const groupedFields = useMemo(
    () => groupStudioFields(filterStudioFields(fields, fieldQuery)),
    [fields, fieldQuery],
  );

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

    const textarea = bodyRef.current;

    const next = insertTokenAtSelection({
      body: draft.body,
      selectionStart: textarea?.selectionStart ?? null,
      selectionEnd: textarea?.selectionEnd ?? null,
      token,
    });

    setDraft({ ...draft, body: next.body });

    // Restore the caret after the inserted token on the next paint, so several
    // inserts in a row land in the order the user clicked them.
    setTimeout(() => {
      const element = bodyRef.current;

      if (element !== null) {
        element.focus();
        element.setSelectionRange(next.caret, next.caret);
      }
    }, 0);
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
                    value={draft.body}
                    onChange={(event) =>
                      setDraft({ ...draft, body: event.target.value })
                    }
                    rows={8}
                    dir={direction}
                    style={{ ...styles.control, ...studioStyles.body }}
                  />
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
                        {t('Click a field to insert it at the cursor.')}
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
                                <button
                                  key={field.token}
                                  type="button"
                                  style={studioStyles.fieldButton}
                                  onClick={() =>
                                    handleInsertField(field.token)
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
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </>
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
