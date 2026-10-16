import { isNonEmptyString } from '@sniptt/guards';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { findPersonPhoneOptions } from 'src/logic-functions/data/find-person-phone-options';
import {
  type SendPersonCommunicationFailureCode,
  type SendPersonCommunicationResponse,
} from 'src/logic-functions/types/send-person-communication-input.type';
import { CoreApiCommunicationPersistence } from 'src/persistence/core-api-communication-persistence';
import { validateCommunicationRequest } from 'src/services/communication-request-validation';
import { createCommunicationProviderRegistry } from 'src/providers/register-communication-providers';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import {
  CommunicationOutcomePersistenceError,
  CommunicationSendAndPersistService,
  CommunicationUnexpectedSendFailureError,
} from 'src/services/communication-send-and-persist.service';
import { CommunicationSendService } from 'src/services/communication-send.service';
import { buildAuthorizedTemplateCatalog } from 'src/templates/build-template-catalog';
import {
  findEligibleTemplateSources,
  PERSON_SOURCE_OBJECT_NAME,
} from 'src/templates/data/find-eligible-template-sources';
import { interpolateTemplate } from 'src/templates/interpolate-template';
import { resolveTemplateValues } from 'src/templates/resolve-template-values';
import {
  resolveSendContext,
  SEND_CONTEXT_OUTCOME,
} from 'src/templates/resolve-send-context';

export type SendPersonCommunicationParameters = {
  personId: string;
  channel: CommunicationChannel;
  /** Exact destination chosen by the caller. */
  recipient: string;
  body: string;
  subject?: string;
  /**
   * Server-resolved workspace member of the triggering user. Never accepted
   * from the client; supplied by the trusted logic-function execution context.
   */
  workspaceMemberId?: string | null;
  /**
   * The object the record was selected from, as reported by the HOST's command
   * context. When present, the send is CONTEXTUAL: the recipient, the source
   * values and the final text are all derived from that record rather than from
   * `personId`/`body` alone.
   *
   * Optional so the existing Person flows keep working unchanged.
   */
  contextObjectName?: string | null;
  /** The selected record id, for a contextual send. */
  contextRecordId?: string | null;
  /** The template's stored relation, which selects the path to the Person. */
  contextRelationUid?: string | null;
};

export type SendPersonCommunicationDependencies = {
  /**
   * Workspace API client. Defaults to the app runtime's `CoreApiClient`; tests
   * inject a fake so validation and orchestration can be exercised without a
   * live workspace.
   */
  client?: CoreApiClient;
  /**
   * Metadata API client used to build the permission-aware template catalog.
   * Defaults to the app runtime's `MetadataApiClient`; tests inject a fake.
   */
  metadataClient?: Pick<MetadataApiClient, 'query'>;
  /** Provider registry override; tests inject stub providers. */
  registry?: ReturnType<typeof createCommunicationProviderRegistry>;
};

const fail = (
  error: string,
  failureCode: SendPersonCommunicationFailureCode,
  extra: Partial<SendPersonCommunicationResponse> = {},
): SendPersonCommunicationResponse => ({
  success: false,
  failureCode,
  ...extra,
  error,
});

// Orchestrates one Person outbound communication. It validates input and
// Person access, then delegates to the same certified durable path the UI and
// future Workflow will share. It never talks to a provider directly.
export const sendPersonCommunicationHandler = async (
  parameters: SendPersonCommunicationParameters,
  dependencies: SendPersonCommunicationDependencies = {},
): Promise<SendPersonCommunicationResponse> => {
  // Shared with the Workflow adapter so both entry points enforce the same
  // channel allow-list and required fields.
  const validation = validateCommunicationRequest({
    channel: parameters.channel,
    recipient: parameters.recipient,
    body: parameters.body,
  });

  if (!validation.success) {
    return fail(validation.error, 'INVALID_INPUT');
  }

  const client = dependencies.client ?? new CoreApiClient();

  // --- resolve the record context FIRST ------------------------------------
  // A CONTEXTUAL send derives its recipient from the selected record, so the
  // context has to be resolved before anything that depends on the person. The
  // block below also decides whether this IS a contextual send at all.
  const metadataClient = dependencies.metadataClient ?? new MetadataApiClient();
  const contextObjectName = parameters.contextObjectName?.trim() ?? '';
  const contextRecordId = parameters.contextRecordId?.trim() ?? '';

  let effectivePersonId = parameters.personId;
  let catalogSourceObjectName = PERSON_SOURCE_OBJECT_NAME;
  let sourceRecord: { objectName: string; recordId: string } | null = null;

  if (contextObjectName.length > 0 && contextRecordId.length > 0) {
    const sources = await findEligibleTemplateSources({ metadataClient });

    const sendContext = await resolveSendContext({
      client,
      sources,
      objectName: contextObjectName,
      recordId: contextRecordId,
      relationUid: parameters.contextRelationUid?.trim() ?? '',
    });

    if (sendContext.outcome !== SEND_CONTEXT_OUTCOME.RESOLVED) {
      // The remaining outcomes are UNSUPPORTED_OBJECT and RECORD_NOT_FOUND.
      // Both are refused with their own classification, and neither ever becomes
      // a Person send: the record did not resolve, so there is no context.
      const isRecordMissing =
        sendContext.outcome === SEND_CONTEXT_OUTCOME.RECORD_NOT_FOUND;

      return fail(
        isRecordMissing
          ? 'Record not found or not accessible.'
          : 'This record is not a template source.',
        isRecordMissing ? 'PERSON_NOT_ACCESSIBLE' : 'TEMPLATE_CONTEXT_MISMATCH',
        { isOutcomeKnown: true },
      );
    }

    // The record's own recipient REPLACES the requested one. A client that sent
    // a different personId cannot redirect a contextual send.
    effectivePersonId = sendContext.recipientPersonId;
    catalogSourceObjectName = sendContext.objectName;
    sourceRecord = sendContext.sourceRecord;
  }

  if (effectivePersonId.trim().length === 0) {
    return fail('`personId` is required.', 'INVALID_INPUT');
  }

  // Validate Person access server-side and confirm the recipient really
  // belongs to that Person. For a CONTEXTUAL send the person is the one the
  // record resolved to, so this check is what proves the derived recipient is
  // actually reachable — not the client's claim.
  const phoneOptions = await findPersonPhoneOptions({
    client,
    personId: effectivePersonId,
  });

  if (phoneOptions === null) {
    return fail('Person not found or not accessible.', 'PERSON_NOT_ACCESSIBLE');
  }

  if (phoneOptions.length === 0) {
    return fail('This person has no phone number.', 'INVALID_INPUT');
  }

  if (!phoneOptions.some((option) => option.value === parameters.recipient)) {
    return fail(
      'Selected phone number does not belong to this person.',
      'INVALID_INPUT',
    );
  }

  // Resolve any template variables SERVER-SIDE, against the authorized fields
  // re-read here through the workspace-scoped client. The client's body may
  // contain literal `@token` placeholders; those are substituted here and NEVER
  // sent literally. The catalog is the same metadata-driven, permission-aware one
  // the manager and preview use, so the send path can never accept a token the
  // manager would not advertise. An unknown or empty variable blocks the send
  // with a stable classification.
  //
  // CONTEXTUAL SEND: when the host reported which object the record was selected
  // from, the context is resolved from THAT record — its source, its relation and
  // the Person at the other end. The recipient and the values then come from the
  // record, so a client-supplied `personId` or a client-written body cannot stand
  // in for the record's own context.
  // CONTEXTUAL SEND: the context was already resolved above, before the person
  // checks, so the catalog and the values are built for the source the record
  // resolved to and `@source.*` reads THAT record.
  const { catalog } = await buildAuthorizedTemplateCatalog({
    metadataClient,
    client,
    source: { objectName: catalogSourceObjectName },
  });

  const resolved = await resolveTemplateValues({
    client,
    personId: effectivePersonId,
    sourceRecord,
    catalog,
  });

  if (!resolved.isAccessible) {
    return fail('Person not found or not accessible.', 'PERSON_NOT_ACCESSIBLE');
  }

  // A contextual send whose SOURCE record could not be read must not go out with
  // the source's tokens silently blank: the text would be wrong in a way nobody
  // would notice until the recipient did.
  if (!resolved.isSourceAccessible) {
    return fail(
      'The source record could not be read, so its variables cannot be resolved.',
      'TEMPLATE_VARIABLE_UNRESOLVED',
      { isOutcomeKnown: true },
    );
  }

  const interpolation = interpolateTemplate({
    body: parameters.body,
    values: resolved.values,
    catalog,
  });

  if (interpolation.hasUnresolvedVariables) {
    return {
      success: false,
      failureCode: 'TEMPLATE_VARIABLE_UNRESOLVED',
      isOutcomeKnown: true,
      error:
        'The message contains a variable that could not be resolved for this recipient.',
      unresolvedVariables: interpolation.issues.map((issue) => issue.token),
    };
  }

  const registry =
    dependencies.registry ?? createCommunicationProviderRegistry();
  const sendService = new CommunicationSendService(registry);
  const persistence = new CoreApiCommunicationPersistence(client);
  const orchestration = new CommunicationSendAndPersistService(
    sendService,
    persistence,
  );

  const subject = parameters.subject?.trim();

  let communicationId: string;
  let result;

  try {
    ({ communicationId, result } = await orchestration.sendAndPersist({
      message: {
        channel: parameters.channel,
        recipient: parameters.recipient,
        body: interpolation.text,
        ...(isNonEmptyString(subject) ? { subject } : {}),
      },
      targetPersonId: effectivePersonId,
      ...(isNonEmptyString(parameters.workspaceMemberId)
        ? { senderId: parameters.workspaceMemberId }
        : {}),
      // Only for a CONTEXTUAL send: it records WHICH record produced the text, so
      // two messages with different source values are distinguishable in history.
      ...(sourceRecord === null
        ? {}
        : { sourceRecordId: sourceRecord.recordId }),
    }));
  } catch (error) {
    // The provider outcome is known for CommunicationOutcomePersistenceError:
    // the send did happen, only history could not be written. Report the real
    // outcome and make clear that retrying would send a duplicate.
    if (error instanceof CommunicationOutcomePersistenceError) {
      const outcome = error.sendResult;

      console.warn(
        '[communication] send outcome could not be persisted',
        JSON.stringify({
          classification: 'OUTCOME_NOT_PERSISTED',
          communicationId: error.communicationId,
          providerOutcome: outcome.status,
        }),
      );

      return {
        success: false,
        // An UNKNOWN result never reaches persistence (it returns earlier), so
        // this branch only ever carries a known SENT/DELIVERED/FAILED outcome.
        status: outcome.status === 'UNKNOWN' ? 'FAILED' : outcome.status,
        communicationId: error.communicationId,
        failureCode: 'OUTCOME_NOT_PERSISTED',
        isOutcomeKnown: true,
        error:
          outcome.status === 'FAILED'
            ? 'The provider rejected the message and the failure could not be recorded. Do not retry automatically.'
            : 'The message was sent but its result could not be recorded. Do not retry automatically.',
      };
    }

    // Both the send and the FAILED write failed, so the outcome is genuinely
    // unknown. The full causes are logged server-side (never returned, never
    // persisted), and the caller gets a stable classification.
    if (error instanceof CommunicationUnexpectedSendFailureError) {
      console.warn(
        '[communication] unexpected send failure with persistence failure',
        JSON.stringify({
          classification: 'UNEXPECTED_FAILURE',
          communicationId: error.communicationId,
          sendCause:
            error.sendCause instanceof Error
              ? error.sendCause.name
              : 'unknown',
          persistenceCause:
            error.persistenceCause instanceof Error
              ? error.persistenceCause.name
              : 'unknown',
        }),
      );

      return {
        success: false,
        communicationId: error.communicationId,
        failureCode: 'UNEXPECTED_FAILURE',
        isOutcomeKnown: false,
        error:
          'The message could not be sent and its state could not be recorded. Do not retry automatically.',
      };
    }

    // Configuration, provider or programming failures before/around the
    // orchestration. Raw exception text is never returned to the client.
    console.warn(
      '[communication] send failed',
      JSON.stringify({
        classification: 'UNEXPECTED_FAILURE',
        errorType: error instanceof Error ? error.name : 'unknown',
      }),
    );

    return fail('The message could not be sent.', 'UNEXPECTED_FAILURE', {
      isOutcomeKnown: false,
    });
  }

  if (result.status === 'FAILED') {
    return {
      success: false,
      status: 'FAILED',
      communicationId,
      failureCode: 'PROVIDER_FAILED',
      isOutcomeKnown: true,
      error: result.failureReason,
      ...(result.failureCode === undefined
        ? {}
        : { providerFailureCode: result.failureCode }),
    };
  }

  if (result.status === 'UNKNOWN') {
    // The provider may have received the request. Never present this as a
    // definite failure and never retry automatically; the durable record is
    // left QUEUED so history does not assert a false failure.
    return {
      success: false,
      communicationId,
      failureCode: 'OUTCOME_UNKNOWN',
      isOutcomeKnown: false,
      error:
        'The message may or may not have been sent. Check the communication history before retrying.',
    };
  }

  return {
    success: true,
    status: result.status,
    communicationId,
    message:
      result.status === 'DELIVERED' ? 'Message delivered.' : 'Message sent.',
  };
};
