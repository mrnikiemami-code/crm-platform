import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { LIST_MESSAGE_TEMPLATES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { TEMPLATE_CATALOG_STATUS } from 'src/studio/template-studio-contract';
import { buildAuthorizedTemplateCatalog } from 'src/templates/build-template-catalog';
import {
  findEligibleTemplateSources,
  PERSON_SOURCE_OBJECT_NAME,
  resolveStoredTemplateSource,
} from 'src/templates/data/find-eligible-template-sources';
import { findMessageTemplates } from 'src/templates/data/find-message-templates';
import { filterTemplatesForSource } from 'src/templates/filter-templates-for-source';
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
// The list is SOURCE-SCOPED when the caller says which source it is composing
// for. Without that the picker offered every template in the workspace, including
// ones written for another object whose `@source.*` tokens cannot resolve in the
// current context — a choice that could only fail later.
//
// Templates are read through the workspace API client, so a caller only ever
// sees its own workspace's templates.
type ListMessageTemplatesRequest = {
  /**
   * The stable `universalIdentifier` of the object being composed for. Optional:
   * when it is absent the caller gets the Person-scoped view, which is what the
   * single/bulk Person composers and the template Variables page need.
   */
  sourceObjectUid?: unknown;
};

const handler = async (
  event: RoutePayload<ListMessageTemplatesRequest>,
) => {
  const requestBody = event.body;
  const requestedSourceUid =
    requestBody !== null &&
    typeof requestBody === 'object' &&
    typeof requestBody.sourceObjectUid === 'string'
      ? requestBody.sourceObjectUid.trim()
      : '';

  const metadataClient = new MetadataApiClient();
  const client = new CoreApiClient();

  const sources = await findEligibleTemplateSources({ metadataClient });

  // Resolve the requested source, or fall back to Person for a caller that did
  // not name one (the existing Person-scoped consumers). An identifier that is
  // present but does NOT resolve is a hard refusal, never a Person fallback.
  const resolvedSource =
    requestedSourceUid.length === 0
      ? {
          kind: 'RESOLVED' as const,
          objectName: PERSON_SOURCE_OBJECT_NAME,
          objectUid:
            sources.find(
              (entry) => entry.objectName === PERSON_SOURCE_OBJECT_NAME,
            )?.objectUid ?? '',
        }
      : resolveStoredTemplateSource({
          sources,
          storedObjectUid: requestedSourceUid,
          storedRelationUid: '',
        });

  if (resolvedSource.kind === 'UNRESOLVABLE') {
    return {
      success: true,
      templates: [],
      variables: [],
      catalogStatus: TEMPLATE_CATALOG_STATUS.UNAVAILABLE,
      catalogStage: 'SOURCE_UNKNOWN',
      sourceObjectName: '',
    };
  }

  const { catalog, isAvailable, stage } = await buildAuthorizedTemplateCatalog({
    metadataClient,
    source: { objectName: resolvedSource.objectName },
    userRoleId: event.userWorkspaceId ?? null,
  });

  // The catalog is EMPTY whenever it could not be authorized. The status tells
  // the picker the difference between "this workspace has no usable fields" and
  // "the authorized field list is unavailable" WITHOUT leaking why.
  const catalogStatus = isAvailable
    ? TEMPLATE_CATALOG_STATUS.READY
    : TEMPLATE_CATALOG_STATUS.UNAVAILABLE;

  const templates = filterTemplatesForSource({
    templates: await findMessageTemplates({ client }),
    sources,
    // Non-null here: the legacy branch resolved Person, whose identifier exists
    // because `findEligibleTemplateSources` only returns sources it could resolve.
    sourceObjectUid: resolvedSource.objectUid ?? '',
  });

  return {
    success: true,
    templates,
    variables: listTemplateVariables(catalog),
    catalogStatus,
    catalogStage: stage,
    sourceObjectName: resolvedSource.objectName,
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
