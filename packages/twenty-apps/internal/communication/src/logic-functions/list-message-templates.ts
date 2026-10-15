import { defineLogicFunction } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { LIST_MESSAGE_TEMPLATES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { TEMPLATE_CATALOG_STATUS } from 'src/studio/template-studio-contract';
import { buildAuthorizedTemplateCatalog } from 'src/templates/build-template-catalog';
import { PERSON_SOURCE_OBJECT_NAME } from 'src/templates/data/find-eligible-template-sources';
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
  const { catalog, isAvailable } = await buildAuthorizedTemplateCatalog({
    metadataClient: new MetadataApiClient(),
    client: new CoreApiClient(),
    // The template PICKER is Person-scoped: it feeds the single/bulk send flow,
    // whose recipients are People. It therefore builds the Person catalog, which
    // is the same one those sends resolve against.
    source: { objectName: PERSON_SOURCE_OBJECT_NAME },
  });

  // The catalog is EMPTY whenever it could not be authorized. The status tells
  // the picker the difference between "this workspace has no usable fields" and
  // "the authorized field list is unavailable" WITHOUT leaking why.
  const catalogStatus = isAvailable
    ? TEMPLATE_CATALOG_STATUS.READY
    : TEMPLATE_CATALOG_STATUS.UNAVAILABLE;

  const templates = await findMessageTemplates({
    client: new CoreApiClient(),
  });

  return {
    success: true,
    templates,
    variables: listTemplateVariables(catalog),
    catalogStatus,
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
