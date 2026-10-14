import { useEffect, useRef, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  enqueueSnackbar,
  useRecordId,
  useLocale,
  useTranslate,
} from 'twenty-sdk/front-component';

import {
  callAppRoute,
  composerStyles as styles,
  getTextDirection,
} from 'src/components/composer-shared';
import { MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// The template editor shown on the template record page, inside the «متغیرها»
// tab.
//
// It is INLINE by design: no modal, no backdrop, no portal and no
// `document`-level listener. A front component runs in a worker, so a listener
// on `document` there would never see host events; every control here registers
// its listener on its own element, which the host does forward.
//
// The product model: the record's own `body` field holds the message text, and
// this component edits exactly that field through the app's server route — no
// parallel table, no second copy. The source model (which object a template is
// written for, and which relation resolves the recipient Person) is stored as
// stable metadata identifiers on the same record.

type VariableItem = { token: string; label: string };

type EligibleSource = {
  objectName: string;
  labelSingular: string;
  labelPlural: string;
  relations: { relationName: string; relationLabel: string }[];
};

type TemplateSnapshot = {
  body: string;
  title: string;
  sourceObjectName: string;
  recipientRelation: string;
  updatedAt: string;
};

type EditorState =
  | { kind: 'LOADING' }
  | { kind: 'READY' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ERROR' };

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const toVariable = (value: unknown): VariableItem | null => {
  const record = asRecord(value);

  if (record === null) {
    return null;
  }

  const token = readString(record.token);
  const label = readString(record.label);

  return token.length > 0 && label.length > 0 ? { token, label } : null;
};

const toSource = (value: unknown): EligibleSource | null => {
  const record = asRecord(value);

  if (record === null) {
    return null;
  }

  const objectName = readString(record.objectName);

  if (objectName.length === 0) {
    return null;
  }

  const relations = Array.isArray(record.relations)
    ? record.relations
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null)
        .map((entry) => ({
          relationName: readString(entry.relationName),
          relationLabel: readString(entry.relationLabel),
        }))
        .filter((entry) => entry.relationName.length > 0)
    : [];

  return {
    objectName,
    labelSingular: readString(record.labelSingular) || objectName,
    labelPlural: readString(record.labelPlural) || objectName,
    relations,
  };
};

/**
 * Inserts a token ONCE, at the caret when the renderer exposes a selection and
 * at the end of the text otherwise.
 *
 * Why the fallback exists: this platform's remote-element polyfill does not
 * implement `selectionStart`/`setSelectionRange`, so the caret is not readable
 * from a front component. Rather than pretend, the caller is told which
 * behaviour was used and the textarea position is preserved when the API IS
 * available.
 */
export const insertTokenIntoBody = ({
  body,
  token,
  selectionStart,
  selectionEnd,
}: {
  body: string;
  token: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}): { body: string; usedCaret: boolean } => {
  const canUseCaret =
    typeof selectionStart === 'number' &&
    typeof selectionEnd === 'number' &&
    selectionStart >= 0 &&
    selectionEnd >= selectionStart &&
    selectionEnd <= body.length;

  if (!canUseCaret) {
    return { body: `${body}${token}`, usedCaret: false };
  }

  return {
    body: `${body.slice(0, selectionStart)}${token}${body.slice(selectionEnd)}`,
    usedCaret: true,
  };
};

const TemplateEditor = () => {
  const { t } = useTranslate();
  const locale = useLocale();
  const direction = getTextDirection(locale);
  const templateId = useRecordId();

  const [state, setState] = useState<EditorState>({ kind: 'LOADING' });
  const [variables, setVariables] = useState<VariableItem[]>([]);
  const [sources, setSources] = useState<EligibleSource[]>([]);
  const [snapshot, setSnapshot] = useState<TemplateSnapshot | null>(null);

  const [body, setBody] = useState('');
  const [sourceObjectName, setSourceObjectName] = useState('person');
  const [recipientRelation, setRecipientRelation] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [samplePersonId, setSamplePersonId] = useState('');
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  // Load the record's own body + source model, the eligible sources and the
  // authorized variables. Nothing is guessed: a failure is reported as such.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [templateResponse, sourcesResponse, variablesResponse] =
          await Promise.all([
            callAppRoute('/communication/template-studio', 'POST', {
              action: 'read-template',
              templateId,
            }),
            callAppRoute('/communication/template-studio', 'POST', {
              action: 'eligible-sources',
            }),
            callAppRoute('/communication/message-templates', 'POST'),
          ]);

        if (cancelled) {
          return;
        }

        const templatePayload = asRecord(templateResponse.data);
        const template = asRecord(templatePayload?.template);

        if (templatePayload?.success !== true || template === null) {
          setState({ kind: 'NOT_FOUND' });
          return;
        }

        const loaded: TemplateSnapshot = {
          body: readString(template.body),
          title: readString(template.title),
          // A row written before the source model has neither identifier, which
          // is read as Person — the same default the server applies.
          sourceObjectName: readString(template.sourceObjectName) || 'person',
          recipientRelation: readString(template.recipientRelation),
          updatedAt: readString(template.updatedAt),
        };

        setSnapshot(loaded);
        setBody(loaded.body);
        setSourceObjectName(loaded.sourceObjectName);
        setRecipientRelation(loaded.recipientRelation);

        const sourcesPayload = asRecord(sourcesResponse.data);

        if (sourcesPayload?.success === true && Array.isArray(sourcesPayload.sources)) {
          setSources(
            sourcesPayload.sources
              .map(toSource)
              .filter((source): source is EligibleSource => source !== null),
          );
        }

        const variablesPayload = asRecord(variablesResponse.data);

        if (
          variablesPayload?.success === true &&
          Array.isArray(variablesPayload.variables)
        ) {
          setVariables(
            variablesPayload.variables
              .map(toVariable)
              .filter((variable): variable is VariableItem => variable !== null),
          );
        }

        setState({ kind: 'READY' });
      } catch {
        if (!cancelled) {
          setState({ kind: 'ERROR' });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  // The sample people for the preview, loaded once the editor is usable.
  useEffect(() => {
    if (state.kind !== 'READY') {
      return;
    }

    let cancelled = false;

    const loadPeople = async () => {
      try {
        const response = await callAppRoute(
          '/communication/template-studio',
          'POST',
          { action: 'search-people', search: '', after: null },
        );

        if (cancelled) {
          return;
        }

        const payload = asRecord(response.data);

        if (payload?.success === true && Array.isArray(payload.people)) {
          setPeople(
            payload.people
              .map((entry) => asRecord(entry))
              .filter((entry): entry is Record<string, unknown> => entry !== null)
              .map((entry) => ({
                id: readString(entry.id),
                name: readString(entry.displayName) || readString(entry.id),
              }))
              .filter((entry) => entry.id.length > 0),
          );
        }
      } catch {
        // A failed sample list leaves the preview unavailable, never wrong.
      }
    };

    void loadPeople();

    return () => {
      cancelled = true;
    };
  }, [state.kind]);

  const isDirty = snapshot !== null && body !== snapshot.body;

  const handleInsertVariable = (token: string) => {
    const textarea = bodyRef.current;

    const start =
      typeof textarea?.selectionStart === 'number' ? textarea.selectionStart : null;
    const end =
      typeof textarea?.selectionEnd === 'number' ? textarea.selectionEnd : null;

    const next = insertTokenIntoBody({
      body,
      token,
      selectionStart: start,
      selectionEnd: end,
    });

    setBody(next.body);
    setSavedNotice(false);
  };

  const handleSaveBody = async () => {
    if (snapshot === null || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSavedNotice(false);

    try {
      const response = await callAppRoute(
        '/communication/template-studio',
        'POST',
        {
          action: 'save-body',
          templateId,
          body,
          expectedUpdatedAt: snapshot.updatedAt,
        },
      );

      const payload = asRecord(response.data);

      if (payload?.success !== true) {
        // On a conflict the typed text is KEPT: clearing it would destroy the
        // user's work, which is exactly what they are trying to avoid.
        setSaveError(
          payload?.isConflict === true
            ? t('Someone else changed this template. Reload before saving.')
            : t('The template could not be saved.'),
        );
        return;
      }

      const updated = asRecord(payload.template);

      if (updated !== null) {
        setSnapshot({
          body: readString(updated.body),
          title: readString(updated.title),
          sourceObjectName:
            readString(updated.sourceObjectName) || snapshot.sourceObjectName,
          recipientRelation: readString(updated.recipientRelation),
          updatedAt: readString(updated.updatedAt),
        });
      }

      setSavedNotice(true);
      await enqueueSnackbar({ message: t('The template was saved.'), variant: 'success' });
    } catch {
      setSaveError(t('The template could not be saved.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSource = async () => {
    setSaveError(null);
    setSavedNotice(false);

    try {
      const response = await callAppRoute(
        '/communication/template-studio',
        'POST',
        {
          action: 'save-source',
          templateId,
          sourceObjectName,
          recipientRelation,
        },
      );

      const payload = asRecord(response.data);

      if (payload?.success !== true) {
        setSaveError(t('The template could not be saved.'));
        return;
      }

      const updated = asRecord(payload.template);

      if (updated !== null && snapshot !== null) {
        setSnapshot({
          ...snapshot,
          sourceObjectName: readString(updated.sourceObjectName),
          recipientRelation: readString(updated.recipientRelation),
        });
      }

      setSavedNotice(true);
    } catch {
      setSaveError(t('The template could not be saved.'));
    }
  };

  const handlePreview = async () => {
    if (samplePersonId.length === 0 || isPreviewing) {
      return;
    }

    setIsPreviewing(true);
    setPreviewError(null);
    setPreviewText(null);

    try {
      const response = await callAppRoute(
        '/communication/template-studio',
        'POST',
        { action: 'preview', personId: samplePersonId, body },
      );

      const payload = asRecord(response.data);

      if (payload?.success !== true) {
        setPreviewError(t('The preview could not be built.'));
        return;
      }

      const previews = Array.isArray(payload.previews) ? payload.previews : [];
      const first = asRecord(previews[0]);

      setPreviewText(readString(first?.previewText));
    } catch {
      setPreviewError(t('The preview could not be built.'));
    } finally {
      setIsPreviewing(false);
    }
  };

  if (state.kind === 'LOADING') {
    return (
      <div style={{ ...styles.container, direction }}>
        <p style={styles.muted}>{t('Loading…')}</p>
      </div>
    );
  }

  if (state.kind === 'NOT_FOUND' || state.kind === 'ERROR') {
    return (
      <div style={{ ...styles.container, direction }}>
        <p style={styles.error}>{t('The template could not be loaded.')}</p>
      </div>
    );
  }

  const selectedSource = sources.find(
    (source) => source.objectName === sourceObjectName,
  );
  const relationOptions = selectedSource?.relations ?? [];

  return (
    <div style={{ ...styles.container, direction }}>
      {/* --- source model ------------------------------------------------- */}
      <div style={styles.field} data-editor-source>
        <span style={styles.label}>{t('Source entity')}</span>
        <select
          aria-label={t('Source entity')}
          value={sourceObjectName}
          onChange={(event) => {
            const nextObject = event.target.value;
            setSourceObjectName(nextObject);

            // A relation belongs to its object, so it is reset rather than
            // carried across a source change.
            const nextSource = sources.find(
              (source) => source.objectName === nextObject,
            );

            setRecipientRelation(
              nextSource !== undefined && nextSource.relations.length === 1
                ? nextSource.relations[0].relationName
                : '',
            );
          }}
          style={styles.control}
        >
          {sources.map((source) => (
            <option key={source.objectName} value={source.objectName}>
              {source.labelPlural}
            </option>
          ))}
        </select>
      </div>

      {relationOptions.length > 1 && (
        <div style={styles.field} data-editor-relation>
          <span style={styles.label}>{t('Recipient relation')}</span>
          <select
            aria-label={t('Recipient relation')}
            value={recipientRelation}
            onChange={(event) => setRecipientRelation(event.target.value)}
            style={styles.control}
          >
            <option value="">{t('Choose a relation')}</option>
            {relationOptions.map((relation) => (
              <option key={relation.relationName} value={relation.relationName}>
                {relation.relationLabel}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={styles.actions}>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => void handleSaveSource()}
        >
          {t('Save source')}
        </button>
      </div>

      {/* --- the message body --------------------------------------------- */}
      <div style={styles.field}>
        <span style={styles.label}>{t('Message body')}</span>
        <textarea
          ref={bodyRef}
          aria-label={t('Message body')}
          value={body}
          rows={10}
          onChange={(event) => {
            setBody(event.target.value);
            setSavedNotice(false);
          }}
          style={{
            ...styles.control,
            direction: 'rtl',
            textAlign: 'right',
            minHeight: 200,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* --- variables ----------------------------------------------------- */}
      <div style={styles.field} data-editor-variables>
        <span style={styles.label}>{t('Usable variables')}</span>
        <ul style={styles.recipientList}>
          {variables.map((variable) => (
            <li key={variable.token} style={styles.recipientRow}>
              <div style={styles.recipientHeader}>
                {/* ASCII token, forced LTR so it never reorders in RTL text. */}
                <span style={{ ...styles.recipientName, direction: 'ltr' }}>
                  {variable.token}
                </span>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => handleInsertVariable(variable.token)}
                >
                  {t('Add')}
                </button>
              </div>
              <span style={styles.muted}>{t(variable.label)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* --- save ---------------------------------------------------------- */}
      <div style={styles.actions}>
        <button
          type="button"
          style={styles.primaryButton}
          disabled={isSaving || !isDirty}
          onClick={() => void handleSaveBody()}
        >
          {isSaving ? t('Saving…') : t('Save')}
        </button>
        {isDirty && <span style={styles.muted} data-editor-dirty>{t('Unsaved changes')}</span>}
        {savedNotice && !isDirty && (
          <span style={styles.muted} data-editor-saved>{t('Saved')}</span>
        )}
      </div>

      {saveError !== null && <p style={styles.error}>{saveError}</p>}

      {/* --- preview ------------------------------------------------------- */}
      <div style={styles.field} data-editor-preview>
        <span style={styles.label}>{t('Preview')}</span>
        <select
          aria-label={t('Sample person')}
          value={samplePersonId}
          onChange={(event) => setSamplePersonId(event.target.value)}
          style={styles.control}
        >
          <option value="">{t('Select a sample person to preview.')}</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <div style={styles.actions}>
          <button
            type="button"
            style={styles.secondaryButton}
            disabled={samplePersonId.length === 0 || isPreviewing}
            onClick={() => void handlePreview()}
          >
            {isPreviewing ? t('Previewing…') : t('Preview')}
          </button>
        </div>
        {previewText !== null && <p style={styles.preview}>{previewText}</p>}
        {previewError !== null && <p style={styles.error}>{previewError}</p>}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'template-variable-guide',
  description:
    'Inline editor for a template record: source model, message body, variables and a sample preview.',
  component: TemplateEditor,
});
