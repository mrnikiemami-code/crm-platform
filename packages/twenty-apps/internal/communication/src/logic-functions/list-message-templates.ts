import { defineLogicFunction } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { LIST_MESSAGE_TEMPLATES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { buildAuthorizedTemplateCatalog } from 'src/templates/build-template-catalog';
import { findMessageTemplates } from 'src/templates/data/find-message-templates';
import { listTemplateVariables } from 'src/templates/template-variable-catalog';

// READ-ONLY. Returns this workspace's templates and the AUTHORIZED variable
// catalog for the composer's picker and the template Variables page.
//
// The catalog is built at runtime from the workspace's own object/field
// metadata and the app role's permissions, so it lists exactly the fields this
// workspace may use — including custom fields — and nothing else. The same
// builder is used by preview and by both send paths, so the manager can never
// advertise a token the evaluator would reject.
//
// Templates are read through the workspace API client, so a caller only ever
// sees its own workspace's templates.
const handler = async () => {
  let catalog;

  try {
    catalog = await buildAuthorizedTemplateCatalog({
      metadataClient: new MetadataApiClient(),
    });
  } catch (error) {
    // The templates list itself is still useful, so report the catalog problem
    // explicitly rather than failing the whole route. The message is the app's
    // own metadata-read failure and is shown so the cause is never hidden.
    console.warn(
      '[communication] template variable catalog unavailable',
      JSON.stringify({
        reason: error instanceof Error ? error.message : 'unknown',
      }),
    );

    return {
      success: true,
      templates: await findMessageTemplates({ client: new CoreApiClient() }),
      variables: [],
      catalogError:
        error instanceof Error
          ? error.message
          : 'The variable catalog could not be built.',
    };
  }

  const templates = await findMessageTemplates({
    client: new CoreApiClient(),
  });

  return {
    success: true,
    templates,
    variables: listTemplateVariables(catalog),
  };
};

export default defineLogicFunction({
  universalIdentifier:
    LIST_MESSAGE_TEMPLATES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'communication-list-message-templates',
  description:
    'Lists this workspace message templates and the authorized runtime variable catalog (read-only).',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/communication/message-templates',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
