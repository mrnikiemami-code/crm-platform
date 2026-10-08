import { type CoreApiClient } from 'twenty-client-sdk/core';

import { findPersonsForBulk, toTemplateRecipientData } from 'src/bulk/find-bulk-persons';
import { resolveBulkRecipients } from 'src/bulk/resolve-bulk-recipients';
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
  readyCount: number;
  sharedPhoneWarnings: ReturnType<
    typeof resolveBulkRecipients
  >['sharedPhoneWarnings'];
  duplicatePersonIds: string[];
};

export type PreviewTemplateFailure = { success: false; error: string };

/**
 * Builds the per-recipient preview. The server is the sole authority: it
 * re-reads the authorized Person records (never trusting the frontend for names
 * or values) and evaluates the template against the allow-listed fields. A
 * phone override is accepted only when it is a number that actually belongs to
 * that Person. Nothing here sends a message.
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

  const persons = await findPersonsForBulk({ client, personIds });

  const resolution = resolveBulkRecipients({
    requestedPersonIds: personIds,
    persons,
  });

  const recipients = resolution.recipients.map((recipient) => {
    const override = phoneOverrides[recipient.personId];
    const isAllowedOverride =
      override !== undefined &&
      recipient.phones.some((phone) => phone.value === override);

    return isAllowedOverride
      ? { ...recipient, selectedPhone: override }
      : recipient;
  });

  const recipientData = new Map<string, TemplateRecipientData>();

  for (const person of persons) {
    recipientData.set(person.id, toTemplateRecipientData(person));
  }

  const preview = buildTemplatePreview({ body, recipients, recipientData });

  return {
    success: true,
    previews: preview.previews,
    hasUnresolvedVariables: preview.hasUnresolvedVariables,
    readyCount: preview.readyCount,
    sharedPhoneWarnings: resolution.sharedPhoneWarnings,
    duplicatePersonIds: resolution.duplicatePersonIds,
  };
};
