import {
  type RazpayamakConfig,
  RAZPAYAMAK_SMART_SEND_URL,
  getRazpayamakConfig,
} from 'src/providers/razpayamak/razpayamak.config';
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

// Delivery receipts are not implemented through this driver yet, so the
// capability reports only what this implementation exposes. The Smart service
// does offer `GetDeliveries2`, but wiring it is a separate wave.
const SMS_CAPABILITIES: CommunicationCapabilities = {
  supportsSubject: false,
  supportsDeliveryReceipt: false,
};

// Official SmartSMS REST response for `POST /api/SmartSMS/Send`.
// Success carries `RetStatus: 1` / `StrRetStatus: "Ok"` and a comma-separated
// `Value` holding one provider id per recipient.
// Failure is documented as HTTP 400 with `ReqStatus` set to a numeric code
// and a human-readable `Message`.
type RazpayamakSmartSendResponse = {
  Value?: string;
  RetStatus?: number;
  StrRetStatus?: string;
  ReqStatus?: string | number;
  Message?: string;
};

const buildSendBody = (
  config: RazpayamakConfig,
  message: OutboundCommunication,
): string =>
  JSON.stringify({
    username: config.username,
    password: config.apiKey,
    from: config.sender,
    to: message.recipient,
    text: message.body,
    ...(config.fromSupportOne === undefined
      ? {}
      : { fromSupportOne: config.fromSupportOne }),
    ...(config.fromSupportTwo === undefined
      ? {}
      : { fromSupportTwo: config.fromSupportTwo }),
  });

const parseResponse = (
  rawBody: string,
): RazpayamakSmartSendResponse | undefined => {
  try {
    return JSON.parse(rawBody) as RazpayamakSmartSendResponse;
  } catch {
    return undefined;
  }
};

// The provider id is the first entry of the documented comma-separated `Value`.
const extractProviderMessageId = (
  response: RazpayamakSmartSendResponse,
): string | null => {
  const firstId = response.Value?.split(',')[0]?.trim();

  return firstId === undefined || firstId.length === 0 ? null : firstId;
};

const extractFailureReason = (
  response: RazpayamakSmartSendResponse | undefined,
  httpStatus: number,
): string => {
  const message = response?.Message;

  if (typeof message === 'string' && message.length > 0) {
    return message;
  }

  const requestStatus = response?.ReqStatus;

  if (requestStatus !== undefined && String(requestStatus).length > 0) {
    return `RazPayamak rejected the request with status ${String(requestStatus)}.`;
  }

  return `RazPayamak rejected the request with HTTP status ${httpStatus}.`;
};

export type RazpayamakProviderDependencies = {
  /** Injected transport. Defaults to the platform `fetch`. */
  httpClient?: CommunicationHttpClient;
  /** Injected configuration. Defaults to reading the app variables. */
  getConfig?: () => RazpayamakConfig;
  /** Overrides the documented endpoint; tests use a non-routable URL. */
  sendUrl?: string;
};

export class RazpayamakCommunicationProvider implements CommunicationProvider {
  readonly id: CommunicationProviderId = 'razpayamak';
  readonly channel: CommunicationChannel = 'SMS';

  private readonly httpClient: CommunicationHttpClient;
  private readonly resolveConfig: () => RazpayamakConfig;
  private readonly sendUrl: string;

  constructor(dependencies: RazpayamakProviderDependencies = {}) {
    this.httpClient =
      dependencies.httpClient ?? defaultCommunicationHttpClient;
    this.sendUrl = dependencies.sendUrl ?? RAZPAYAMAK_SMART_SEND_URL;
    this.resolveConfig =
      dependencies.getConfig ??
      (() => {
        const result = getRazpayamakConfig();

        if (!result.success) {
          throw new Error(result.error);
        }

        return result.config;
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
        url: this.sendUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: buildSendBody(config, message),
      });
    } catch (error) {
      return {
        status: 'FAILED',
        failureReason: `RazPayamak request failed: ${
          error instanceof Error ? error.message : 'unknown transport error'
        }`,
      };
    }

    const rawBody = await response.text();
    const parsed = parseResponse(rawBody);

    if (!response.ok) {
      return {
        status: 'FAILED',
        failureReason: extractFailureReason(parsed, response.status),
      };
    }

    if (parsed === undefined) {
      return {
        status: 'FAILED',
        failureReason: 'RazPayamak returned a non-JSON response.',
      };
    }

    // The document defines `RetStatus: 1` as success; anything else is a
    // provider-declared failure even on a 2xx response.
    if (parsed.RetStatus !== 1) {
      return {
        status: 'FAILED',
        failureReason: extractFailureReason(parsed, response.status),
      };
    }

    return {
      status: 'SENT',
      providerMessageId: extractProviderMessageId(parsed),
    };
  }
}
