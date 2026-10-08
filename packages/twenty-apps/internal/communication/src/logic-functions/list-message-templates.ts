import { defineLogicFunction } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { LIST_MESSAGE_TEMPLATES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { findMessageTemplates } from 'src/templates/data/find-message-templates';
import { listTemplateVariables } from 'src/templates/template-variable-catalog';

// READ-ONLY. Returns this workspace's templates and the authorized variable
// catalog for the composer's picker. Templates are read through the workspace
// API client, so a caller only ever sees its own workspace's templates.
const handler = async () => {
  const templates = await findMessageTemplates({
    client: new CoreApiClient(),
  });

  return {
    success: true,
    templates,
    variables: listTemplateVariables(),
  };
};

export default defineLogicFunction({
  universalIdentifier:
    LIST_MESSAGE_TEMPLATES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'communication-list-message-templates',
  description:
    'Lists this workspace message templates and the variable catalog (read-only).',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/communication/message-templates',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
