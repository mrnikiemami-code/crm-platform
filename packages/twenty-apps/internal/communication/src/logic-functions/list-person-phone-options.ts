import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { LIST_PERSON_PHONE_OPTIONS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { findPersonPhoneOptions } from 'src/logic-functions/data/find-person-phone-options';
import { findEligibleTemplateSources } from 'src/templates/data/find-eligible-template-sources';
import {
  resolveSendContext,
  SEND_CONTEXT_OUTCOME,
} from 'src/templates/resolve-send-context';

type ListPhoneOptionsRequest = {
  personId?: unknown;
  /**
   * The record a CONTEXTUAL send is composed from. When present, the recipient
   * is derived from THAT record's relation and `personId` is ignored — the same
   * resolution the send itself performs, so the numbers offered are exactly the
   * ones the send will accept.
   */
  contextObjectName?: unknown;
  contextRecordId?: unknown;
  contextRelationUid?: unknown;
};

const handler = async (event: RoutePayload<ListPhoneOptionsRequest>) => {
  const body = event.body;
  const personId =
    body !== null && typeof body === 'object' && typeof body.personId === 'string'
      ? body.personId.trim()
      : '';

  const readOptional = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

  const contextObjectName =
    body !== null && typeof body === 'object'
      ? readOptional(body.contextObjectName)
      : '';
  const contextRecordId =
    body !== null && typeof body === 'object'
      ? readOptional(body.contextRecordId)
      : '';

  const client = new CoreApiClient();

  let effectivePersonId = personId;

  if (contextObjectName.length > 0 && contextRecordId.length > 0) {
    const sources = await findEligibleTemplateSources({
      metadataClient: new MetadataApiClient(),
    });

    const sendContext = await resolveSendContext({
      client,
      sources,
      objectName: contextObjectName,
      recordId: contextRecordId,
      relationUid:
        body !== null && typeof body === 'object'
          ? readOptional(body.contextRelationUid)
          : '',
    });

    if (sendContext.outcome !== SEND_CONTEXT_OUTCOME.RESOLVED) {
      // Reported as one stable failure: the record does not resolve to a single
      // reachable person, so there is no phone list to offer. Never guessed.
      return {
        success: false,
        error: 'The selected record does not resolve to a person.',
        failureCode: sendContext.outcome,
      };
    }

    effectivePersonId = sendContext.recipientPersonId;
  }

  if (effectivePersonId.length === 0) {
    return { success: false, error: '`personId` is required.' };
  }

  const options = await findPersonPhoneOptions({
    client,
    personId: effectivePersonId,
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
