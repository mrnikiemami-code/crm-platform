import { type CoreApiClient } from 'twenty-client-sdk/core';

import { findPersonsForBulk } from 'src/bulk/find-bulk-persons';
import {
  resolveBulkRecipients,
  type BulkRecipient,
  type SharedPhoneWarning,
} from 'src/bulk/resolve-bulk-recipients';

// The largest selection this app resolves in one request. A cap keeps a single
// route call bounded; it is a safety limit, not a permission boundary.
export const MAX_BULK_PERSON_IDS = 200;

// Normalizes the raw `personIds` input into a de-duplicated, trimmed list.
// Returns `null` when the input is not an array at all (a malformed request),
// and an empty array when it is an array with no usable ids.
export const normalizePersonIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const ids = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return [...new Set(ids)];
};

export type ListBulkRecipientsSuccess = {
  success: true;
  recipients: BulkRecipient[];
  duplicatePersonIds: string[];
  sharedPhoneWarnings: SharedPhoneWarning[];
  sendableCount: number;
  unsendableCount: number;
};

export type ListBulkRecipientsFailure = { success: false; error: string };

/**
 * Resolves a multi-record selection into per-recipient rows. Authorization is
 * performed by the workspace API read: only records the caller may read come
 * back, so a requested id that is absent is reported as NOT_ACCESSIBLE. This
 * function NEVER sends anything.
 */
export const listBulkRecipients = async ({
  client,
  personIds,
}: {
  client: Pick<CoreApiClient, 'query'>;
  personIds: string[];
}): Promise<ListBulkRecipientsSuccess | ListBulkRecipientsFailure> => {
  if (personIds.length === 0) {
    return { success: false, error: '`personIds` is required.' };
  }

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

  return {
    success: true,
    recipients: resolution.recipients,
    duplicatePersonIds: resolution.duplicatePersonIds,
    sharedPhoneWarnings: resolution.sharedPhoneWarnings,
    sendableCount: resolution.sendableCount,
    unsendableCount: resolution.unsendableCount,
  };
};
