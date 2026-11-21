import { Injectable } from '@nestjs/common';
import { isNonEmptyString } from 'twenty-shared/utils';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

export type QuotationOutboundSendRequest = {
  channel: 'BALE';
  providerId: 'bale';
  recipient: string;
  body: string;
  targetPersonId: string | null;
  sourceRecordId: string;
  authorizationHeader: string | null;
};

export type QuotationOutboundSendResult =
  | {
      success: true;
      communicationId: string;
      providerId: string;
      sendStatus: 'SENT' | 'DELIVERED';
      providerMessageId: string | null;
    }
  | {
      success: false;
      failureCode: string;
      error: string;
      communicationId: string | null;
      providerId: string | null;
      sendStatus: string | null;
    };

// Thin Nest → Communication bridge. The durable send still happens inside the
// communication app via Provider Registry + Send/Persist; Nest must not call
// Bale HTTP itself.
@Injectable()
export class QuotationCommunicationOutboundService {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  async sendOutbound(
    request: QuotationOutboundSendRequest,
  ): Promise<QuotationOutboundSendResult> {
    const base = this.resolveServerBaseUrl();

    if (!isNonEmptyString(request.authorizationHeader)) {
      return {
        success: false,
        failureCode: 'AUTH_REQUIRED',
        error: 'Authorization is required to dispatch through Communication.',
        communicationId: null,
        providerId: null,
        sendStatus: null,
      };
    }

    const response = await fetch(
      `${base}/s/communication/send-outbound-message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: request.authorizationHeader,
        },
        body: JSON.stringify({
          channel: request.channel,
          providerId: request.providerId,
          recipient: request.recipient,
          body: request.body,
          targetPersonId: request.targetPersonId,
          sourceRecordId: request.sourceRecordId,
        }),
      },
    );

    const text = await response.text();
    let payload: Record<string, unknown>;

    try {
      payload =
        text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {
        success: false,
        failureCode: 'UNEXPECTED',
        error: 'Communication send returned a non-JSON response.',
        communicationId: null,
        providerId: null,
        sendStatus: null,
      };
    }

    if (payload.success === true) {
      return {
        success: true,
        communicationId:
          typeof payload.communicationId === 'string'
            ? payload.communicationId
            : '',
        providerId:
          typeof payload.providerId === 'string' ? payload.providerId : 'bale',
        sendStatus: payload.sendStatus === 'DELIVERED' ? 'DELIVERED' : 'SENT',
        providerMessageId:
          typeof payload.providerMessageId === 'string'
            ? payload.providerMessageId
            : null,
      };
    }

    return {
      success: false,
      failureCode:
        typeof payload.failureCode === 'string'
          ? payload.failureCode
          : 'PROVIDER_FAILED',
      error:
        typeof payload.error === 'string'
          ? payload.error
          : 'Communication send failed.',
      communicationId:
        typeof payload.communicationId === 'string'
          ? payload.communicationId
          : null,
      providerId:
        typeof payload.providerId === 'string' ? payload.providerId : null,
      sendStatus:
        typeof payload.sendStatus === 'string' ? payload.sendStatus : null,
    };
  }

  private resolveServerBaseUrl(): string {
    // Same Nest process serves `/s/communication/*`. Prefer the container /
    // process listen port on loopback — host-mapped SERVER_URL (:3002) is not
    // reachable from inside Docker and must not be used for this bridge.
    const port = String(
      this.twentyConfigService.get('NODE_PORT') ?? '3000',
    ).trim();
    const listenPort = /^\d+$/.test(port) ? port : '3000';

    return `http://127.0.0.1:${listenPort}`;
  }
}
