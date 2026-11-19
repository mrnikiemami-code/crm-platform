import { isNonEmptyString } from '@sniptt/guards';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { CoreApiCommunicationPersistence } from 'src/persistence/core-api-communication-persistence';
import { createCommunicationProviderRegistry } from 'src/providers/register-communication-providers';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';
import { validateCommunicationRequest } from 'src/services/communication-request-validation';
import {
  CommunicationOutcomePersistenceError,
  CommunicationSendAndPersistService,
  CommunicationUnexpectedSendFailureError,
} from 'src/services/communication-send-and-persist.service';
import { CommunicationSendService } from 'src/services/communication-send.service';

export type SendOutboundMessageParameters = {
  channel: CommunicationChannel;
  providerId: CommunicationProviderId;
  recipient: string;
  body: string;
  targetPersonId?: string | null;
  sourceRecordId?: string | null;
};

export type SendOutboundMessageResponse =
  | {
      success: true;
      communicationId: string;
      providerId: CommunicationProviderId;
      sendStatus: 'SENT' | 'DELIVERED';
      providerMessageId: string | null;
    }
  | {
      success: false;
      failureCode:
        | 'INVALID_INPUT'
        | 'PROVIDER_FAILED'
        | 'OUTCOME_UNKNOWN'
        | 'UNEXPECTED';
      error: string;
      communicationId?: string;
      providerId?: CommunicationProviderId;
      sendStatus?: 'FAILED' | 'UNKNOWN' | 'QUEUED';
      providerMessageId?: string | null;
    };

export type SendOutboundMessageDependencies = {
  client?: CoreApiClient;
  registry?: ReturnType<typeof createCommunicationProviderRegistry>;
};

// Numeric Bale private-chat id (docs.bale.ai chat_id). Rejects empty / non-numeric
// so a share cannot dispatch without a real conversation destination.
export const isValidBaleChatId = (value: string): boolean =>
  /^-?\d+$/.test(value.trim());

// Programmatic outbound path used by Nest quotation share (and similar bridges).
// It always goes through CommunicationSendAndPersistService — never a parallel
// provider call. Nest is responsible for product permissions (e.g. quotation.send).
export const sendOutboundMessageHandler = async (
  parameters: SendOutboundMessageParameters,
  dependencies: SendOutboundMessageDependencies = {},
): Promise<SendOutboundMessageResponse> => {
  const validation = validateCommunicationRequest({
    channel: parameters.channel,
    recipient: parameters.recipient,
    body: parameters.body,
  });

  if (!validation.success) {
    return {
      success: false,
      failureCode: 'INVALID_INPUT',
      error: validation.error,
    };
  }

  if (
    parameters.channel === 'BALE' &&
    !isValidBaleChatId(parameters.recipient)
  ) {
    return {
      success: false,
      failureCode: 'INVALID_INPUT',
      error:
        'A valid numeric Bale chat_id is required as the recipient for BALE.',
    };
  }

  if (parameters.channel === 'BALE' && parameters.providerId !== 'bale') {
    return {
      success: false,
      failureCode: 'INVALID_INPUT',
      error: 'BALE channel requires providerId "bale".',
    };
  }

  const registry =
    dependencies.registry ?? createCommunicationProviderRegistry();
  const client = dependencies.client ?? new CoreApiClient();
  const persistence = new CoreApiCommunicationPersistence(client);
  const orchestration = new CommunicationSendAndPersistService(
    new CommunicationSendService(registry),
    persistence,
  );

  try {
    const { communicationId, result } = await orchestration.sendAndPersist({
      message: {
        channel: validation.channel,
        recipient: parameters.recipient.trim(),
        body: parameters.body,
      },
      providerId: parameters.providerId,
      ...(isNonEmptyString(parameters.targetPersonId)
        ? { targetPersonId: parameters.targetPersonId }
        : {}),
      ...(isNonEmptyString(parameters.sourceRecordId)
        ? { sourceRecordId: parameters.sourceRecordId }
        : {}),
    });

    if (result.status === 'SENT' || result.status === 'DELIVERED') {
      return {
        success: true,
        communicationId,
        providerId: parameters.providerId,
        sendStatus: result.status,
        providerMessageId: result.providerMessageId,
      };
    }

    if (result.status === 'UNKNOWN') {
      return {
        success: false,
        failureCode: 'OUTCOME_UNKNOWN',
        error:
          'The provider outcome is unknown. The attempt is recorded; it is not re-sent automatically.',
        communicationId,
        providerId: parameters.providerId,
        sendStatus: 'UNKNOWN',
      };
    }

    return {
      success: false,
      failureCode: 'PROVIDER_FAILED',
      error: result.failureReason,
      communicationId,
      providerId: parameters.providerId,
      sendStatus: 'FAILED',
    };
  } catch (error) {
    if (error instanceof CommunicationOutcomePersistenceError) {
      return {
        success: false,
        failureCode: 'UNEXPECTED',
        error: error.message,
        communicationId: error.communicationId,
        providerId: parameters.providerId,
      };
    }

    if (error instanceof CommunicationUnexpectedSendFailureError) {
      return {
        success: false,
        failureCode: 'UNEXPECTED',
        error: error.message,
        communicationId: error.communicationId,
        providerId: parameters.providerId,
      };
    }

    const message =
      error instanceof Error && isNonEmptyString(error.message)
        ? error.message
        : 'Outbound send failed unexpectedly.';

    // Config / registry errors often surface as thrown Error from getConfig.
    return {
      success: false,
      failureCode: 'PROVIDER_FAILED',
      error: message,
      providerId: parameters.providerId,
    };
  }
};
