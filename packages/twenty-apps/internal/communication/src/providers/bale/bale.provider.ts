import {
  BALE_API_BASE,
  type BaleConfig,
  getBaleConfig,
} from 'src/providers/bale/bale.config';
import {
  type CommunicationHttpClient,
  defaultCommunicationHttpClient,
} from 'src/providers/http/communication-http-client';
import { type CommunicationCapabilities } from 'src/providers/types/communication-capabilities.type';
import { type CommunicationChannel } from 'src/providers/types/communication-channel.type';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';
import { type CommunicationProvider } from 'src/providers/types/communication-provider.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import { type OutboundCommunication } from 'src/providers/types/outbound-communication.type';

// Bale Bot API is Telegram-like: POST JSON to sendMessage; no subject, no
// synchronous delivery receipt in the send response.
const BALE_CAPABILITIES: CommunicationCapabilities = {
  supportsSubject: false,
  supportsDeliveryReceipt: false,
};

// docs.bale.ai — success: { ok: true, result: { message_id, ... } }
// failure: { ok: false, error_code?, description? }
type BaleSendEnvelope = {
  ok?: boolean;
  description?: string;
  error_code?: number;
  result?: { message_id?: number | string };
};

const buildSendMessageUrl = (apiBase: string, botToken: string): string =>
  `${apiBase.replace(/\/+$/, '')}/bot${botToken}/sendMessage`;

const extractFailureReason = (rawBody: string, status: number): string => {
  try {
    const envelope = JSON.parse(rawBody) as BaleSendEnvelope;

    if (typeof envelope.description === 'string' && envelope.description.length > 0) {
      return envelope.description;
    }
  } catch {
    // Non-JSON bodies fall through.
  }

  return `Bale rejected the request with status ${status}.`;
};

const extractProviderMessageId = (envelope: BaleSendEnvelope): string | null => {
  const messageId = envelope.result?.message_id;

  if (messageId === undefined || messageId === null) {
    return null;
  }

  return String(messageId);
};

export type BaleProviderDependencies = {
  httpClient?: CommunicationHttpClient;
  getConfig?: () => BaleConfig;
  /** Test-only override of the fixed production API base. */
  apiBase?: string;
};

export class BaleCommunicationProvider implements CommunicationProvider {
  readonly id: CommunicationProviderId = 'bale';
  readonly channel: CommunicationChannel = 'BALE';

  private readonly httpClient: CommunicationHttpClient;
  private readonly resolveConfig: () => BaleConfig;
  private readonly apiBase: string;

  constructor(dependencies: BaleProviderDependencies = {}) {
    this.httpClient =
      dependencies.httpClient ?? defaultCommunicationHttpClient;
    this.resolveConfig =
      dependencies.getConfig ??
      (() => {
        const result = getBaleConfig();

        if (!result.success) {
          throw new Error(result.error);
        }

        return result.config;
      });
    this.apiBase = dependencies.apiBase ?? BALE_API_BASE;
  }

  capabilities(): CommunicationCapabilities {
    return BALE_CAPABILITIES;
  }

  async send(
    message: OutboundCommunication,
  ): Promise<CommunicationSendResult> {
    const config = this.resolveConfig();
    const url = buildSendMessageUrl(this.apiBase, config.botToken);

    let response;

    try {
      response = await this.httpClient({
        url,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        // chat_id is the Bale conversation id; recipient carries it.
        body: JSON.stringify({
          chat_id: message.recipient,
          text: message.body,
        }),
      });
    } catch {
      // Do not interpolate transport errors: they can embed the token-bearing URL.
      return {
        status: 'FAILED',
        failureReason: 'Bale request failed.',
      };
    }

    const rawBody = await response.text();

    if (!response.ok) {
      return {
        status: 'FAILED',
        failureReason: extractFailureReason(rawBody, response.status),
      };
    }

    let envelope: BaleSendEnvelope;

    try {
      envelope = JSON.parse(rawBody) as BaleSendEnvelope;
    } catch {
      return {
        status: 'FAILED',
        failureReason: 'Bale returned a non-JSON response.',
      };
    }

    if (envelope.ok !== true) {
      return {
        status: 'FAILED',
        failureReason:
          typeof envelope.description === 'string' &&
          envelope.description.length > 0
            ? envelope.description
            : `Bale rejected the request with error_code ${envelope.error_code ?? 'unknown'}.`,
        ...(typeof envelope.error_code === 'number'
          ? { providerCode: envelope.error_code }
          : {}),
      };
    }

    return {
      status: 'SENT',
      providerMessageId: extractProviderMessageId(envelope),
    };
  }
}
