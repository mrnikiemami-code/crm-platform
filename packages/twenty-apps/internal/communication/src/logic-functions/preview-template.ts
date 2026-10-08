import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { normalizePersonIds } from 'src/bulk/list-bulk-recipients.service';
import { PREVIEW_TEMPLATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  previewTemplate,
  readPhoneOverrides,
} from 'src/templates/preview-template.service';

// READ-ONLY. The server is the sole authority for recipient access and template
// evaluation: it re-reads the authorized Person records (never trusting the
// frontend for names or values) and returns the per-recipient preview text with
// explicit unresolved-variable flags. Nothing here sends a message.
type PreviewTemplateRequest = {
  body?: unknown;
  personIds?: unknown;
  /** Optional per-recipient phone overrides, keyed by personId. */
  phoneOverrides?: unknown;
};

const handler = async (event: RoutePayload<PreviewTemplateRequest>) => {
  const requestBody = event.body;

  if (requestBody === null || typeof requestBody !== 'object') {
    return { success: false, error: 'A JSON body is required.' };
  }

  const personIds = normalizePersonIds(requestBody.personIds);

  if (personIds === null) {
    return { success: false, error: '`personIds` must be an array.' };
  }

  return previewTemplate({
    client: new CoreApiClient(),
    body: typeof requestBody.body === 'string' ? requestBody.body : '',
    personIds,
    phoneOverrides: readPhoneOverrides(requestBody.phoneOverrides),
  });
};

export default defineLogicFunction({
  universalIdentifier: PREVIEW_TEMPLATE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'communication-preview-template',
  description:
    'Builds the per-recipient template preview from authorized Person data (read-only).',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/communication/preview-template',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
