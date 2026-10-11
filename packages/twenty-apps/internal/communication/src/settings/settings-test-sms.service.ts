import { createCommunicationProviderRegistry } from 'src/providers/register-communication-providers';
import { type CommunicationProviderId } from 'src/providers/types/communication-provider-id.type';
import { type CommunicationSendResult } from 'src/providers/types/communication-send-result.type';
import { CommunicationSendService } from 'src/services/communication-send.service';
import {
  isUsableMessageBody,
  normalizeSmsRecipient,
} from 'src/settings/sms-recipient';

export type SettingsTestSmsFailureCode =
  | 'INVALID_RECIPIENT'
  | 'EMPTY_MESSAGE'
  | 'NOT_CONFIGURED'
  | 'PROVIDER_FAILED'
  | 'OUTCOME_UNKNOWN'
  | 'UNEXPECTED_FAILURE';

export type SettingsTestSmsResponse = {
  success: boolean;
  /** Present only on a definite success. Never upgraded to DELIVERED. */
  status?: 'SENT';
  /** Provider recID returned by the document's `Value` on success. */
  providerMessageId?: string;
  /** Stable provider failure classification (e.g. a RazPayamak `Value` code). */
  providerFailureCode?: string;
  /** Sanitized, untrusted provider text. Never presented as translated copy. */
  providerDetail?: string;
  /** Numeric provider code, when the provider supplies one. */
  providerCode?: number;
  /**
   * Whether the provider outcome is known. `false` means the request may or
   * may not have reached the provider; the UI must not claim a definite
   * failure and must not retry automatically.
   */
  isOutcomeKnown?: boolean;
  failureCode?: SettingsTestSmsFailureCode;
  message?: string;
  error?: string;
};

export type SettingsTestSmsDependencies = {
  /** Provider registry override; tests inject stub providers. */
  registry?: ReturnType<typeof createCommunicationProviderRegistry>;
  /**
   * Provider used for the test send. Defaults to `razpayamak`, because this
   * panel belongs to the RazPayamak card: it must send through RazPayamak's
   * saved configuration, not whichever provider happens to be the workspace
   * default.
   */
  providerId?: CommunicationProviderId;
};

/**
 * Sends ONE test SMS from the workspace settings.
 *
 * Deliberately NOT the durable Person path: a settings test has no Person, so
 * it must not create a fake Person, must not write a Communication record for
 * an arbitrary number, and must not produce a Person timeline activity. It
 * sends exactly once through the same provider registry and provider contract
 * the production path uses, and never retries.
 */
export const sendSettingsTestSms = async (
  parameters: { recipient: string; body: string },
  dependencies: SettingsTestSmsDependencies = {},
): Promise<SettingsTestSmsResponse> => {
  const recipient = normalizeSmsRecipient(parameters.recipient);

  if (recipient === null) {
    return {
      success: false,
      failureCode: 'INVALID_RECIPIENT',
      isOutcomeKnown: true,
      error: 'A valid recipient mobile number is required.',
    };
  }

  if (!isUsableMessageBody(parameters.body)) {
    return {
      success: false,
      failureCode: 'EMPTY_MESSAGE',
      isOutcomeKnown: true,
      error: 'Message text is required.',
    };
  }

  const registry =
    dependencies.registry ?? createCommunicationProviderRegistry();
  const sendService = new CommunicationSendService(registry);
  const providerId = dependencies.providerId ?? 'razpayamak';

  let result: CommunicationSendResult;

  try {
    result = await sendService.send(
      {
        channel: 'SMS',
        recipient,
        body: parameters.body,
      },
      { providerId },
    );
  } catch {
    // Configuration or programming failure before a provider result. The raw
    // exception is never surfaced (it can carry a credential-bearing body).
    return {
      success: false,
      failureCode: 'NOT_CONFIGURED',
      isOutcomeKnown: true,
      error:
        'The selected provider is not configured. Set its variables and try again.',
    };
  }

  if (result.status === 'FAILED') {
    return {
      success: false,
      failureCode: 'PROVIDER_FAILED',
      isOutcomeKnown: true,
      error: result.failureReason,
      ...(result.failureCode === undefined
        ? {}
        : { providerFailureCode: result.failureCode }),
      ...(result.providerDetail === undefined
        ? {}
        : { providerDetail: result.providerDetail }),
      ...(result.providerCode === undefined
        ? {}
        : { providerCode: result.providerCode }),
    };
  }

  if (result.status === 'UNKNOWN') {
    return {
      success: false,
      failureCode: 'OUTCOME_UNKNOWN',
      isOutcomeKnown: false,
      error:
        'The message may or may not have been sent. Check the provider panel before retrying.',
    };
  }

  // `DELIVERED` is impossible here (the provider reports it only when it can
  // confirm delivery at send time); only `SENT` is a truthful success.
  return {
    success: true,
    status: 'SENT',
    providerMessageId: result.providerMessageId ?? undefined,
    isOutcomeKnown: true,
  };
};
