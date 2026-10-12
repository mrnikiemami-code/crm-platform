import { RAZPAYAMAK_DELIVERY_URL } from 'src/providers/razpayamak/razpayamak.config';
import { type RazpayamakConfig } from 'src/providers/razpayamak/razpayamak.config';
import { getRazpayamakConfig } from 'src/providers/razpayamak/razpayamak.config';
import {
  parseRazpayamakDeliveryStatus,
  type RazpayamakDeliveryState,
} from 'src/providers/razpayamak/razpayamak-delivery';
import {
  type CommunicationHttpClient,
  defaultCommunicationHttpClient,
} from 'src/providers/http/communication-http-client';

// RazPayamak `GetDeliveries2` response envelope.
type RazpayamakDeliveryEnvelope = {
  Value?: string | number;
  RetStatus?: number;
  StrRetStatus?: string;
  Message?: string;
};

export type RazpayamakDeliveryLookup =
  | {
      success: true;
      state: RazpayamakDeliveryState;
      providerCode?: number;
    }
  | {
      success: false;
      /** `NOT_CONFIGURED` never reached the provider; `LOOKUP_FAILED` is unknown. */
      failureCode: 'NOT_CONFIGURED' | 'LOOKUP_FAILED';
    };

export type RazpayamakDeliveryDependencies = {
  httpClient?: CommunicationHttpClient;
  getConfig?: () => RazpayamakConfig;
  /** Test-only endpoint override; production uses the fixed constant. */
  deliveryUrl?: string;
};

/**
 * Looks up the delivery status of ONE previously-accepted message by its recID.
 *
 * Read-only: it never sends, and a failed lookup is reported as a failure — it
 * is never presented as "delivered". A transport or parse problem is
 * `LOOKUP_FAILED` (unknown), never a definite delivery state.
 */
export const lookupRazpayamakDelivery = async (
  recId: string,
  dependencies: RazpayamakDeliveryDependencies = {},
): Promise<RazpayamakDeliveryLookup> => {
  let config: RazpayamakConfig;

  try {
    config =
      dependencies.getConfig?.() ??
      (() => {
        const result = getRazpayamakConfig();

        if (!result.success) {
          throw new Error(result.error);
        }

        return result.config;
      })();
  } catch {
    return { success: false, failureCode: 'NOT_CONFIGURED' };
  }

  const httpClient =
    dependencies.httpClient ?? defaultCommunicationHttpClient;
  const url = dependencies.deliveryUrl ?? RAZPAYAMAK_DELIVERY_URL;

  let rawBody: string;

  try {
    const response = await httpClient({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        username: config.username,
        password: config.apiKey,
        recID: recId,
      }),
    });

    rawBody = await response.text();
  } catch {
    // The raw error is never interpolated: it can embed the credential body.
    return { success: false, failureCode: 'LOOKUP_FAILED' };
  }

  let envelope: RazpayamakDeliveryEnvelope;

  try {
    const parsed = JSON.parse(rawBody) as unknown;

    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, failureCode: 'LOOKUP_FAILED' };
    }

    envelope = parsed as RazpayamakDeliveryEnvelope;
  } catch {
    return { success: false, failureCode: 'LOOKUP_FAILED' };
  }

  // The document defines `RetStatus: 1` as a successful lookup.
  if (envelope.RetStatus !== 1) {
    return { success: false, failureCode: 'LOOKUP_FAILED' };
  }

  const parsedStatus = parseRazpayamakDeliveryStatus(envelope.Value);

  if (parsedStatus.state === 'LOOKUP_FAILED') {
    return { success: false, failureCode: 'LOOKUP_FAILED' };
  }

  return {
    success: true,
    state: parsedStatus.state,
    ...(parsedStatus.providerCode === undefined
      ? {}
      : { providerCode: parsedStatus.providerCode }),
  };
};
