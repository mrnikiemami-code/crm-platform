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
import { resolveTemplateValuesForPersons } from 'src/templates/resolve-template-values';

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
}: {
  client: Pick<CoreApiClient, 'query'>;
  metadataClient: Pick<MetadataApiClient, 'query'>;
  body: string;
  personIds: string[];
  phoneOverrides: Record<string, unknown>;
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
  const { catalog } = await buildAuthorizedTemplateCatalog({ metadataClient, client });

  const valuesByPersonId = await resolveTemplateValuesForPersons({
    client,
    personIds: persons.map((person) => person.id),
    catalog,
  });

  const preview = buildTemplatePreview({
    body,
    recipients: applied.recipients,
    valuesByPersonId,
    catalog,
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
