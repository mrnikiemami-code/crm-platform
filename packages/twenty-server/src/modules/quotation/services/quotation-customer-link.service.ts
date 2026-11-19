import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { isDefined } from 'twenty-shared/utils';

import { type ActorMetadata, FieldActorSource } from 'twenty-shared/types';

import { buildCreatedByFromApiKey } from 'src/engine/core-modules/actor/utils/build-created-by-from-api-key.util';
import { buildCreatedByFromFullNameMetadata } from 'src/engine/core-modules/actor/utils/build-created-by-from-full-name-metadata.util';
import { isApiKeyAuthContext } from 'src/engine/core-modules/auth/guards/is-api-key-auth-context.guard';
import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';

const CUSTOMER_LINKABLE_STATUSES = [
  'READY_TO_SEND',
  'SENT',
  'CUSTOMER_ACCEPTED',
  'CUSTOMER_REJECTED',
] as const;

const DEFAULT_TTL_HOURS = 168;
const MAX_TTL_HOURS = 24 * 90;
const TOKEN_BYTES = 32;

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

type QuotationLinkSourceRow = {
  id: string;
  status: string;
  quotationNumber: string | null;
  name: string | null;
};

type QuotationCustomerLinkRow = {
  id: string;
  tokenHash: string;
  expiresAt: Date | string;
  revokedAt: Date | string | null;
  quotationId: string;
};

export type CreatedCustomerLinkResult = {
  linkId: string;
  quotationId: string;
  expiresAt: string;
  rawToken: string;
  viewUrl: string;
  message: string;
};

export type RevokedCustomerLinkResult = {
  linkId: string;
  quotationId: string;
  revokedAt: string;
  message: string;
};

@Injectable()
export class QuotationCustomerLinkService {
  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly quotationPermissionService: QuotationPermissionService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  async createCustomerLink({
    authContext,
    quotationId,
    ttlHours = DEFAULT_TTL_HOURS,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
    ttlHours?: number;
  }): Promise<CreatedCustomerLinkResult> {
    this.assertActorMayManageCustomerLinks(authContext);

    const heldPermissions =
      await this.quotationPermissionService.resolveHeldPermissions(authContext);

    if (!heldPermissions.includes('quotation.send')) {
      throw new QuotationQueryValidationException(
        'PERMISSION_MISSING: quotation.send is required to issue a customer link',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    if (
      !Number.isFinite(ttlHours) ||
      ttlHours <= 0 ||
      ttlHours > MAX_TTL_HOURS
    ) {
      throw new QuotationQueryValidationException(
        'INVALID_INPUT: ttlHours must be between 1 and 2160',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
    const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken, 'utf8').digest('hex');

    const quotation = await this.readQuotation(authContext, quotationId);

    if (
      !(CUSTOMER_LINKABLE_STATUSES as readonly string[]).includes(
        quotation.status,
      )
    ) {
      throw new QuotationQueryValidationException(
        'CUSTOMER_LINK_STATUS_FORBIDDEN: customer links require a ready/sent/decided quotation',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    const numberLabel =
      typeof quotation.quotationNumber === 'string' &&
      quotation.quotationNumber.trim() !== ''
        ? quotation.quotationNumber.trim()
        : quotation.id.slice(0, 8);

    const actor = this.resolveActorMetadata(authContext);

    const created = await this.workspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository =
          this.workspaceOrmManager.getRepository<QuotationCustomerLinkRow>(
            'quotationCustomerLink',
            { shouldBypassPermissionChecks: true },
          );

        return repository.insert({
          name: `لینک مشتری ${numberLabel}`,
          tokenHash,
          expiresAt,
          issuedAt: now,
          revokedAt: null,
          quotationId: quotation.id,
          position: 0,
          createdBy: actor,
          updatedBy: actor,
        } as never);
      },
      authContext,
    );

    const linkId = readString(
      (created as { identifiers?: Array<{ id?: unknown }> })?.identifiers?.[0]
        ?.id,
    );

    if (linkId === '') {
      throw new QuotationQueryValidationException(
        'CUSTOMER_LINK_CREATE_FAILED: could not create link row',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    return {
      linkId,
      quotationId: quotation.id,
      expiresAt: expiresAt.toISOString(),
      rawToken,
      viewUrl: this.buildPublicViewUrl(rawToken),
      message: 'لینک مشتری صادر شد. این لینک را فقط یک‌بار کپی کنید.',
    };
  }

  async revokeCustomerLink({
    authContext,
    quotationId,
    linkId,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
    linkId: string;
  }): Promise<RevokedCustomerLinkResult> {
    this.assertActorMayManageCustomerLinks(authContext);

    const heldPermissions =
      await this.quotationPermissionService.resolveHeldPermissions(authContext);

    if (!heldPermissions.includes('quotation.send')) {
      throw new QuotationQueryValidationException(
        'PERMISSION_MISSING: quotation.send is required to revoke a customer link',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    const trimmedLinkId = linkId.trim();

    if (trimmedLinkId === '') {
      throw new QuotationQueryValidationException(
        'INVALID_INPUT: linkId is required',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    // Ensures the actor names a quotation that exists in this workspace before
    // touching the link row.
    await this.readQuotation(authContext, quotationId);

    const revokedAt = new Date();
    const actor = this.resolveActorMetadata(authContext);

    const updated = await this.workspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const repository =
          this.workspaceOrmManager.getRepository<QuotationCustomerLinkRow>(
            'quotationCustomerLink',
            { shouldBypassPermissionChecks: true },
          );
        const existing = await repository.findOne({
          where: { id: trimmedLinkId },
          select: {
            id: true,
            quotationId: true,
            revokedAt: true,
          },
        });

        if (!isDefined(existing)) {
          throw new QuotationQueryValidationException(
            'CUSTOMER_LINK_NOT_FOUND: customer link not found',
            QuotationQueryValidationExceptionCode.FORBIDDEN,
          );
        }

        if (existing.quotationId !== quotationId) {
          throw new QuotationQueryValidationException(
            'CUSTOMER_LINK_QUOTATION_MISMATCH: link does not belong to this quotation',
            QuotationQueryValidationExceptionCode.FORBIDDEN,
          );
        }

        await repository.update(trimmedLinkId, {
          revokedAt,
          updatedBy: actor,
        } as never);

        return { id: trimmedLinkId };
      },
      authContext,
    );

    return {
      linkId: updated.id,
      quotationId,
      revokedAt: revokedAt.toISOString(),
      message: 'لینک مشتری لغو شد.',
    };
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
      'AUTH_REQUIRED: customer links require a signed-in user or API key',
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }

  private assertActorMayManageCustomerLinks(
    authContext: WorkspaceAuthContext,
  ): void {
    // App tokens alone must not mint or revoke. The lifecycle panel uses the
    // signed-in user session bridge; API keys keep working for Dev scripts.
    if (authContext.type === 'user' || authContext.type === 'apiKey') {
      return;
    }

    throw new QuotationQueryValidationException(
      'AUTH_REQUIRED: customer links require a signed-in user or API key',
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }

  private async readQuotation(
    authContext: WorkspaceAuthContext,
    quotationId: string,
  ): Promise<QuotationLinkSourceRow> {
    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const repository =
        this.workspaceOrmManager.getRepository<QuotationLinkSourceRow>(
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

  private buildPublicViewUrl(rawToken: string): string {
    const configured = String(
      this.twentyConfigService.get('SERVER_URL') ?? '',
    ).replace(/\/$/, '');
    const base = configured.replace(
      /^(https?:\/\/)(127\.0\.0\.1|localhost):3000$/,
      '$1localhost:3002',
    );

    if (base === '') {
      throw new QuotationQueryValidationException(
        'API_URL_MISSING: SERVER_URL is required to build the customer link',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    return `${base}/s/quotation/customer-view?token=${encodeURIComponent(rawToken)}`;
  }
};
