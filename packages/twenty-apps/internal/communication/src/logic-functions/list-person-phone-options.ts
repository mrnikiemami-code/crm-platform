import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { LIST_PERSON_PHONE_OPTIONS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { findPersonPhoneOptions } from 'src/logic-functions/data/find-person-phone-options';

type ListPhoneOptionsRequest = { personId?: unknown };

const handler = async (event: RoutePayload<ListPhoneOptionsRequest>) => {
  const body = event.body;
  const personId =
    body !== null && typeof body === 'object' && typeof body.personId === 'string'
      ? body.personId.trim()
      : '';

  if (personId.length === 0) {
    return { success: false, error: '`personId` is required.' };
  }

  const options = await findPersonPhoneOptions({
    client: new CoreApiClient(),
    personId,
  });

  if (options === null) {
    return { success: false, error: 'Person not found or not accessible.' };
  }

  return { success: true, phones: options };
};

export default defineLogicFunction({
  universalIdentifier:
    LIST_PERSON_PHONE_OPTIONS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'communication-list-person-phones',
  description: 'Lists the selectable phone numbers of a person.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/communication/person-phones',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
