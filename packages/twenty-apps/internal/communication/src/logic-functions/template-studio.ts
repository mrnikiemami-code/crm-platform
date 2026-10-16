import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { TEMPLATE_STUDIO_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  TEMPLATE_CATALOG_STATUS,
  TEMPLATE_STUDIO_ERROR_CODE,
  TEMPLATE_TARGET_OBJECT,
} from 'src/studio/template-studio-contract';
import { buildAuthorizedTemplateCatalog } from 'src/templates/build-template-catalog';
import {
  findEligibleTemplateSources,
  PERSON_SOURCE_OBJECT_NAME,
  resolveEligibleSource,
  resolveStoredTemplateSource,
} from 'src/templates/data/find-eligible-template-sources';
import { findStudioPeople } from 'src/templates/data/find-studio-people';
import {
  readMessageTemplate,
  saveMessageTemplateConditionally,
} from 'src/templates/data/mutate-message-templates';
import {
  readSourceRecordRelation,
  searchSourceRecords,
} from 'src/templates/data/read-source-record-relation';
import { previewTemplate } from 'src/templates/preview-template.service';
import { listTemplateVariableGroups } from 'src/templates/template-variable-catalog';

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
  /** Record-page editor: stable UID of the chosen source object. */
  sourceObjectUid?: unknown;
  /** Record-page editor: stable UID of the relation that resolves to one Person. */
  recipientRelationUid?: unknown;
  /** Legacy readable hints, accepted but never treated as identity. */
  sourceObjectName?: unknown;
  recipientRelation?: unknown;
  /** Preview: the SAMPLE RECORD of the source object (never a Person directly). */
  sampleRecordId?: unknown;
  /** Preview: the source object's `nameSingular`, checked against the stored one. */
  sampleObjectName?: unknown;
  /** Record-page editor: the `updatedAt` the caller loaded, for the CAS. */
  expectedUpdatedAt?: unknown;
};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const readTrimmed = (value: unknown): string => readString(value).trim();

const fail = (errorCode: string) => ({ success: false as const, errorCode });

/**
 * Actions that touch a record or the authorized catalog. Every one of them
 * requires an authenticated USER.
 *
 * Why this is enforced here, before anything else: a front component reaches an
 * app route with the APPLICATION token
 * (`setWorkerEnvironmentVariablesFromRenderContext` injects only
 * `TWENTY_APP_ACCESS_TOKEN`, and the front app's token pair contains only
 * application tokens), so a route invoked from the component has no user
 * identity. The platform resolves the requesting user itself and hands the route
 * `event.userWorkspaceId` — a value the CLIENT cannot set, which is exactly why
 * that field is what gets checked and no body field ever is.
 *
 * The consequence is deliberate: without a user identity these actions fail
 * closed with `AUTH_REQUIRED` instead of quietly running as the application.
 * There is NO fallback to app access, and no test-only bypass.
 */
const USER_SCOPED_ACTIONS = new Set([
  'list',
  'catalog',
  'search-people',
  'eligible-sources',
  'source-records',
  'read-template',
  'save-template',
  'preview',
  'create',
  'update',
  'delete',
]);

/** True when the platform authenticated a USER for this request. */
const hasAuthenticatedUser = (event: RoutePayload<StudioRequest>): boolean =>
  typeof event.userWorkspaceId === 'string' &&
  event.userWorkspaceId.length > 0;

const handler = async (event: RoutePayload<StudioRequest>) => {
  const body = event.body;

  if (body === null || typeof body !== 'object') {
    return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
  }

  const action = readString(body.action);

  // The authorization boundary comes FIRST, before any read, write, catalog
  // build or sample lookup. A request without a user identity never reaches data.
  if (USER_SCOPED_ACTIONS.has(action) && !hasAuthenticatedUser(event)) {
    return {
      success: false as const,
      errorCode: TEMPLATE_STUDIO_ERROR_CODE.AUTH_REQUIRED,
      // A stable, application-owned message the UI renders as-is.
      message:
        'برای این عملیات باید با حساب کاربری خود وارد شده باشید. دسترسی برنامه کافی نیست.',
    };
  }

  const client = new CoreApiClient();

  if (action === 'catalog') {
    // The authorized variable catalog for the editor's variable list.
    //
    // The catalog belongs to the template's SOURCE. The source object is resolved
    // HERE, server-side, from identifiers — never taken as a raw object name from
    // the client — so selecting a source can only ever yield that source's own
    // fields, and an unresolvable source is reported instead of falling back to
    // Person.
    //
    // It is built from the workspace's own metadata and the caller's authorized
    // read. A failure is reported as an explicit status so the editor can offer a
    // retry instead of showing an empty list as if the workspace had no fields.
    try {
      const metadataClient = new MetadataApiClient();
      const sources = await findEligibleTemplateSources({ metadataClient });

      // A source CHANGE in the editor sends the newly selected object; opening an
      // existing template sends its id instead, so the STORED identifiers are
      // used and the editor does not have to re-select the source to see fields.
      // Either way the value is validated against the eligible set first.
      const requestedObjectUid = readTrimmed(body.sourceObjectUid);
      const catalogTemplateId = readTrimmed(body.templateId);

      if (requestedObjectUid.length === 0 && catalogTemplateId.length === 0) {
        // Nothing to resolve a source from. Refusing is the point: guessing
        // Person here is exactly the fallback this task removes.
        return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
      }

      let storedObjectUid = requestedObjectUid;
      let storedRelationUid = readTrimmed(body.recipientRelationUid);

      if (requestedObjectUid.length === 0) {
        const stored = await readMessageTemplate({
          client,
          id: catalogTemplateId,
        });

        if (stored === null) {
          return fail(TEMPLATE_STUDIO_ERROR_CODE.NOT_FOUND);
        }

        storedObjectUid = stored.sourceObjectUid;
        storedRelationUid = stored.recipientRelationUid;
      }

      const resolvedSource = resolveStoredTemplateSource({
        sources,
        storedObjectUid,
        storedRelationUid,
      });

      if (resolvedSource.kind === 'UNRESOLVABLE') {
        // The identifier is present but no longer resolves. This is NEVER
        // reinterpreted as Person: the editor is told the source is unusable.
        return {
          success: false as const,
          errorCode: TEMPLATE_STUDIO_ERROR_CODE.CONTEXT_MISMATCH,
          catalogStatus: TEMPLATE_CATALOG_STATUS.UNAVAILABLE,
          catalogStage: 'SOURCE_UNKNOWN',
          message:
            'منبع این الگو در دسترس نیست یا تغییر کرده است. یک منبع دیگر انتخاب کنید.',
        };
      }

      const { catalog, isAvailable, stage, sourceLabelPlural } =
        await buildAuthorizedTemplateCatalog({
      client,
          metadataClient,
          source: { objectName: resolvedSource.objectName },
          relationUid:
            resolvedSource.kind === 'RESOLVED'
              ? resolvedSource.relationUid
              : '',
          userRoleId: event.userWorkspaceId ?? null,
        });

      return {
        success: true as const,
        sourceObjectName: resolvedSource.objectName,
        catalogStatus: isAvailable
          ? TEMPLATE_CATALOG_STATUS.READY
          : TEMPLATE_CATALOG_STATUS.UNAVAILABLE,
        catalogStage: stage,
        variables: catalog.variables.map((variable) => ({
          token: `@${variable.token}`,
          label: variable.label,
        })),
        // Titled groups: the source group carries the source OBJECT's own label
        // («فرصت‌ها» / «اشخاص»), the recipient and company groups app-owned
        // strings. Both come from the server, so the heading cannot be spoofed.
        groups: listTemplateVariableGroups(catalog, sourceLabelPlural),
      };
    } catch {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED);
    }
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

  if (action === 'source-records') {
    // The sample picker for a RELATED source: records of the template's own
    // source object, so the user chooses the record the preview resolves from.
    const objectUid = readTrimmed(body.sourceObjectUid);

    if (objectUid.length === 0) {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
    }

    try {
      const sources = await findEligibleTemplateSources({
        metadataClient: new MetadataApiClient(),
      });

      const source = sources.find((entry) => entry.objectUid === objectUid);

      if (source === undefined) {
        return fail(TEMPLATE_STUDIO_ERROR_CODE.CONTEXT_MISMATCH);
      }

      return {
        success: true as const,
        records: await searchSourceRecords({
          client,
          source,
          search: readTrimmed(body.search),
        }),
      };
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

  if (action === 'save-template') {
    // ONE conditional write for the body AND the source identifiers, so a
    // source change and a text change can never be persisted half-applied.
    //
    // The pair is validated against the workspace's eligible set first, so a
    // forged or stale value is rejected instead of stored, and the write itself is
    // a real compare-and-set: an empty result means another session saved first,
    // reported as CONFLICT so the caller keeps the user's text.
    const templateId = readTrimmed(body.templateId);
    const messageBody = readString(body.body);
    const requestedObjectUid = readTrimmed(body.sourceObjectUid);

    if (templateId.length === 0 || requestedObjectUid.length === 0) {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
    }

    try {
      const sources = await findEligibleTemplateSources({
        metadataClient: new MetadataApiClient(),
      });

      const resolved = resolveEligibleSource({
        sources,
        objectUid: requestedObjectUid,
        relationUid: readTrimmed(body.recipientRelationUid),
      });

      if (resolved === null) {
        // The requested source is not eligible (unknown, inactive, or a
        // collection). Refusing to store it is the point.
        return fail(TEMPLATE_STUDIO_ERROR_CODE.CONTEXT_MISMATCH);
      }

      const source = sources.find(
        (entry) => entry.objectUid === resolved.objectUid,
      );
      const relation = source?.relations.find(
        (entry) => entry.relationUid === resolved.relationUid,
      );

      const outcome = await saveMessageTemplateConditionally({
        client,
        id: templateId,
        // A title, when provided, is written with the body so the list shows the
        // name the user typed. The route rejects an empty one before this point.
        title: readTrimmed(body.title).length > 0 ? readTrimmed(body.title) : null,
        body: messageBody,
        sourceObjectUid: resolved.objectUid,
        recipientRelationUid: resolved.relationUid,
        // The legacy marker is always PERSON: it is what the list's «موجودیت منبع»
        // column renders, and the real source lives in the stable pair.
        targetObject: TEMPLATE_TARGET_OBJECT.PERSON,
        expectedUpdatedAt:
          typeof body.expectedUpdatedAt === 'string' &&
          body.expectedUpdatedAt.length > 0
            ? body.expectedUpdatedAt
            : null,
      });

      if (outcome.kind === 'CONFLICT') {
        return {
          success: false as const,
          errorCode: TEMPLATE_STUDIO_ERROR_CODE.CONFLICT,
          isConflict: true,
          message:
            'این الگو پس از بارگذاری شما تغییر کرده است. متن شما حفظ شده است؛ صفحه را تازه کنید.',
        };
      }

      // Readable hints, resolved from metadata — never treated as identity.
      return {
        success: true as const,
        template: {
          ...outcome.template,
          sourceObjectName: source?.objectName ?? '',
          recipientRelation: relation?.relationName ?? '',
        },
      };
    } catch {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.WRITE_FAILED);
    }
  }

  if (action === 'preview') {
    // The preview takes a SAMPLE RECORD of the template's own source object, not
    // a Person. The recipient is resolved from that record through the template's
    // STORED relation, so a client-chosen Person can never stand in for the
    // relation's real value.
    //
    // It also re-derives the whole context server-side: the template's stored
    // source is re-resolved against live metadata, which is what makes a renamed,
    // deactivated, removed or collection relation a hard TEMPLATE_CONTEXT_MISMATCH
    // instead of a silent fallback.
    const templateId = readTrimmed(body.templateId);
    const sampleRecordId = readTrimmed(body.sampleRecordId);
    const messageBody = readString(body.body);

    if (
      templateId.length === 0 ||
      sampleRecordId.length === 0 ||
      messageBody.trim().length === 0
    ) {
      return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
    }

    try {
      const stored = await readMessageTemplate({ client, id: templateId });

      if (stored === null) {
        return fail(TEMPLATE_STUDIO_ERROR_CODE.NOT_FOUND);
      }

      const sources = await findEligibleTemplateSources({
        metadataClient: new MetadataApiClient(),
      });

      // The preview validates the CURRENT FORM CONTEXT, not the previously
      // SAVED one. A source the user changed in the editor but has not saved yet
      // must preview against what the form now shows — otherwise the sample
      // record the picker just offered (from the form's source) is judged against
      // the old stored source and rejected, forcing a save/reload just to look at
      // a preview. The requested pair is validated against the eligible set
      // first, so a forged or stale value is refused rather than previewed.
      const requestedObjectUid = readTrimmed(body.sourceObjectUid);
      const requestedRelationUid = readTrimmed(body.recipientRelationUid);

      let effectiveObjectUid = stored.sourceObjectUid;
      let effectiveRelationUid = stored.recipientRelationUid;

      if (requestedObjectUid.length > 0) {
        const eligible = resolveEligibleSource({
          sources,
          objectUid: requestedObjectUid,
          relationUid: requestedRelationUid,
        });

        if (eligible === null) {
          return {
            success: false as const,
            errorCode: TEMPLATE_STUDIO_ERROR_CODE.CONTEXT_MISMATCH,
            message:
              'منبع انتخاب‌شده برای پیش‌نمایش در دسترس نیست. یک منبع دیگر انتخاب کنید.',
          };
        }

        effectiveObjectUid = eligible.objectUid;
        effectiveRelationUid = eligible.relationUid;
      }

      const resolvedSource = resolveStoredTemplateSource({
        sources,
        storedObjectUid: effectiveObjectUid,
        storedRelationUid: effectiveRelationUid,
      });

      if (resolvedSource.kind === 'UNRESOLVABLE') {
        // An identifier that no longer resolves is NEVER reinterpreted as Person.
        return {
          success: false as const,
          errorCode: TEMPLATE_STUDIO_ERROR_CODE.CONTEXT_MISMATCH,
          message:
            'منبع این الگو در دسترس نیست یا تغییر کرده است. تعریف الگو را بازبینی کنید.',
        };
      }

      // The sample record must belong to the declared source object.
      const sourceObjectName =
        resolvedSource.kind === 'RESOLVED'
          ? resolvedSource.objectName
          : PERSON_SOURCE_OBJECT_NAME;

      if (readTrimmed(body.sampleObjectName) !== sourceObjectName) {
        return {
          success: false as const,
          errorCode: TEMPLATE_STUDIO_ERROR_CODE.CONTEXT_MISMATCH,
          message:
            'رکورد نمونه با منبع این الگو هم‌خوان نیست. الگو را بازبینی کنید.',
        };
      }

      let recipientPersonId: string | null = null;

      if (resolvedSource.kind === 'LEGACY_PERSON') {
        // A legacy template has no source: the sample record IS the Person.
        recipientPersonId = sampleRecordId;
      } else if (resolvedSource.relationName.length === 0) {
        recipientPersonId = sampleRecordId;
      } else {
        // Read the source record and follow its stored relation to the Person.
        const related = await readSourceRecordRelation({
          client,
          objectName: resolvedSource.objectName,
          relationName: resolvedSource.relationName,
          recordId: sampleRecordId,
        });

        if (related.kind === 'NOT_FOUND') {
          return fail(TEMPLATE_STUDIO_ERROR_CODE.NOT_FOUND);
        }

        if (related.kind === 'RELATION_EMPTY') {
          return {
            success: false as const,
            errorCode: TEMPLATE_STUDIO_ERROR_CODE.RELATION_EMPTY,
            message:
              'رکورد انتخاب‌شده به هیچ شخصی متصل نیست؛ گیرنده‌ای برای پیش‌نمایش وجود ندارد.',
          };
        }

        recipientPersonId = related.personId;
      }

      // The catalog AND the values are built for THIS template's resolved source,
      // so a preview can neither accept a token the source does not define nor
      // resolve `@source.*` from a different source than the form shows. The
      // sample record is passed as the source record, so `@source.*` reads IT.
      const { catalog, isAvailable } = await buildAuthorizedTemplateCatalog({
      client,
        metadataClient: new MetadataApiClient(),
        source: { objectName: sourceObjectName },
        relationUid:
          resolvedSource.kind === 'RESOLVED'
            ? resolvedSource.relationUid
            : '',
        userRoleId: event.userWorkspaceId ?? null,
      });

      if (!isAvailable) {
        return {
          success: false as const,
          errorCode: TEMPLATE_STUDIO_ERROR_CODE.UNEXPECTED,
          catalogStatus: TEMPLATE_CATALOG_STATUS.UNAVAILABLE,
        };
      }

      const preview = await previewTemplate({
        client,
        metadataClient: new MetadataApiClient(),
        body: messageBody,
        personIds: [recipientPersonId],
        phoneOverrides: {},
        catalog,
        sourceRecord:
          sourceObjectName === PERSON_SOURCE_OBJECT_NAME
            ? null
            : { objectName: sourceObjectName, recordId: sampleRecordId },
      });

      if (!preview.success) {
        return fail(TEMPLATE_STUDIO_ERROR_CODE.INVALID_INPUT);
      }

      // Only the preview fields the editor renders are returned; the preview
      // service's own `error` string is never forwarded, and nothing is written —
      // the sample record is NOT stored on the template.
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

  // The old studio's own create/update/delete actions were removed with it: the
  // platform's native list and record page now own template CRUD, so keeping a
  // second write path here would be a parallel, unaudited route to the same
  // records. Only the editor's own guarded actions remain.
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
