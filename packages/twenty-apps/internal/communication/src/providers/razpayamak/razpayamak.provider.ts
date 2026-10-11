import {
  type RazpayamakConfig,
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
// capability reports what this implementation actually exposes, not what the
// vendor can theoretically do.
const SMS_CAPABILITIES: CommunicationCapabilities = {
  supportsSubject: false,
  supportsDeliveryReceipt: false,
};

// Official REST response for `POST /api/SendSMS/SendSMS`.
// Success carries `RetStatus: 1` / `StrRetStatus: "Ok"` and a `Value` holding
// the `recID` (or a comma-separated list for multiple recipients).
// Failure carries a numeric `Value` code (see the provider document) and, for
// request-level errors, an HTTP 400 with `ReqStatus` and `Message`.
type RazpayamakSendResponse = {
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
  });

const parseResponse = (
  rawBody: string,
): RazpayamakSendResponse | undefined => {
  try {
    return JSON.parse(rawBody) as RazpayamakSendResponse;
  } catch {
    return undefined;
  }
};

// The provider id is the first entry of the documented comma-separated `Value`.
const extractProviderMessageId = (
  response: RazpayamakSendResponse,
): string | null => {
  const firstId = response.Value?.split(',')[0]?.trim();

  return firstId === undefined || firstId.length === 0 ? null : firstId;
};

const extractFailureReason = (
  response: RazpayamakSendResponse | undefined,
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
  /** Overrides the configured endpoint; tests use a non-routable URL. */
  sendUrl?: string;
};

export class RazpayamakCommunicationProvider implements CommunicationProvider {
  readonly id: CommunicationProviderId = 'razpayamak';
  readonly channel: CommunicationChannel = 'SMS';

  private readonly httpClient: CommunicationHttpClient;
  private readonly resolveConfig: () => RazpayamakConfig;
  private readonly sendUrl: string | undefined;

  constructor(dependencies: RazpayamakProviderDependencies = {}) {
    this.httpClient =
      dependencies.httpClient ?? defaultCommunicationHttpClient;
    this.sendUrl = dependencies.sendUrl;
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
    const url = this.sendUrl ?? config.endpoint;

    let response;

    try {
      response = await this.httpClient({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: buildSendBody(config, message),
      });
    } catch {
      // Deliberately does not interpolate the thrown message: a transport
      // error can embed the request body (which carries the ApiKey). The raw
      // error is not surfaced here because this result is persisted as
      // history.
      return {
        status: 'FAILED',
        failureReason: 'RazPayamak request failed.',
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
