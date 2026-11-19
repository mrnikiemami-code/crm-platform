import { Injectable } from '@nestjs/common';
import { isDefined, isNonEmptyString } from 'twenty-shared/utils';

import { type ActorMetadata, FieldActorSource } from 'twenty-shared/types';

import { buildCreatedByFromApiKey } from 'src/engine/core-modules/actor/utils/build-created-by-from-api-key.util';
import { buildCreatedByFromFullNameMetadata } from 'src/engine/core-modules/actor/utils/build-created-by-from-full-name-metadata.util';
import { isApiKeyAuthContext } from 'src/engine/core-modules/auth/guards/is-api-key-auth-context.guard';
import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationCommunicationOutboundService } from 'src/modules/quotation/services/quotation-communication-outbound.service';
import { QuotationCustomerLinkService } from 'src/modules/quotation/services/quotation-customer-link.service';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import {
  buildQuotationShareDetail,
  buildQuotationShareMessage,
  isQuotationShareChannel,
  isValidBaleChatId,
  QUOTATION_SHARE_CHANNEL_LABELS,
  type QuotationShareChannel,
  type QuotationShareOutcome,
  resolveQuotationShareDelivery,
} from 'src/modules/quotation/utils/quotation-share.util';

type QuotationShareSourceRow = {
  id: string;
  status: string;
  quotationNumber: string | null;
  name: string | null;
  personId: string | null;
  companyId: string | null;
};

type CompanyNameRow = {
  id: string;
  name: string | null;
};

type PersonNameRow = {
  id: string;
  nameFirstName: string | null;
  nameLastName: string | null;
};

export type QuotationShareResult = {
  shareId: string;
  quotationId: string;
  channel: QuotationShareChannel;
  channelLabel: string;
  outcome: QuotationShareOutcome;
  deliveryKind: 'MANUAL_SHARE' | 'PROVIDER';
  linkId: string;
  viewUrl: string;
  shareText: string;
  customerLabel: string;
  customerPersonId: string | null;
  customerCompanyId: string | null;
  communicationId: string | null;
  providerId: string | null;
  providerMessageId: string | null;
  message: string;
};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

@Injectable()
export class QuotationShareService {
  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly quotationPermissionService: QuotationPermissionService,
    private readonly quotationCustomerLinkService: QuotationCustomerLinkService,
    private readonly quotationCommunicationOutboundService: QuotationCommunicationOutboundService,
  ) {}

  async shareQuotation({
    authContext,
    quotationId,
    channel: rawChannel,
    ttlHours,
    chatId: rawChatId,
    authorizationHeader,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
    channel: string;
    ttlHours?: number;
    chatId?: string;
    authorizationHeader?: string | null;
  }): Promise<QuotationShareResult> {
    this.assertActorMayShare(authContext);

    const heldPermissions =
      await this.quotationPermissionService.resolveHeldPermissions(authContext);

    if (!heldPermissions.includes('quotation.send')) {
      throw new QuotationQueryValidationException(
        'PERMISSION_MISSING: quotation.send is required to share a quotation',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    const channel = rawChannel.trim().toUpperCase();

    if (!isQuotationShareChannel(channel)) {
      throw new QuotationQueryValidationException(
        'INVALID_INPUT: unsupported share channel',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    const delivery = resolveQuotationShareDelivery(channel);
    const quotation = await this.readQuotation(authContext, quotationId);
    const customer = await this.resolveCustomer(authContext, quotation);

    if (delivery.kind === 'PROVIDER') {
      await this.assertNoDuplicateProviderSend({
        authContext,
        quotationId: quotation.id,
        channel,
      });

      const chatId = readString(rawChatId);

      if (!isValidBaleChatId(chatId)) {
        throw new QuotationQueryValidationException(
          'INVALID_INPUT: a valid numeric Bale chat_id is required',
          QuotationQueryValidationExceptionCode.FORBIDDEN,
        );
      }
    }

    // Mint uses the same customer-link path (permission + status gates).
    const link = await this.quotationCustomerLinkService.createCustomerLink({
      authContext,
      quotationId: quotation.id,
      ttlHours,
    });

    const shareText = buildQuotationShareMessage({
      channel,
      quotationNumber: quotation.quotationNumber,
      quotationTitle: quotation.name,
      customerLabel: customer.label,
      viewUrl: link.viewUrl,
    });

    let outcome: QuotationShareOutcome = 'MANUAL_SHARE';
    let communicationId: string | null = null;
    let providerId: string | null = null;
    let providerMessageId: string | null = null;
    let message =
      'اتصال خودکار این کانال فعال نیست. متن و لینک برای اشتراک‌گذاری دستی آماده شد؛ ارسال موفق ثبت نشد.';

    if (delivery.kind === 'PROVIDER') {
      const chatId = readString(rawChatId);
      const outbound =
        await this.quotationCommunicationOutboundService.sendOutbound({
          channel: delivery.communicationChannel,
          providerId: delivery.providerId,
          recipient: chatId,
          body: shareText,
          targetPersonId: customer.personId,
          sourceRecordId: quotation.id,
          authorizationHeader: authorizationHeader ?? null,
        });

      providerId = delivery.providerId;

      if (
        outbound.success === true &&
        (outbound.sendStatus === 'SENT' || outbound.sendStatus === 'DELIVERED')
      ) {
        outcome = 'PROVIDER_SENT';
        communicationId = outbound.communicationId;
        providerMessageId = outbound.providerMessageId;
        message =
          'پیش‌فاکتور از طریق بله ارسال شد و نتیجهٔ واقعی در تاریخچه ثبت شد.';
      } else {
        outcome = 'PROVIDER_FAILED';
        communicationId = outbound.success === false ? outbound.communicationId : null;
        message =
          outbound.success === false
            ? outbound.error
            : 'ارسال بله ناموفق بود؛ ارسال موفق ثبت نشد.';
      }
    }

    const detail = buildQuotationShareDetail({
      channel,
      quotationId: quotation.id,
      linkId: link.linkId,
      outcome,
      providerMessageId,
    });
    const occurredAt = new Date();
    const actor = this.resolveActorMetadata(authContext);
    const channelLabel = QUOTATION_SHARE_CHANNEL_LABELS[channel];
    const numberLabel =
      typeof quotation.quotationNumber === 'string' &&
      quotation.quotationNumber.trim() !== ''
        ? quotation.quotationNumber.trim()
        : quotation.id.slice(0, 8);

    const created = await this.workspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository = this.workspaceOrmManager.getRepository(
          'quotationShare',
          { shouldBypassPermissionChecks: true },
        );

        return repository.insert({
          name: `اشتراک ${channelLabel} ${numberLabel}`,
          channel,
          outcome,
          customerLabel: customer.label,
          customerPersonId: customer.personId,
          customerCompanyId: customer.companyId,
          linkId: link.linkId,
          communicationId,
          providerId,
          detail,
          occurredAt,
          quotationId: quotation.id,
          position: 0,
          createdBy: actor,
          updatedBy: actor,
        } as never);
      },
      authContext,
    );

    const shareId = readString(
      (created as { identifiers?: Array<{ id?: unknown }> })?.identifiers?.[0]
        ?.id,
    );

    if (shareId === '') {
      throw new QuotationQueryValidationException(
        'QUOTATION_SHARE_CREATE_FAILED: could not create share history row',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    return {
      shareId,
      quotationId: quotation.id,
      channel,
      channelLabel,
      outcome,
      deliveryKind: delivery.kind === 'PROVIDER' ? 'PROVIDER' : 'MANUAL_SHARE',
      linkId: link.linkId,
      viewUrl: link.viewUrl,
      shareText,
      customerLabel: customer.label,
      customerPersonId: customer.personId,
      customerCompanyId: customer.companyId,
      communicationId,
      providerId,
      providerMessageId,
      message,
    };
  }

  private async assertNoDuplicateProviderSend({
    authContext,
    quotationId,
    channel,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
    channel: QuotationShareChannel;
  }): Promise<void> {
    const existing = await this.workspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository = this.workspaceOrmManager.getRepository<{
          id: string;
          outcome: string;
        }>('quotationShare', { shouldBypassPermissionChecks: true });

        return repository.findOne({
          where: {
            quotationId,
            channel,
            outcome: 'PROVIDER_SENT',
          } as never,
          select: { id: true, outcome: true },
          order: { createdAt: 'DESC' } as never,
        });
      },
      authContext,
    );

    if (isDefined(existing)) {
      throw new QuotationQueryValidationException(
        'DUPLICATE_SHARE: this quotation was already sent on this channel',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }
  }

  private assertActorMayShare(authContext: WorkspaceAuthContext): void {
    if (authContext.type === 'user' || authContext.type === 'apiKey') {
      return;
    }

    throw new QuotationQueryValidationException(
      'AUTH_REQUIRED: quotation share requires a signed-in user or API key',
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }

  private resolveActorMetadata(
    authContext: WorkspaceAuthContext,
  ): ActorMetadata {
    if (isUserAuthContext(authContext)) {
      return buildCreatedByFromFullNameMetadata({
        fullNameMetadata: authContext.workspaceMember.name,
        workspaceMemberId: authContext.workspaceMemberId,
        source: FieldActorSource.MANUAL,
      });
    }

    if (isApiKeyAuthContext(authContext)) {
      return buildCreatedByFromApiKey({
        apiKey: authContext.apiKey,
      });
    }

    throw new QuotationQueryValidationException(
      'AUTH_REQUIRED: quotation share requires a signed-in user or API key',
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }

  private async readQuotation(
    authContext: WorkspaceAuthContext,
    quotationId: string,
  ): Promise<QuotationShareSourceRow> {
    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const repository =
        this.workspaceOrmManager.getRepository<QuotationShareSourceRow>(
          'quotation',
          { shouldBypassPermissionChecks: true },
        );
      const row = await repository.findOne({
        where: { id: quotationId },
        select: {
          id: true,
          status: true,
          quotationNumber: true,
          name: true,
          personId: true,
          companyId: true,
        },
      });

      if (!isDefined(row) || typeof row.status !== 'string') {
        throw new QuotationQueryValidationException(
          'QUOTATION_NOT_FOUND: quotation not found',
          QuotationQueryValidationExceptionCode.FORBIDDEN,
        );
      }

      return row;
    }, authContext);
  }

  private async resolveCustomer(
    authContext: WorkspaceAuthContext,
    quotation: QuotationShareSourceRow,
  ): Promise<{
    label: string;
    personId: string | null;
    companyId: string | null;
  }> {
    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      if (isNonEmptyString(quotation.companyId)) {
        const company =
          await this.workspaceOrmManager.getRepository<CompanyNameRow>(
            'company',
            { shouldBypassPermissionChecks: true },
          ).findOne({
            where: { id: quotation.companyId },
            select: { id: true, name: true },
          });

        return {
          label: isNonEmptyString(company?.name) ? company.name : '—',
          personId: null,
          companyId: quotation.companyId,
        };
      }

      if (isNonEmptyString(quotation.personId)) {
        const person =
          await this.workspaceOrmManager.getRepository<PersonNameRow>(
            'person',
            { shouldBypassPermissionChecks: true },
          ).findOne({
            where: { id: quotation.personId },
            select: {
              id: true,
              nameFirstName: true,
              nameLastName: true,
            },
          });

        const firstName = isNonEmptyString(person?.nameFirstName)
          ? person.nameFirstName
          : '';
        const lastName = isNonEmptyString(person?.nameLastName)
          ? person.nameLastName
          : '';
        const personName = `${firstName} ${lastName}`.trim();

        return {
          label: isNonEmptyString(personName) ? personName : '—',
          personId: quotation.personId,
          companyId: null,
        };
      }

      return { label: '—', personId: null, companyId: null };
    }, authContext);
  }
}
