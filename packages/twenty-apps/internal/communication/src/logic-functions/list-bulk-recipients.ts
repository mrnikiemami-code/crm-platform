import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';

import {
  listBulkRecipients,
  normalizePersonIds,
} from 'src/bulk/list-bulk-recipients.service';
import { LIST_BULK_RECIPIENTS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// READ-ONLY. Resolves a multi-record Person selection into per-recipient rows
// (numbers, dedup, accessibility). It never sends anything: W15-A is preview
// only, and bulk execution is W15-B.
type ListBulkRecipientsRequest = { personIds?: unknown };

const handler = async (event: RoutePayload<ListBulkRecipientsRequest>) => {
  const body = event.body;
  const rawPersonIds =
    body !== null && typeof body === 'object' ? body.personIds : undefined;

  const personIds = normalizePersonIds(rawPersonIds);

  if (personIds === null) {
    return { success: false, error: '`personIds` must be an array.' };
  }

  return listBulkRecipients({ client: new CoreApiClient(), personIds });
};

export default defineLogicFunction({
  universalIdentifier:
    LIST_BULK_RECIPIENTS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'communication-list-bulk-recipients',
  description:
    'Resolves a Person multi-selection into sendable recipients (read-only).',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/communication/bulk-recipients',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
