import { useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  copyToClipboard,
  enqueueSnackbar,
  useLocale,
  useTranslate,
} from 'twenty-sdk/front-component';

import { composerStyles as styles, getTextDirection } from 'src/components/composer-shared';
import { MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { listTemplateVariables } from 'src/templates/template-variable-catalog';

// The «متغیرهای قابل استفاده» guide shown on the template record page.
//
// The variable documentation lives HERE, in template management — not in the
// send composer, which is only for choosing a template and sending.
//
// The list is `listTemplateVariables()`: the SAME catalog the server-side
// preview evaluator reads, imported directly (it is isomorphic, pure data), so
// the manager can never advertise a token the evaluator would reject. There is
// no second, test-only list.
//
// Boundary (stated honestly): the body is a NATIVE field rendered by the host,
// and the front-component sandbox exposes no API to write into that field's
// caret. So a click COPIES the token to the clipboard and confirms it in
// Persian — it does NOT fake an insertion into the editor.
const VariableGuide = () => {
  const { t } = useTranslate();
  const locale = useLocale();
  const direction = getTextDirection(locale);

  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const variables = listTemplateVariables();

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

      <ul style={styles.recipientList}>
        {variables.map((variable) => (
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
                {copiedToken === variable.token
                  ? t('Copied')
                  : t('Copy')}
              </button>
            </div>
            <span style={styles.muted}>{t(variable.label)}</span>
          </li>
        ))}
      </ul>

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
    'Lists the authorized template variables and copies a token to the clipboard.',
  component: VariableGuide,
});
