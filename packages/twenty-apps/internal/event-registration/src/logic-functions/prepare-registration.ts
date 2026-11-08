import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { PREPARE_REGISTRATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { executeRecordGraphql } from 'src/data/record-api';
import { prepareRegistration } from 'src/services/prepare-registration.service';

// READ-ONLY. Returns the person, lead and event the form will write against,
// resolved on the server from the selected record — the client never supplies
// those identifiers as values.
const handler = async (event: RoutePayload<unknown>) => {
  const body = event.body;

  const readString = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

  const sourceObjectNameSingular =
    body !== null && typeof body === 'object'
      ? readString((body as Record<string, unknown>).sourceObjectNameSingular)
      : '';
  const sourceRecordId =
    body !== null && typeof body === 'object'
      ? readString((body as Record<string, unknown>).sourceRecordId)
      : '';

  if (sourceObjectNameSingular.length === 0 || sourceRecordId.length === 0) {
    return { success: false, reason: 'SOURCE_NOT_FOUND' };
  }

  return prepareRegistration(
    { sourceObjectNameSingular, sourceRecordId },
    { execute: executeRecordGraphql },
  );
};

export default defineLogicFunction({
  universalIdentifier:
    PREPARE_REGISTRATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'event-registration-prepare',
  description:
    'Resolves the person, lead and event for the registration form (read-only).',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/event-registration/prepare',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
