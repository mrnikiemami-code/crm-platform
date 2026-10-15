import { useCallback, useEffect, useRef, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  enqueueSnackbar,
  useLocale,
  useRecordId,
  useTranslate,
} from 'twenty-sdk/front-component';

import {
  callAppRoute,
  composerStyles as styles,
  getTextDirection,
} from 'src/components/composer-shared';
import { MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// The template editor shown on the template record page, inside the «متغیرها» tab.
//
// It is INLINE by design: no modal, no backdrop, no portal and no
// `document`-level listener. A front component runs in a worker, so a listener on
// `document` there would never see host events; every control here registers its
// listener on its own element, which the host does forward.
//
// IDENTITY: what this component sends and receives for a source is the metadata
// `universalIdentifier` of the object and of the relation field. Names are
// display-only hints resolved server-side from metadata.
//
// AUTHORIZATION: every action on the server is user-scoped, and a front component
// calls with the APPLICATION token, which carries no person. The server therefore
// answers `AUTH_REQUIRED` and this editor shows that plainly and disables its
// operations rather than pretending they worked.

type VariableItem = { token: string; label: string };

type SourceRelation = {
  relationUid: string;
  relationName: string;
  relationLabel: string;
};

type EligibleSource = {
  objectUid: string;
  objectName: string;
  objectNamePlural: string;
  labelSingular: string;
  labelPlural: string;
  relations: SourceRelation[];
};

type TemplateSnapshot = {
  title: string;
  body: string;
  sourceObjectUid: string;
  recipientRelationUid: string;
  updatedAt: string;
};

type EditorState =
  | { kind: 'LOADING' }
  | { kind: 'READY' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ERROR' }
  | { kind: 'AUTH_REQUIRED' };

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

  const objectUid = readString(record.objectUid);

  if (objectUid.length === 0) {
    return null;
  }

  const relations = Array.isArray(record.relations)
    ? record.relations
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null)
        .map((entry) => ({
          relationUid: readString(entry.relationUid),
          relationName: readString(entry.relationName),
          relationLabel: readString(entry.relationLabel),
        }))
        .filter((entry) => entry.relationUid.length > 0)
    : [];

  const objectName = readString(record.objectName);

  return {
    objectUid,
    objectName,
    objectNamePlural: readString(record.objectNamePlural) || objectName,
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
 * from a front component. Rather than pretend, the caller is told which behaviour
 * was used and the textarea position is preserved when the API IS available.
 */
export const insertTokenIntoBody = ({  body,
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

/**
 * The host bridge that runs a Communication operation AS THE SIGNED-IN USER.
 *
 * The host exposes it on `globalThis.frontComponentHostCommunicationApi`, the same
 * object the SDK's own helpers read from, so this app needs no SDK change. It is
 * the ONLY way to reach a user-scoped operation: `callAppRoute` sends the
 * APPLICATION token and is therefore refused by the server's authorization guard.
 */
type CommunicationRouteBridge = (request: {
  action: string;
  payload?: Record<string, unknown>;
}) => Promise<unknown>;

const readCommunicationBridge = (): CommunicationRouteBridge | null => {
  const api = (
    globalThis as unknown as {
      frontComponentHostCommunicationApi?: {
        callCommunicationRoute?: CommunicationRouteBridge;
      };
    }
  ).frontComponentHostCommunicationApi;

  return typeof api?.callCommunicationRoute === 'function'
    ? api.callCommunicationRoute
    : null;
};

const TemplateEditor = () => {
  const { t } = useTranslate();
  const locale = useLocale();
  const direction = getTextDirection(locale);
  const templateId = useRecordId();

  const [state, setState] = useState<EditorState>({ kind: 'LOADING' });
  const [variables, setVariables] = useState<VariableItem[]>([]);
  // The catalog has its OWN state so the editor can distinguish "still loading",
  // "this workspace really has no fields", and "loading failed — try again".
  // Collapsing a failure into an empty list would hide an access problem as if
  // there were simply nothing to insert.
  const [catalogState, setCatalogState] = useState<
    'LOADING' | 'READY' | 'EMPTY' | 'UNAVAILABLE' | 'ERROR'
  >('LOADING');
  const [sources, setSources] = useState<EligibleSource[]>([]);
  const [snapshot, setSnapshot] = useState<TemplateSnapshot | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sourceObjectUid, setSourceObjectUid] = useState('');
  const [recipientRelationUid, setRecipientRelationUid] = useState('');
  // Guards against a slow response overwriting a newer choice: every catalog and
  // sample request carries a sequence number and only the newest may publish.
  const catalogRequestIdRef = useRef(0);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);

  const [sampleRecords, setSampleRecords] = useState<
    { id: string; label: string }[]
  >([]);
  const [sampleRecordId, setSampleRecordId] = useState('');
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  /**
   * Every guarded action funnels through here.
   *
   * Preferred path: the HOST bridge, which runs the operation as the signed-in
   * user. When it is unavailable (an older host), the app falls back to its own
   * route — which then fails closed with `AUTH_REQUIRED` because it carries only
   * the application token. Either way an `AUTH_REQUIRED` answer switches the whole
   * editor into the blocked state rather than being mistaken for a normal failure.
   */
  const callGuarded = useCallback(
    async (payload: Record<string, unknown>) => {
      const bridge = readCommunicationBridge();
      const action = readString(payload.action);
      const args: Record<string, unknown> = { ...payload };
      delete args.action;

      if (bridge !== null) {
        const result = asRecord(await bridge({ action, payload: args }));

        if (readString(result?.errorCode) === 'AUTH_REQUIRED') {
          setState({ kind: 'AUTH_REQUIRED' });

          return null;
        }

        return result;
      }

      const response = await callAppRoute(
        '/communication/template-studio',
        'POST',
        payload,
      );

      const result = asRecord(response.data);

      if (readString(result?.errorCode) === 'AUTH_REQUIRED') {
        setState({ kind: 'AUTH_REQUIRED' });

        return null;
      }

      return result;
    },
    [],
  );

  /**
   * Loads the authorized variable catalog for the editor's variable list.
   *
   * It is a separate callback so the editor can RETRY it on its own after a
   * failure, without reloading the whole record. The sequence number makes a
   * slow earlier response unable to overwrite a newer one.
   */
  const loadCatalog = useCallback(async () => {
    catalogRequestIdRef.current += 1;
    const requestId = catalogRequestIdRef.current;

    setCatalogState('LOADING');

    const payload = await callGuarded({ action: 'catalog' });

    if (requestId !== catalogRequestIdRef.current) {
      return;
    }

    if (payload === null) {
      return;
    }

    if (payload.success !== true) {
      setCatalogState('ERROR');
      return;
    }

    if (readString(payload.catalogStatus) === 'UNAVAILABLE') {
      setCatalogState('UNAVAILABLE');
      return;
    }

    const parsed = Array.isArray(payload.variables)
      ? payload.variables
          .map(toVariable)
          .filter((variable): variable is VariableItem => variable !== null)
      : [];

    setVariables(parsed);
    setCatalogState(parsed.length === 0 ? 'EMPTY' : 'READY');
  }, [callGuarded]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const template = await callGuarded({
          action: 'read-template',
          templateId,
        });

        if (cancelled || template === null) {
          return;
        }

        const loaded = asRecord(template.template);

        if (template.success !== true || loaded === null) {
          setState({ kind: 'NOT_FOUND' });
          return;
        }

        setSnapshot({
          title: readString(loaded.title),
          body: readString(loaded.body),
          // An empty stored source means the legacy Person meaning; the server
          // resolves it, and the editor simply echoes the stored values.
          sourceObjectUid: readString(loaded.sourceObjectUid),
          recipientRelationUid: readString(loaded.recipientRelationUid),
          updatedAt: readString(loaded.updatedAt),
        });
        setTitle(readString(loaded.title));
        setBody(readString(loaded.body));

        const sourcesResult = await callGuarded({ action: 'eligible-sources' });

        if (cancelled) {
          return;
        }

        if (sourcesResult === null) {
          return;
        }

        const parsedSources =
          sourcesResult.success === true && Array.isArray(sourcesResult.sources)
            ? sourcesResult.sources
                .map(toSource)
                .filter((entry): entry is EligibleSource => entry !== null)
            : [];

        setSources(parsedSources);

        const stored = readString(loaded.sourceObjectUid);
        const personSource = parsedSources.find(
          (entry) => entry.objectName === 'person',
        );

        setSourceObjectUid(
          stored.length > 0 ? stored : (personSource?.objectUid ?? ''),
        );
        setRecipientRelationUid(readString(loaded.recipientRelationUid));

        // The catalog is loaded for the editor as soon as the record is known,
        // so opening an existing template shows its variables WITHOUT the user
        // having to re-select the source.
        await loadCatalog();

        if (cancelled) {
          return;
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
  }, [templateId, callGuarded, loadCatalog]);

  const selectedSource = sources.find(
    (entry) => entry.objectUid === sourceObjectUid,
  );
  const relationOptions = selectedSource?.relations ?? [];
  const isPersonSource = selectedSource?.objectName === 'person';

  // The sample records for the preview are records of the TEMPLATE'S OWN source
  // object, so the preview resolves the recipient from the record the user picks.
  useEffect(() => {
    if (state.kind !== 'READY' || selectedSource === undefined) {
      return;
    }

    let cancelled = false;

    const loadRecords = async () => {
      const result = await callGuarded({
        action: 'source-records',
        sourceObjectUid: selectedSource.objectUid,
        search: '',
      });

      if (cancelled || result === null || result.success !== true) {
        return;
      }

      setSampleRecords(
        Array.isArray(result.records)
          ? result.records
              .map((entry) => asRecord(entry))
              .filter((entry): entry is Record<string, unknown> => entry !== null)
              .map((entry) => ({
                id: readString(entry.id),
                label: readString(entry.label),
              }))
              .filter((entry) => entry.id.length > 0)
          : [],
      );
    };

    void loadRecords();

    return () => {
      cancelled = true;
    };
  }, [state.kind, selectedSource, callGuarded]);

  const isDirty =
    snapshot !== null &&
    (title !== snapshot.title ||
      body !== snapshot.body ||
      sourceObjectUid !== snapshot.sourceObjectUid ||
      recipientRelationUid !== snapshot.recipientRelationUid);

  const handleInsertVariable = (token: string) => {
    const textarea = bodyRef.current;

    const next = insertTokenIntoBody({
      body,
      token,
      selectionStart:
        typeof textarea?.selectionStart === 'number'
          ? textarea.selectionStart
          : null,
      selectionEnd:
        typeof textarea?.selectionEnd === 'number' ? textarea.selectionEnd : null,
    });

    setBody(next.body);
    setSavedNotice(false);
  };

  /**
   * Cancel never silently discards typed work: with unsaved changes it asks
   * first, and only then restores the last SAVED values.
   */
  const handleCancel = () => {
    if (snapshot === null) {
      return;
    }

    if (isDirty) {
      setIsConfirmingDiscard(true);
      return;
    }
  };

  const handleDiscardConfirmed = () => {
    if (snapshot === null) {
      return;
    }

    setTitle(snapshot.title);
    setBody(snapshot.body);
    setSourceObjectUid(snapshot.sourceObjectUid);
    setRecipientRelationUid(snapshot.recipientRelationUid);
    setIsConfirmingDiscard(false);
    setSaveError(null);
    setSavedNotice(false);
  };

  const handleSave = async () => {
    if (snapshot === null || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSavedNotice(false);

    try {
      const payload = await callGuarded({
        action: 'save-template',
        templateId,
        title,
        body,
        sourceObjectUid,
        recipientRelationUid,
        expectedUpdatedAt: snapshot.updatedAt,
      });

      if (payload === null) {
        return;
      }

      if (payload.success !== true) {
        if (payload.isConflict === true) {
          // The typed text is KEPT: discarding the user's work is exactly what
          // they are trying to avoid.
          setSaveError(
            readString(payload.message) ||
              t('Someone else changed this template. Reload before saving.'),
          );
          return;
        }

        setSaveError(t('The template could not be saved.'));
        return;
      }

      const updated = asRecord(payload.template);

      if (updated !== null) {
        setSnapshot({
          title: readString(updated.title),
          body: readString(updated.body),
          sourceObjectUid: readString(updated.sourceObjectUid),
          recipientRelationUid: readString(updated.recipientRelationUid),
          updatedAt: readString(updated.updatedAt),
        });
      }

      setSavedNotice(true);
      await enqueueSnackbar({
        message: t('The template was saved.'),
        variant: 'success',
      });
    } catch {
      setSaveError(t('The template could not be saved.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = async () => {
    if (sampleRecordId.length === 0 || isPreviewing || selectedSource === undefined) {
      return;
    }

    setIsPreviewing(true);
    setPreviewError(null);
    setPreviewText(null);

    try {
      const payload = await callGuarded({
        action: 'preview',
        templateId,
        sampleRecordId,
        sampleObjectName: selectedSource.objectName,
        body,
      });

      if (payload === null) {
        return;
      }

      if (payload.success !== true) {
        setPreviewError(
          readString(payload.message) || t('The preview could not be built.'),
        );
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

  // The blocked state is shown FIRST and in full: the platform authenticated only
  // the application, so these operations cannot run as the person looking at the
  // screen and no control is offered that would fail anyway.
  if (state.kind === 'AUTH_REQUIRED') {
    return (
      <div style={{ ...styles.container, direction }} data-editor-auth-required>
        <p style={styles.heading}>{t('Template editor')}</p>
        <p style={styles.error}>
          {t(
            'This editor needs your own signed-in access. The application identity is not enough, so reading, saving and previewing are disabled.',
          )}
        </p>
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

  return (
    <div style={{ ...styles.container, direction }}>
      {/*
        Title first, then the single source control, then the body, variables,
        sample person, preview and the actions — one shared flow for a new and an
        existing template. Technical identifiers are never rendered here.
      */}
      <div style={styles.field}>
        <span style={styles.label}>{t('Title')}</span>
        <input
          type="text"
          aria-label={t('Title')}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setSavedNotice(false);
          }}
          style={styles.control}
        />
      </div>

      <div style={styles.field} data-editor-source>
        <span style={styles.label}>{t('Source entity')}</span>
        <select
          aria-label={t('Source entity')}
          value={sourceObjectUid}
          onChange={(event) => {
            const nextUid = event.target.value;
            setSourceObjectUid(nextUid);
            setSampleRecordId('');
            setPreviewText(null);

            // A relation belongs to its object, so it is re-derived rather than
            // carried across a source change. One eligible relation is selected
            // automatically; several require an explicit choice.
            const nextSource = sources.find(
              (entry) => entry.objectUid === nextUid,
            );

            setRecipientRelationUid(
              nextSource !== undefined && nextSource.relations.length === 1
                ? nextSource.relations[0].relationUid
                : '',
            );

            // The catalog belongs to the selected source, so it is refreshed and
            // any stale sample/preview is cleared rather than left behind.
            void loadCatalog();
          }}
          style={styles.control}
        >
          {sources.map((source) => (
            <option key={source.objectUid} value={source.objectUid}>
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
            value={recipientRelationUid}
            onChange={(event) => {
              setRecipientRelationUid(event.target.value);
              setSampleRecordId('');
              setPreviewText(null);
            }}
            style={styles.control}
          >
            <option value="">{t('Choose a relation')}</option>
            {relationOptions.map((relation) => (
              <option key={relation.relationUid} value={relation.relationUid}>
                {relation.relationLabel}
              </option>
            ))}
          </select>
        </div>
      )}

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

      <div style={styles.field} data-editor-variables>
        <span style={styles.label}>{t('Usable variables')}</span>

        {catalogState === 'LOADING' && (
          <p style={styles.muted} data-editor-catalog="loading">
            {t('Loading variables…')}
          </p>
        )}

        {/*
          A failure is shown AS a failure with a retry. Reporting it as an empty
          list would hide an access problem as though the workspace simply had no
          fields to insert.
        */}
        {catalogState === 'ERROR' && (
          <div style={styles.actions} data-editor-catalog="error">
            <p style={styles.error}>{t('Unable to load variables.')}</p>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => void loadCatalog()}
            >
              {t('Retry')}
            </button>
          </div>
        )}

        {catalogState === 'UNAVAILABLE' && (
          <div style={styles.actions} data-editor-catalog="unavailable">
            <p style={styles.warning}>
              {t(
                'Authorized variables are unavailable right now. They are not the same as "no variables".',
              )}
            </p>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => void loadCatalog()}
            >
              {t('Retry')}
            </button>
          </div>
        )}

        {catalogState === 'EMPTY' && (
          <p style={styles.muted} data-editor-catalog="empty">
            {t('No usable variables were found.')}
          </p>
        )}

        {catalogState === 'READY' && (
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
                    {/* The label states what actually happens: this platform's
                        remote-element polyfill exposes no selection API, so the
                        token is appended. */}
                    {t('Add to end of text')}
                  </button>
                </div>
                <span style={styles.muted}>{t(variable.label)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={styles.actions}>
        <button
          type="button"
          style={styles.primaryButton}
          disabled={isSaving || !isDirty}
          onClick={() => void handleSave()}
        >
          {isSaving ? t('Saving…') : t('Save')}
        </button>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={handleCancel}
        >
          {t('Cancel')}
        </button>
        {isDirty && (
          <span style={styles.muted} data-editor-dirty>
            {t('Unsaved changes')}
          </span>
        )}
        {savedNotice && !isDirty && (
          <span style={styles.muted} data-editor-saved>
            {t('Saved')}
          </span>
        )}
      </div>

      {isConfirmingDiscard && (
        <div style={styles.warning} data-editor-discard>
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
              onClick={handleDiscardConfirmed}
            >
              {t('Discard changes')}
            </button>
          </div>
        </div>
      )}

      {saveError !== null && <p style={styles.error}>{saveError}</p>}

      <div style={styles.field} data-editor-preview>
        <span style={styles.label}>{t('Preview')}</span>
        <select
          aria-label={t('Sample record')}
          value={sampleRecordId}
          onChange={(event) => setSampleRecordId(event.target.value)}
          style={styles.control}
        >
          <option value="">{t('Select a sample record to preview.')}</option>
          {sampleRecords.map((record) => (
            <option key={record.id} value={record.id}>
              {record.label}
            </option>
          ))}
        </select>
        <p style={styles.muted}>
          {isPersonSource
            ? t('The selected person is the recipient.')
            : t('The recipient is resolved from the selected record.')}
        </p>
        <div style={styles.actions}>
          <button
            type="button"
            style={styles.secondaryButton}
            disabled={sampleRecordId.length === 0 || isPreviewing}
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
