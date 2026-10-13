import { useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  copyToClipboard,
  enqueueSnackbar,
  useLocale,
  useTranslate,
} from 'twenty-sdk/front-component';

import {
  callAppRoute,
  composerStyles as styles,
  getTextDirection,
} from 'src/components/composer-shared';
import { MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// The «متغیرهای قابل استفاده» guide shown on the template record page.
//
// The variable documentation lives HERE, in template management — not in the
// send composer, which is only for choosing a template and sending.
//
// The list comes from the app's own `/communication/message-templates` route,
// which builds the catalog at runtime from the workspace's object/field
// metadata and the app role's permissions. That is the SAME catalog the preview
// and both send paths evaluate, so the manager can never advertise a token the
// evaluator would reject (and custom fields appear automatically).
//
// Boundary (stated honestly): the body is a NATIVE field rendered by the host,
// and the front-component sandbox exposes no API to write into that field's
// caret. So a click COPIES the token to the clipboard and confirms it in
// Persian — it does NOT fake an insertion into the editor.
type VariableItem = { token: string; label: string };

type LoadState =
  | { kind: 'LOADING' }
  | { kind: 'READY'; variables: VariableItem[] }
  | { kind: 'EMPTY' }
  | { kind: 'ERROR' };

const toVariable = (value: unknown): VariableItem | null => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.token !== 'string' ||
    record.token.length === 0 ||
    typeof record.label !== 'string' ||
    record.label.length === 0
  ) {
    return null;
  }

  return { token: record.token, label: record.label };
};

const resolveVariablesState = (response: {
  ok: boolean;
  data: unknown;
}): LoadState => {
  if (
    !response.ok ||
    response.data === null ||
    typeof response.data !== 'object'
  ) {
    return { kind: 'ERROR' };
  }

  const payload = response.data as Record<string, unknown>;

  if (payload.success !== true || !Array.isArray(payload.variables)) {
    return { kind: 'ERROR' };
  }

  const variables = payload.variables
    .map(toVariable)
    .filter((variable): variable is VariableItem => variable !== null);

  return variables.length === 0
    ? { kind: 'EMPTY' }
    : { kind: 'READY', variables };
};

const VariableGuide = () => {
  const { t } = useTranslate();
  const locale = useLocale();
  const direction = getTextDirection(locale);

  const [state, setState] = useState<LoadState>({ kind: 'LOADING' });
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await callAppRoute(
          '/communication/message-templates',
          'POST',
        );

        if (!cancelled) {
          setState(resolveVariablesState(response));
        }
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
  }, []);

  const handleCopy = async (token: string) => {
    await copyToClipboard(token);
    setCopiedToken(token);
    await enqueueSnackbar({
      message: t('Variable copied'),
      variant: 'success',
    });
  };

  return (
    <div style={{ ...styles.container, direction }}>
      <div style={styles.field}>
        <p style={styles.heading}>{t('Usable variables')}</p>
        <p style={styles.hint}>
          {t(
            'Place these variables in the message body. Each one is replaced with the recipient’s own value when the message is sent.',
          )}
        </p>
      </div>

      {state.kind === 'LOADING' && (
        <p style={styles.muted}>{t('Loading variables…')}</p>
      )}

      {state.kind === 'ERROR' && (
        <p style={styles.error}>{t('Unable to load variables.')}</p>
      )}

      {state.kind === 'EMPTY' && (
        <p style={styles.muted}>{t('No usable variables were found.')}</p>
      )}

      {state.kind === 'READY' && (
        <ul style={styles.recipientList}>
          {state.variables.map((variable) => (
            <li key={variable.token} style={styles.recipientRow}>
              <div style={styles.recipientHeader}>
                <span style={{ ...styles.recipientName, direction: 'ltr' }}>
                  {variable.token}
                </span>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => void handleCopy(variable.token)}
                >
                  {copiedToken === variable.token ? t('Copied') : t('Copy')}
                </button>
              </div>
              <span style={styles.muted}>{t(variable.label)}</span>
            </li>
          ))}
        </ul>
      )}

      <p style={styles.muted}>
        {t(
          'The six legacy names (@name, @firstName, @lastName, @fullName, @company, @companyName) keep working and mean the same as their new form.',
        )}
      </p>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier:
    MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'template-variable-guide',
  description:
    'Lists the workspace-authorized template variables and copies a token to the clipboard.',
  component: VariableGuide,
});
