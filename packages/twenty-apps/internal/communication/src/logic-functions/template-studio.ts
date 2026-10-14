import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { TEMPLATE_STUDIO_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  isTemplateTargetObject,
  TEMPLATE_CATALOG_STATUS,
  TEMPLATE_STUDIO_ERROR_CODE,
  TEMPLATE_TARGET_OBJECT,
} from 'src/studio/template-studio-contract';
import { type StudioField } from 'src/studio/template-studio-logic';
import { buildAuthorizedTemplateCatalog } from 'src/templates/build-template-catalog';
import {
  findEligibleTemplateSources,
  resolveEligibleSource,
} from 'src/templates/data/find-eligible-template-sources';
import { findMessageTemplates } from 'src/templates/data/find-message-templates';
import { findStudioPeople } from 'src/templates/data/find-studio-people';
import {
  createMessageTemplate,
  deleteMessageTemplate,
  readMessageTemplate,
  saveMessageTemplateBody,
  updateMessageTemplate,
  updateMessageTemplateSource,
} from 'src/templates/data/mutate-message-templates';
import { previewTemplate } from 'src/templates/preview-template.service';

// The SMS Template Studio's server side. It works on the workspace's NATIVE
// `messageTemplate` object through the workspace-scoped `CoreApiClient`, so the
// template model, its permissions and its workspace isolation are the
// platform's own — there is no second table and no out-of-band write.
//
// Every failure is reported with a STABLE application-owned code. No
// `error.message`, stack trace, URL, SDK string or credential is ever returned:
// the frontend renders its own translated Persian copy for the code.
//
// The authorized FIELD list is always built server-side. A client-supplied
// catalog is never trusted, and a catalog that cannot be authorized is returned
// as UNAVAILABLE with zero fields (fail closed).

type StudioRequest = {
  action?: unknown;
  templateId?: unknown;
  personId?: unknown;
  title?: unknown;
  body?: unknown;
  targetObject?: unknown;
  /** Sample-Person picker: free-text name/phone search. */
  search?: unknown;
  /** Sample-Person picker: opaque cursor of the last page. */
  after?: unknown;
  limit?: unknown;
  /** Record-page editor: the chosen source object's `nameSingular`. */
  sourceObjectName?: unknown;
  /** Record-page editor: the relation field that resolves to one Person. */
  recipientRelation?: unknown;
  /** Record-page editor: the `updatedAt` the caller loaded, for conflict detection. */
  expectedUpdatedAt?: unknown;
};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const readTrimmed = (value: unknown): string => readString(value).trim();

const fail = (errorCode: string) => ({ success: false as const, errorCode });

const handler = async (event: RoutePayload<StudioRequest>) => {
  const body = event.body;

  if (body === null || typeof body !== 'object') {
    return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
  }

  const client = new CoreApiClient();

  // A catalog failure is never an exception here: it yields an EMPTY field list
  // plus UNAVAILABLE, so the studio can tell "no usable fields" apart from "the
  // authorized list could not be built" without learning why.
  const loadCatalog = async (): Promise<{
    fields: StudioField[];
    catalogStatus: string;
    catalogStage: string;
  }> => {
    const { catalog, isAvailable, stage } = await buildAuthorizedTemplateCatalog(
      { metadataClient: new MetadataApiClient(), client },
    );

    return {
      fields: catalog.variables.map((variable) => ({
        token: `@${variable.token}`,
        label: variable.label,
        group: variable.objectName === 'company' ? 'COMPANY' : 'PERSON',
      })),
      catalogStatus: isAvailable
        ? TEMPLATE_CATALOG_STATUS.READY
        : TEMPLATE_CATALOG_STATUS.UNAVAILABLE,
      // A stable application-owned marker: never exception text.
      catalogStage: stage,
    };
  };

  const action = readString(body.action);

  if (action === 'list') {
    const { fields, catalogStatus, catalogStage } = await loadCatalog();

    return {
      success: true as const,
      templates: await findMessageTemplates({ client }),
      fields,
      catalogStatus,
      catalogStage,
    };
  }

  if (action === 'search-people') {
    try {
      // One PAGE at a time, plus the cursor for the next one. The picker appends
      // pages as the user scrolls, so a workspace with ~100k People is never
      // loaded in one request.
      const page = await findStudioPeople({
        client,
        search: readTrimmed(body.search),
        after:
          typeof body.after === 'string' && body.after.length > 0
            ? body.after
            : null,
        limit:
          typeof body.limit === 'number' && Number.isFinite(body.limit)
            ? body.limit
            : undefined,
      });

      return {
        success: true as const,
        people: page.people,
        hasMore: page.pageInfo.hasMore,
        endCursor: page.pageInfo.endCursor,
      };
    } catch {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED);
    }
  }

  if (action === 'eligible-sources') {
    try {
      const sources = await findEligibleTemplateSources({
        metadataClient: new MetadataApiClient(),
      });

      // An empty list is reported as such: it means the workspace metadata gave
      // no eligible source (or Person itself is unreadable), never a guess.
      return { success: true as const, sources };
    } catch {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED);
    }
  }

  if (action === 'read-template') {
    // The RECORD-PAGE editor reads exactly one template — the one the user is
    // already viewing, whose id the component takes from `useRecordId()`. The
    // route never lists templates here, so it cannot be used to enumerate.
    const templateId = readTrimmed(body.templateId);

    if (templateId.length === 0) {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
    }

    try {
      const template = await readMessageTemplate({ client, id: templateId });

      return template === null
        ? fail(TEMPLATE_STUDIO_ERROR_CODE.NOT_FOUND)
        : { success: true as const, template };
    } catch {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED);
    }
  }

  if (action === 'save-body') {
    // Saves the BODY only, scoped to the `updatedAt` the caller loaded: a
    // concurrent change matches no row and is reported as a conflict instead of
    // being silently overwritten.
    const templateId = readTrimmed(body.templateId);
    const messageBody = readString(body.body);

    if (templateId.length === 0) {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
    }

    try {
      const template = await saveMessageTemplateBody({
        client,
        id: templateId,
        body: messageBody,
        expectedUpdatedAt:
          typeof body.expectedUpdatedAt === 'string' &&
          body.expectedUpdatedAt.length > 0
            ? body.expectedUpdatedAt
            : null,
      });

      if (template === null) {
        // Either the row is gone, or `updatedAt` moved under us. Both are a
        // conflict from the caller's point of view.
        return {
          success: false as const,
          errorCode: TEMPLATE_STUDIO_ERROR_CODE.WRITE_FAILED,
          isConflict: true,
        };
      }

      return { success: true as const, template };
    } catch {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.WRITE_FAILED);
    }
  }

  if (action === 'save-source') {
    // Saves the SOURCE model, validated against the workspace's eligible set so
    // a forged or stale pair is rejected rather than stored.
    const templateId = readTrimmed(body.templateId);
    const requestedObject = readTrimmed(body.sourceObjectName);

    if (templateId.length === 0 || requestedObject.length === 0) {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
    }

    try {
      const sources = await findEligibleTemplateSources({
        metadataClient: new MetadataApiClient(),
      });

      const resolved = resolveEligibleSource({
        sources,
        objectName: requestedObject,
        relationName: readTrimmed(body.recipientRelation),
      });

      if (resolved === null) {
        return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
      }

      const template = await updateMessageTemplateSource({
        client,
        id: templateId,
        sourceObjectName: resolved.objectName,
        recipientRelation: resolved.relationName,
        // The legacy marker stays PERSON whenever the source is Person, so the
        // list's «موجودیت منبع» column keeps working for those rows.
        targetObject:
          // The legacy marker is always PERSON: it is the value the list's
          // «موجودیت منبع» column renders, and the real source lives in the
          // stable `sourceObjectName` / `recipientRelation` pair.
          TEMPLATE_TARGET_OBJECT.PERSON,
      });

      return template === null
        ? fail(TEMPLATE_STUDIO_ERROR_CODE.NOT_FOUND)
        : { success: true as const, template };
    } catch {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.WRITE_FAILED);
    }
  }

  if (action === 'preview') {
    const personId = readTrimmed(body.personId);
    const messageBody = readString(body.body);

    if (personId.length === 0 || messageBody.trim().length === 0) {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
    }

    // Reuses the EXISTING production preview service: it re-reads the Person and
    // the authorized field values server-side and evaluates the SAME catalog.
    // This action writes NOTHING — no Communication, no timeline activity and no
    // change to the template.
    const { isAvailable } = await buildAuthorizedTemplateCatalog({
      metadataClient: new MetadataApiClient(),
      client,
    });

    if (!isAvailable) {
      return {
        success: false as const,
        errorCode: TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED,
        catalogStatus: TEMPLATE_CATALOG_STATUS.UNAVAILABLE,
      };
    }

    try {
      const preview = await previewTemplate({
        client,
        metadataClient: new MetadataApiClient(),
        body: messageBody,
        personIds: [personId],
        phoneOverrides: {},
      });

      if (!preview.success) {
        return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
      }

      // Only the preview fields the studio renders are returned; the preview
      // service's own `error` string is never forwarded verbatim, and nothing is
      // written.
      return {
        success: true as const,
        previews: preview.previews,
        hasUnresolvedVariables: preview.hasUnresolvedVariables,
        isBodyEmpty: preview.isBodyEmpty,
        readyCount: preview.readyCount,
      };
    } catch {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED);
    }
  }

  if (action === 'create') {
    const title = readTrimmed(body.title);
    const messageBody = readString(body.body);
    const targetObject = isTemplateTargetObject(body.targetObject)
      ? body.targetObject
      : TEMPLATE_TARGET_OBJECT.PERSON;

    if (title.length === 0 || messageBody.trim().length === 0) {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
    }

    try {
      const template = await createMessageTemplate({
        client,
        input: { title, body: messageBody, targetObject },
      });

      return template === null
        ? fail(TEMPLATE_STUDIO_ERROR_CODE.WRITE_FAILED)
        : { success: true as const, template };
    } catch {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.WRITE_FAILED);
    }
  }

  if (action === 'update') {
    const templateId = readTrimmed(body.templateId);
    const title = readTrimmed(body.title);
    const messageBody = readString(body.body);
    const targetObject = isTemplateTargetObject(body.targetObject)
      ? body.targetObject
      : TEMPLATE_TARGET_OBJECT.PERSON;

    if (
      templateId.length === 0 ||
      title.length === 0 ||
      messageBody.trim().length === 0
    ) {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
    }

    try {
      const template = await updateMessageTemplate({
        client,
        id: templateId,
        input: { title, body: messageBody, targetObject },
      });

      return template === null
        ? fail(TEMPLATE_STUDIO_ERROR_CODE.NOT_FOUND)
        : { success: true as const, template };
    } catch {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.WRITE_FAILED);
    }
  }

  if (action === 'delete') {
    const templateId = readTrimmed(body.templateId);

    if (templateId.length === 0) {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
    }

    try {
      const deletedId = await deleteMessageTemplate({
        client,
        id: templateId,
      });

      return deletedId === null
        ? fail(TEMPLATE_STUDIO_ERROR_CODE.NOT_FOUND)
        : { success: true as const, deletedId };
    } catch {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.WRITE_FAILED);
    }
  }

  return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
};

export default defineLogicFunction({
  universalIdentifier: TEMPLATE_STUDIO_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'communication-template-studio',
  description:
    'Lists, creates, updates and deletes this workspace message templates and returns the authorized field catalog.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/communication/template-studio',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
