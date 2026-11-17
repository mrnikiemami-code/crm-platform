import { isNonEmptyString } from '@sniptt/guards';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { findPersonPhoneOptions } from 'src/logic-functions/data/find-person-phone-options';
import { CoreApiCommunicationPersistence } from 'src/persistence/core-api-communication-persistence';
import { createCommunicationProviderRegistry } from 'src/providers/register-communication-providers';
import { CommunicationSendAndPersistService } from 'src/services/communication-send-and-persist.service';
import { CommunicationSendService } from 'src/services/communication-send.service';
import { buildAuthorizedTemplateCatalog } from 'src/templates/build-template-catalog';
import {
  findEligibleTemplateSources,
  PERSON_SOURCE_OBJECT_NAME,
  type EligibleTemplateSource,
} from 'src/templates/data/find-eligible-template-sources';
import { findMessageTemplates } from 'src/templates/data/find-message-templates';
import { interpolateTemplate } from 'src/templates/interpolate-template';
import { resolveSendContext } from 'src/templates/resolve-send-context';
import { resolveTemplateValues } from 'src/templates/resolve-template-values';
import {
  buildWorkflowSendDedupId,
  buildWorkflowSendEventPart,
} from 'src/workflow/workflow-send-dedup-id';
import { readWorkflowSmsAuthorization } from 'src/workflow/workflow-sms-authorization';

// One workflow event, as the workflow builder can supply it.
export type WorkflowTemplateSmsRequest = {
  templateId: string;
  /** The object whose record changed, as a metadata `nameSingular`. */
  sourceObjectNameSingular: string;
  sourceRecordId: string;
  /** Watched column, empty when the workflow watches the whole object. */
  fieldName?: string;
  /** The values around the change, when the trigger exposes them. */
  beforeValue?: unknown;
  afterValue?: unknown;
  /**
   * Identifies the workflow so two different workflows watching the same record
   * and column do not suppress each other.
   */
  workflowId: string;
};

export type WorkflowTemplateSmsOutcome =
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'UNKNOWN'
  | 'ALREADY_SENT'
  | 'REFUSED';

export type WorkflowTemplateSmsResult = {
  success: boolean;
  outcome: WorkflowTemplateSmsOutcome;
  communicationId?: string;
  failureCode?: string;
  /**
   * False for UNKNOWN: the provider may have accepted the message. A caller
   * must never re-send automatically on an unknown outcome.
   */
  isOutcomeKnown: boolean;
  message?: string;
  error?: string;
};

export type WorkflowTemplateSmsDependencies = {
  client?: CoreApiClient;
  metadataClient?: MetadataApiClient;
  registry?: ReturnType<typeof createCommunicationProviderRegistry>;
  now?: () => Date;
};

const refuse = (
  failureCode: string,
  error: string,
): WorkflowTemplateSmsResult => ({
  success: false,
  outcome: 'REFUSED',
  failureCode,
  isOutcomeKnown: true,
  error,
});

type ExistingCommunication = {
  id: string;
  status: string;
};

const readExistingCommunication = async ({
  client,
  id,
}: {
  client: Pick<CoreApiClient, 'query'>;
  id: string;
}): Promise<ExistingCommunication | null> => {
  try {
    const result = await client.query({
      communication: {
        __args: { filter: { id: { eq: id } } },
        id: true,
        status: true,
      },
    });

    const node = result.communication as
      | { id?: unknown; status?: unknown }
      | null
      | undefined;

    if (node === null || node === undefined || node.id !== id) {
      return null;
    }

    return {
      id,
      status: typeof node.status === 'string' ? node.status : '',
    };
  } catch {
    // A read failure must not be treated as "no record": that would allow a
    // second send. The caller reports the duplicate-check failure as UNKNOWN.
    return null;
  }
};

// A row that already exists means this event was already dispatched. Its own
// status is the only truthful answer, and it is never "send again".
const describeExisting = (
  existing: ExistingCommunication,
): WorkflowTemplateSmsResult => {
  if (existing.status === 'SENT' || existing.status === 'DELIVERED') {
    return {
      success: true,
      outcome: 'ALREADY_SENT',
      communicationId: existing.id,
      isOutcomeKnown: true,
      message: `This change was already sent (status ${existing.status}).`,
    };
  }

  if (existing.status === 'FAILED') {
    return {
      success: false,
      outcome: 'ALREADY_SENT',
      communicationId: existing.id,
      failureCode: 'ALREADY_ATTEMPTED_FAILED',
      isOutcomeKnown: true,
      error:
        'This change was already attempted and the provider rejected it. It is not re-sent automatically.',
    };
  }

  // QUEUED: the attempt was recorded but its outcome never landed. The message
  // may or may not have reached the provider, so re-sending is forbidden.
  return {
    success: false,
    outcome: 'UNKNOWN',
    communicationId: existing.id,
    failureCode: 'OUTCOME_UNKNOWN',
    isOutcomeKnown: false,
    error:
      'A previous attempt for this change has no recorded outcome. Check the communication history before acting; it is not re-sent automatically.',
  };
};

const resolveSource = (
  sources: readonly EligibleTemplateSource[],
  objectName: string,
): EligibleTemplateSource | null =>
  sources.find((entry) => entry.objectName === objectName) ?? null;

/**
 * Sends the SMS a workflow step asked for, exactly once per real change.
 *
 * The whole path is the SAME durable send the Person composer uses: template
 * validation, a server-resolved recipient, allow-listed interpolation, then
 * `CommunicationSendAndPersistService`. No parallel SMS path exists.
 *
 * Ordering matters and is deliberate:
 *  1. authorization, before anything is read or sent;
 *  2. template validity, so a removed or foreign template cannot send;
 *  3. recipient resolution, so the number is never taken from workflow input;
 *  4. interpolation, refusing to send a body with unresolved tokens;
 *  5. duplicate check and the deterministic-id claim, so a replay cannot send;
 *  6. the real send.
 */
export const sendTemplateSmsFromWorkflow = async (
  request: WorkflowTemplateSmsRequest,
  dependencies: WorkflowTemplateSmsDependencies = {},
): Promise<WorkflowTemplateSmsResult> => {
  const authorization = readWorkflowSmsAuthorization();

  if (!authorization.allowed) {
    return {
      success: false,
      outcome: 'REFUSED',
      failureCode:
        authorization.reason === 'DISABLED' ? 'DISABLED' : 'NOT_CONFIGURED',
      isOutcomeKnown: true,
      error: authorization.message,
    };
  }

  if (
    !isNonEmptyString(request.templateId) ||
    !isNonEmptyString(request.sourceObjectNameSingular) ||
    !isNonEmptyString(request.sourceRecordId) ||
    !isNonEmptyString(request.workflowId)
  ) {
    return refuse(
      'INVALID_INPUT',
      '`templateId`, `sourceObjectNameSingular`, `sourceRecordId` and `workflowId` are required.',
    );
  }

  const client = dependencies.client ?? new CoreApiClient();
  const metadataClient = dependencies.metadataClient ?? new MetadataApiClient();
  const registry =
    dependencies.registry ?? createCommunicationProviderRegistry();
  const now = dependencies.now ?? (() => new Date());

  const templates = await findMessageTemplates({ client });
  const template = templates.find((entry) => entry.id === request.templateId);

  if (template === undefined) {
    return refuse(
      'TEMPLATE_NOT_FOUND',
      'The selected template no longer exists or is not visible in this workspace.',
    );
  }

  if (template.channel !== 'SMS') {
    return refuse(
      'TEMPLATE_UNSUPPORTED_CHANNEL',
      `The selected template is a ${template.channel} template; this action sends SMS only.`,
    );
  }

  const sources = await findEligibleTemplateSources({ metadataClient });
  const source = resolveSource(sources, request.sourceObjectNameSingular);

  if (source === null) {
    return refuse(
      'SOURCE_NOT_ELIGIBLE',
      `"${request.sourceObjectNameSingular}" cannot be used as a recipient source.`,
    );
  }

  // The template must belong to the very object the workflow watches. An empty
  // stored identifier is the documented legacy meaning "written for Person";
  // a non-empty one that differs is a template for another object and is
  // refused rather than reinterpreted.
  const templateSourceUid =
    template.sourceObjectUid.length > 0 ? template.sourceObjectUid : null;
  const expectedUid =
    templateSourceUid ??
    sources.find((entry) => entry.objectName === PERSON_SOURCE_OBJECT_NAME)
      ?.objectUid ??
    null;

  if (expectedUid === null || source.objectUid !== expectedUid) {
    return refuse(
      'TEMPLATE_SOURCE_MISMATCH',
      'The selected template was written for a different object than the one this workflow watches.',
    );
  }

  const sendContext = await resolveSendContext({
    client,
    sources,
    objectName: request.sourceObjectNameSingular,
    recordId: request.sourceRecordId,
    // The template's own stored relation decides which path to a Person is
    // followed; an empty value is only valid for a Person source.
    relationUid: template.recipientRelationUid,
  });

  if (sendContext.outcome !== 'RESOLVED') {
    return refuse(
      sendContext.outcome,
      sendContext.outcome === 'RELATION_EMPTY'
        ? 'The record has no Person attached, so there is no recipient.'
        : 'The recipient could not be resolved from the record.',
    );
  }

  const recipientPersonId = sendContext.recipientPersonId;

  const phoneOptions = await findPersonPhoneOptions({
    client,
    personId: recipientPersonId,
  });

  if (phoneOptions === null) {
    return refuse(
      'RECIPIENT_NOT_ACCESSIBLE',
      'The recipient Person is not accessible with the current permissions.',
    );
  }

  const recipient = phoneOptions[0]?.value;

  if (!isNonEmptyString(recipient)) {
    return refuse(
      'RECIPIENT_NO_PHONE',
      'The recipient Person has no phone number, so nothing was sent.',
    );
  }

  const catalogResult = await buildAuthorizedTemplateCatalog({
    metadataClient,
    client,
    source: { objectName: request.sourceObjectNameSingular },
  });

  const catalog = catalogResult.catalog;

  const resolvedValues = await resolveTemplateValues({
    client,
    personId: recipientPersonId,
    sourceRecord:
      request.sourceObjectNameSingular === PERSON_SOURCE_OBJECT_NAME
        ? null
        : {
            objectName: request.sourceObjectNameSingular,
            recordId: request.sourceRecordId,
          },
    catalog,
  });

  if (!resolvedValues.isAccessible) {
    return refuse(
      'RECIPIENT_NOT_ACCESSIBLE',
      'The recipient Person is not accessible with the current permissions.',
    );
  }

  const interpolation = interpolateTemplate({
    body: template.body,
    values: resolvedValues.values,
    catalog,
  });

  if (interpolation.text.trim().length === 0) {
    return refuse('TEMPLATE_EMPTY', 'The selected template has an empty body.');
  }

  // A body with a token the catalog cannot resolve is never sent: the customer
  // would receive a literal `@placeholder`.
  if (interpolation.hasUnresolvedVariables) {
    return refuse(
      'TEMPLATE_UNRESOLVED_VARIABLES',
      `The template has variables that cannot be filled from this record: ${interpolation.issues
        .map((issue) => issue.token)
        .join(', ')}.`,
    );
  }

  const communicationId = buildWorkflowSendDedupId({
    workflowId: request.workflowId,
    sourceObjectName: request.sourceObjectNameSingular,
    sourceRecordId: request.sourceRecordId,
    fieldName: request.fieldName ?? '',
    before: buildWorkflowSendEventPart(request.beforeValue),
    after: buildWorkflowSendEventPart(request.afterValue),
    templateId: template.id,
  });

  // Cheap read first, so a replay is answered with the real recorded status
  // instead of an opaque create failure.
  const existing = await readExistingCommunication({
    client,
    id: communicationId,
  });

  if (existing !== null) {
    return describeExisting(existing);
  }

  const persistence = new CoreApiCommunicationPersistence(
    client,
    () => communicationId,
  );

  const orchestration = new CommunicationSendAndPersistService(
    new CommunicationSendService(registry),
    persistence,
    now,
  );

  try {
    const { communicationId: sentId, result } =
      await orchestration.sendAndPersist({
        message: {
          channel: 'SMS',
          recipient,
          body: interpolation.text,
        },
        targetPersonId: recipientPersonId,
        ...(request.sourceObjectNameSingular === PERSON_SOURCE_OBJECT_NAME
          ? {}
          : { sourceRecordId: request.sourceRecordId }),
      });

    if (result.status === 'UNKNOWN') {
      return {
        success: false,
        outcome: 'UNKNOWN',
        communicationId: sentId,
        failureCode: 'OUTCOME_UNKNOWN',
        isOutcomeKnown: false,
        error:
          'The provider outcome is unknown. The attempt is recorded; it is not re-sent automatically.',
      };
    }

    if (result.status === 'FAILED') {
      return {
        success: false,
        outcome: 'FAILED',
        communicationId: sentId,
        failureCode: 'PROVIDER_FAILED',
        isOutcomeKnown: true,
        error: result.failureReason ?? 'The provider rejected the message.',
      };
    }

    return {
      success: true,
      outcome: result.status,
      communicationId: sentId,
      isOutcomeKnown: true,
      message:
        result.status === 'DELIVERED' ? 'Message delivered.' : 'Message sent.',
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';

    // Known classes reported by the durable send service. Both mean "we cannot
    // assert a non-send", so neither is ever downgraded to a definite failure.
    if (name === 'CommunicationOutcomePersistenceError') {
      return {
        success: false,
        outcome: 'UNKNOWN',
        communicationId,
        failureCode: 'OUTCOME_NOT_PERSISTED',
        isOutcomeKnown: false,
        error:
          'The send outcome could not be recorded. It is not re-sent automatically.',
      };
    }

    if (name === 'CommunicationUnexpectedSendFailureError') {
      return {
        success: false,
        outcome: 'UNKNOWN',
        communicationId,
        failureCode: 'UNEXPECTED_FAILURE',
        isOutcomeKnown: false,
        error: 'The send failed unexpectedly. It is not re-sent automatically.',
      };
    }

    const raced = await readExistingCommunication({
      client,
      id: communicationId,
    });

    // Only a COMPLETED row proves this attempt lost a race to a finished send.
    // A QUEUED or FAILED row cannot: an unexpected provider throw also leaves a
    // FAILED row, and that throw does not prove the provider refused the
    // message. Reporting it as a definite failure would invite a re-send.
    if (
      raced !== null &&
      (raced.status === 'SENT' || raced.status === 'DELIVERED')
    ) {
      return describeExisting(raced);
    }

    return {
      success: false,
      outcome: 'UNKNOWN',
      communicationId,
      failureCode: 'UNEXPECTED_FAILURE',
      isOutcomeKnown: false,
      error: 'The send did not complete. It is not re-sent automatically.',
    };
  }
};
