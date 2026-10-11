import {
  type RazpayamakConfig,
  RAZPAYAMAK_SEND_URL,
  getRazpayamakConfig,
} from 'src/providers/razpayamak/razpayamak.config';
import {
  parseRazpayamakFailureCode,
  sanitizeProviderDetail,
} from 'src/providers/razpayamak/razpayamak-failure';
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

// The exact documented request body. Only the five documented fields are sent:
// no backup senders, no endpoint value, no internal metadata, no `undefined`.
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
    const parsed = JSON.parse(rawBody) as unknown;

    return typeof parsed === 'object' && parsed !== null
      ? (parsed as RazpayamakSendResponse)
      : undefined;
  } catch {
    return undefined;
  }
};

// Strict success requires a non-empty, valid recID in `Value`. A `Value` that
// is a documented failure code (e.g. `11`) is NOT a recID, so it must never be
// reported as a sent message id.
const readUsableRecId = (value: string | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const first = value.split(',')[0]?.trim();

  if (first === undefined || first.length === 0) {
    return null;
  }

  // A recID is a positive integer. Anything else (a bare failure code, a
  // non-numeric string) is not a usable identifier.
  return /^[0-9]+$/.test(first) && Number(first) > 0 ? first : null;
};

const buildDefiniteFailure = (
  response: RazpayamakSendResponse | undefined,
  httpStatus: number,
): CommunicationSendResult => {
  // Prefer the numeric code from the documented vocabulary. `Value` carries it
  // on a 2xx-with-RetStatus!=1 response; `ReqStatus` carries it on an HTTP 400.
  const parsed =
    parseRazpayamakFailureCode(response?.Value) ??
    parseRazpayamakFailureCode(response?.ReqStatus);

  const providerDetail = sanitizeProviderDetail(response?.Message);

  if (parsed !== null) {
    return {
      status: 'FAILED',
      failureReason: `RazPayamak rejected the request with code ${parsed.providerCode}.`,
      failureCode: parsed.code,
      providerCode: parsed.providerCode,
      ...(providerDetail === undefined ? {} : { providerDetail }),
    };
  }

  return {
    status: 'FAILED',
    failureReason: `RazPayamak rejected the request with HTTP status ${httpStatus}.`,
    failureCode: 'UNKNOWN_PROVIDER_ERROR',
    ...(providerDetail === undefined ? {} : { providerDetail }),
  };
};

export type RazpayamakProviderDependencies = {
  /** Injected transport. Defaults to the platform `fetch`. */
  httpClient?: CommunicationHttpClient;
  /** Injected configuration. Defaults to reading the app variables. */
  getConfig?: () => RazpayamakConfig;
  /**
   * Test-only endpoint override. Production ALWAYS uses the fixed official
   * endpoint; there is deliberately no workspace-controlled URL, so an API Key
   * can never be redirected to an arbitrary host.
   */
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
    this.sendUrl = dependencies.sendUrl ?? RAZPAYAMAK_SEND_URL;
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
    } catch {
      // A transport rejection after dispatch is NOT a definite failure: the
      // provider may have received the request. The raw error is never
      // interpolated (it can embed the credential-bearing body).
      return {
        status: 'UNKNOWN',
        failureReason: 'The RazPayamak request could not be completed.',
      };
    }

    let rawBody: string;

    try {
      rawBody = await response.text();
    } catch {
      // The status was received but the body could not be read: the request
      // definitely reached the provider, so the outcome is unknown.
      return {
        status: 'UNKNOWN',
        failureReason: 'The RazPayamak response could not be read.',
      };
    }

    const parsed = parseResponse(rawBody);

    if (!response.ok) {
      // A documented HTTP 400 with a `ReqStatus` is a definite rejection.
      if (parsed !== undefined) {
        return buildDefiniteFailure(parsed, response.status);
      }

      // An HTTP error we cannot interpret is not a definite send outcome.
      return {
        status: 'UNKNOWN',
        failureReason: `RazPayamak returned an unreadable error response (HTTP ${response.status}).`,
      };
    }

    if (parsed === undefined) {
      // A 2xx that is not valid JSON may still have sent the message.
      return {
        status: 'UNKNOWN',
        failureReason: 'RazPayamak returned a non-JSON response.',
      };
    }

    // The document defines `RetStatus: 1` as success; anything else is a
    // provider-declared, definite failure.
    if (parsed.RetStatus !== 1) {
      return buildDefiniteFailure(parsed, response.status);
    }

    // STRICT success: a `RetStatus=1` without a usable recID cannot be trusted
    // as "sent" (a missing/empty/invalid id is an inconsistent response).
    const recId = readUsableRecId(parsed.Value);

    if (recId === null) {
      return {
        status: 'UNKNOWN',
        failureReason:
          'RazPayamak accepted the request but returned no usable message id.',
      };
    }

    return { status: 'SENT', providerMessageId: recId };
  }
}
