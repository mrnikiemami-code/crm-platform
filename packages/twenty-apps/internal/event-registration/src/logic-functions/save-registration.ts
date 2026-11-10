import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { SAVE_REGISTRATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { executeRecordGraphql } from 'src/data/record-api';
import { toSaveResult } from 'src/domain/save-outcome';
import { saveRegistration } from 'src/services/save-registration.service';

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Reads a money amount. An absent value stays `null` ("not given"); a value that
 * is present but not a usable number becomes `NaN` so the planner rejects it
 * instead of silently treating the money as zero.
 */
const readAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(numeric) ? numeric : Number.NaN;
};

// WRITE PATH. One request performs the registration and, when money was
// received, its payment. The operator identity comes from the FUNCTION RUNTIME
// (`event.userWorkspaceId`, derived from the validated token), never from the
// body; if it is absent the save refuses, so the app can never write as itself
// on a person's behalf.
const handler = async (event: RoutePayload<unknown>) => {
  const body = event.body;
  const fields =
    body !== null && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {};

  const sourceObjectNameSingular = readString(fields.sourceObjectNameSingular);
  const sourceRecordId = readString(fields.sourceRecordId);
  const registrationStatus = readString(fields.registrationStatus);

  if (sourceObjectNameSingular.length === 0 || sourceRecordId.length === 0) {
    return toSaveResult({ kind: 'REJECTED', reason: 'SOURCE_NOT_FOUND' });
  }

  const outcome = await saveRegistration(
    {
      sourceObjectNameSingular,
      sourceRecordId,
      registrationStatus,
      agreedAmountToman: readAmount(fields.agreedAmountToman),
      paidAmountToman: readAmount(fields.paidAmountToman),
      operatorUserWorkspaceId: readString(event.userWorkspaceId) || null,
    },
    { execute: executeRecordGraphql },
  );

  return toSaveResult(outcome);
};

export default defineLogicFunction({
  universalIdentifier: SAVE_REGISTRATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'event-registration-save',
  description:
    'Creates the event registration (and its payment when money was received) for a lead or sales interaction.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/event-registration/save',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
