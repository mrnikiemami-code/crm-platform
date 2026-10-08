import { type CoreApiClient } from 'twenty-client-sdk/core';

import { findPersonsForBulk, toTemplateRecipientData } from 'src/bulk/find-bulk-persons';
import { MAX_BULK_PERSON_IDS } from 'src/bulk/list-bulk-recipients.service';
import {
  applyPhoneOverrides,
  recomputeSharedPhoneWarnings,
  resolveBulkRecipients,
  type SharedPhoneWarning,
} from 'src/bulk/resolve-bulk-recipients';
import { buildTemplatePreview } from 'src/templates/build-template-preview';
import { type TemplateRecipientData } from 'src/templates/template-variable-catalog';

// Reads the optional per-recipient phone overrides. Only a string keyed by a
// personId with a non-empty value is kept; everything else is ignored.
export const readPhoneOverrides = (value: unknown): Record<string, string> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const overrides: Record<string, string> = {};

  for (const [personId, phone] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (typeof phone === 'string' && phone.trim().length > 0) {
      overrides[personId] = phone.trim();
    }
  }

  return overrides;
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
  /** Person ids whose override was not one of that Person's own numbers. */
  invalidOverrides: string[];
};

export type PreviewTemplateFailure = { success: false; error: string };

/**
 * Builds the per-recipient preview. The server is the sole authority: it
 * re-reads the authorized Person records (never trusting the frontend for names
 * or values) and evaluates the template against the allow-listed fields. A
 * phone override is accepted only when it is a number that actually belongs to
 * that Person; an invalid override is reported and the recipient is left on its
 * own number (never silently substituted). Nothing here sends a message.
 */
export const previewTemplate = async ({
  client,
  body,
  personIds,
  phoneOverrides,
}: {
  client: Pick<CoreApiClient, 'query'>;
  body: string;
  personIds: string[];
  phoneOverrides: Record<string, string>;
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

  const recipientData = new Map<string, TemplateRecipientData>();

  for (const person of persons) {
    recipientData.set(person.id, toTemplateRecipientData(person));
  }

  const preview = buildTemplatePreview({
    body,
    recipients: applied.recipients,
    recipientData,
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
