import {
  type CommunicationConfig,
  getCommunicationConfig,
} from 'src/config/communication-config';
import {
  type CommunicationHttpClient,
  defaultCommunicationHttpClient,
} from 'src/providers/http/communication-http-client';
import { type CommunicationCapabilities } from 'src/providers/types/communication-capabilities.type';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';

const SMS_CAPABILITIES: CommunicationCapabilities = {
  supportsSubject: false,
  supportsDeliveryReceipt: true,
};

// Kavenegar's `sms/send.json` success envelope. `return.status` is 200 on
// acceptance and `entries` carries the provider's message id.
type KavenegarSendEnvelope = {
  return?: { status?: number; message?: string };
  entries?: { messageid?: number; status?: number; statustext?: string }[];
};

// Kavenegar authenticates with the API key in the path:
// https://api.kavenegar.com/v1/{API-KEY}/sms/send.json
// The key therefore never appears in a body, a header, or an error message.
const buildSendUrl = (
  config: CommunicationConfig,
  message: OutboundCommunication,
): string => {
  const query = new URLSearchParams({
    receptor: message.recipient,
    sender: config.sender,
    message: message.body,
  });

  return `${config.endpoint}/${encodeURIComponent(config.apiKey)}/sms/send.json?${query.toString()}`;
};

const extractFailureReason = (rawBody: string, status: number): string => {
  try {
    const envelope = JSON.parse(rawBody) as KavenegarSendEnvelope;
    const providerMessage = envelope.return?.message;

    if (typeof providerMessage === 'string' && providerMessage.length > 0) {
      return providerMessage;
    }
  } catch {
    // Non-JSON error bodies fall through to the status-based message.
  }

  return `Kavenegar rejected the request with status ${status}.`;
};

const extractProviderMessageId = (rawBody: string): string | null => {
  try {
    const envelope = JSON.parse(rawBody) as KavenegarSendEnvelope;
    const messageId = envelope.entries?.[0]?.messageid;

    return messageId === undefined ? null : String(messageId);
  } catch {
    return null;
  }
};

export type KavenegarProviderDependencies = {
  /** Overrides the configured endpoint; tests use this instead of real config. */
  endpoint?: string;
  /** Injected transport. Defaults to the platform `fetch`. */
  httpClient?: CommunicationHttpClient;
  /** Injected configuration. Defaults to reading the app variables. */
  getConfig?: () => CommunicationConfig;
};

export class KavenegarCommunicationProvider implements CommunicationProvider {
  readonly channel: CommunicationChannel = 'SMS';

  private readonly httpClient: CommunicationHttpClient;
  private readonly resolveConfig: () => CommunicationConfig;

  constructor(dependencies: KavenegarProviderDependencies = {}) {
    this.httpClient =
      dependencies.httpClient ?? defaultCommunicationHttpClient;
    this.resolveConfig =
      dependencies.getConfig ??
      (() => {
        const result = getCommunicationConfig();

        if (!result.success) {
          throw new Error(result.error);
        }

        return {
          ...result.config,
          endpoint: dependencies.endpoint ?? result.config.endpoint,
        };
      });
  }

  capabilities(): CommunicationCapabilities {
    return SMS_CAPABILITIES;
  }

  async send(
    message: OutboundCommunication,
  ): Promise<CommunicationSendResult> {
    const config = this.resolveConfig();

    let response;

    try {
      response = await this.httpClient({
        url: buildSendUrl(config, message),
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch (error) {
      return {
        status: 'FAILED',
        failureReason: `Kavenegar request failed: ${
          error instanceof Error ? error.message : 'unknown transport error'
        }`,
      };
    }

    const rawBody = await response.text();

    if (!response.ok) {
      return {
        status: 'FAILED',
        failureReason: extractFailureReason(rawBody, response.status),
      };
    }

    let envelope: KavenegarSendEnvelope;

    try {
      envelope = JSON.parse(rawBody) as KavenegarSendEnvelope;
    } catch {
      return {
        status: 'FAILED',
        failureReason: 'Kavenegar returned a non-JSON response.',
      };
    }

    const providerStatus = envelope.return?.status;

    if (providerStatus !== 200) {
      return {
        status: 'FAILED',
        failureReason:
          typeof envelope.return?.message === 'string' &&
          envelope.return.message.length > 0
            ? envelope.return.message
            : `Kavenegar rejected the request with status ${providerStatus ?? response.status}.`,
      };
    }

    return {
      status: 'SENT',
      providerMessageId: extractProviderMessageId(rawBody),
    };
  }
}
