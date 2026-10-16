import { type CoreApiClient } from 'twenty-client-sdk/core';
import { type MetadataApiClient } from 'twenty-client-sdk/metadata';

import { findPersonsForBulk } from 'src/bulk/find-bulk-persons';
import { MAX_BULK_PERSON_IDS } from 'src/bulk/list-bulk-recipients.service';
import {
  applyPhoneOverrides,
  recomputeSharedPhoneWarnings,
  resolveBulkRecipients,
  type InvalidPhoneOverride,
  type SharedPhoneWarning,
} from 'src/bulk/resolve-bulk-recipients';
import { buildAuthorizedTemplateCatalog } from 'src/templates/build-template-catalog';
import { buildTemplatePreview } from 'src/templates/build-template-preview';
import { PERSON_SOURCE_OBJECT_NAME } from 'src/templates/data/find-eligible-template-sources';
import {
  resolveTemplateValues,
  resolveTemplateValuesForPersons,
  type TemplateSourceRecord,
} from 'src/templates/resolve-template-values';
import { type TemplateVariableCatalog } from 'src/templates/template-variable-catalog';

// Reads the optional per-recipient phone overrides. The distinction that
// matters is ABSENT vs PRESENT: a key the caller did not send at all means "no
// choice" (keep the Person's own number), while a key that IS present — even
// with an empty string or a non-string value — is an EXPLICIT choice that must
// be validated and, if invalid, reported rather than silently dropped.
//
// So this preserves every present key with its original value; it never drops
// an explicit empty or invalid-type value (which would let a fallback slip in).
export const readPhoneOverrides = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
};

export type PreviewTemplateSuccess = {
  success: true;
  previews: ReturnType<typeof buildTemplatePreview>['previews'];
  hasUnresolvedVariables: boolean;
  /** True when the body the server evaluated was empty or whitespace only. */
  isBodyEmpty: boolean;
  readyCount: number;
  /** Recomputed AFTER overrides are applied, from the numbers actually used. */
  sharedPhoneWarnings: SharedPhoneWarning[];
  duplicatePersonIds: string[];
  /** Every invalid override, with the person id and the specific reason. */
  invalidOverrides: InvalidPhoneOverride[];
};

export type PreviewTemplateFailure = { success: false; error: string };

/**
 * Builds the per-recipient preview. The server is the sole authority: it
 * re-reads the authorized Person records (never trusting the frontend for names
 * or values) and evaluates the template against the allow-listed fields. A
 * phone override is accepted only when it is a number that actually belongs to
 * that Person; an invalid override (a number the Person does not own, an empty
 * selection, or an invalid type) is reported and the recipient is left with NO
 * destination — the primary is never substituted. Nothing here sends a message.
 */
export const previewTemplate = async ({
  client,
  metadataClient,
  body,
  personIds,
  phoneOverrides,
  catalog,
  sourceRecord,
}: {
  client: Pick<CoreApiClient, 'query'>;
  metadataClient: Pick<MetadataApiClient, 'query'>;
  body: string;
  personIds: string[];
  phoneOverrides: Record<string, unknown>;
  /**
   * A catalog the CALLER already resolved for a known source. The editor's
   * preview passes the one it built for THIS template's source, so the preview
   * validates against the same field set the picker showed. Omitted by the bulk
   * send, which is Person-scoped and has no single source.
   */
  catalog?: TemplateVariableCatalog;
  /**
   * The SOURCE record `source.*` tokens read from. Only the editor's preview has
   * one (its sample record); a bulk preview has none, so those tokens stay
   * unresolved rather than borrowing a value from somewhere else.
   */
  sourceRecord?: TemplateSourceRecord | null;
}): Promise<PreviewTemplateSuccess | PreviewTemplateFailure> => {
  if (personIds.length === 0) {
    return { success: false, error: '`personIds` is required.' };
  }

  // The same cap as the recipients route, so a preview cannot be asked to
  // evaluate an unbounded selection.
  if (personIds.length > MAX_BULK_PERSON_IDS) {
    return {
      success: false,
      error: `Select at most ${MAX_BULK_PERSON_IDS} people at once.`,
    };
  }

  const persons = await findPersonsForBulk({ client, personIds });

  const resolution = resolveBulkRecipients({
    requestedPersonIds: personIds,
    persons,
  });

  const applied = applyPhoneOverrides({
    recipients: resolution.recipients,
    overrides: phoneOverrides,
  });

  // Recompute the shared-number warning from the numbers ACTUALLY used after
  // overrides, so an override that creates (or removes) a shared number is
  // reflected in the server's response.
  const sharedPhoneWarnings = recomputeSharedPhoneWarnings(applied.recipients);

  // One catalog for the whole request: the SAME one the picker shows, so the
  // preview can never accept a token the manager would not advertise (or vice
  // versa). When it cannot be authorized it is EMPTY, so every token reads as
  // unknown and no recipient is treated as ready to send.
  const resolvedCatalog =
    catalog ??
    (
      await buildAuthorizedTemplateCatalog({
        metadataClient,
        client,
        // Without a caller-supplied source this is the Person-scoped path (the
        // bulk send), which is exactly what its templates are resolved against.
        source: { objectName: PERSON_SOURCE_OBJECT_NAME },
      })
    ).catalog;

  const resolvedSourceRecord = sourceRecord ?? null;

  const valuesByPersonId =
    resolvedSourceRecord !== null && persons.length > 0
      ? new Map(
          await Promise.all(
            // The editor previews ONE sample source record for ONE recipient, so
            // the source record's values are attached to that recipient. Any
            // further recipient has no source record of its own, so `source.*`
            // stays unresolved for it rather than being copied from another
            // record.
            persons.slice(0, 1).map(async (person) => {
              const resolved = await resolveTemplateValues({
                client,
                personId: person.id,
                sourceRecord: resolvedSourceRecord,
                catalog: resolvedCatalog,
              });

              return [person.id, resolved.values] as const;
            }),
          ),
        )
      : await resolveTemplateValuesForPersons({
          client,
          personIds: persons.map((person) => person.id),
          catalog: resolvedCatalog,
        });

  const preview = buildTemplatePreview({
    body,
    recipients: applied.recipients,
    valuesByPersonId,
    catalog: resolvedCatalog,
  });

  return {
    success: true,
    previews: preview.previews,
    hasUnresolvedVariables: preview.hasUnresolvedVariables,
    isBodyEmpty: preview.isBodyEmpty,
    readyCount: preview.readyCount,
    sharedPhoneWarnings,
    duplicatePersonIds: resolution.duplicatePersonIds,
    invalidOverrides: applied.invalidOverrides,
  };
};
