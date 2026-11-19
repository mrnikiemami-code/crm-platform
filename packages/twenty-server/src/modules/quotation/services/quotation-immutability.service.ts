import { Injectable } from '@nestjs/common';
import { isDefined } from 'twenty-shared/utils';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import {
  evaluateQuotationDelete,
  evaluateQuotationLineMutation,
  evaluateQuotationLineReassignment,
  evaluateQuotationUpdate,
  type QuotationImmutabilityDecision,
  type QuotationPermission,
} from 'src/modules/quotation/utils/quotation-immutability.util';

type QuotationStatusRow = {
  id: string;
  status: string;
  version: number | null;
};

type QuotationLineRow = {
  id: string;
  quotationId: string;
};

@Injectable()
export class QuotationImmutabilityService {
  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly quotationPermissionService: QuotationPermissionService,
  ) {}

  async assertQuotationUpdateAllowed({
    authContext,
    quotationId,
    patch,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
    patch: Record<string, unknown>;
  }): Promise<void> {
    const [row, heldPermissions] = await Promise.all([
      this.readQuotationRow(authContext, quotationId),
      this.quotationPermissionService.resolveHeldPermissions(authContext),
    ]);

    this.throwUnlessOk(
      evaluateQuotationUpdate({
        currentStatus: row.status,
        currentVersion: row.version,
        patch,
        heldPermissions,
      }),
    );
  }

  async assertQuotationDeleteAllowed({
    authContext,
    quotationId,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
  }): Promise<void> {
    const [row, heldPermissions] = await Promise.all([
      this.readQuotationRow(authContext, quotationId),
      this.quotationPermissionService.resolveHeldPermissions(authContext),
    ]);

    this.throwUnlessOk(
      evaluateQuotationDelete({
        currentStatus: row.status,
        heldPermissions,
      }),
    );
  }

  async assertQuotationLineMutationAllowed({
    authContext,
    quotationId,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
  }): Promise<void> {
    const [row, heldPermissions] = await Promise.all([
      this.readQuotationRow(authContext, quotationId),
      this.quotationPermissionService.resolveHeldPermissions(authContext),
    ]);

    this.throwUnlessOk(
      evaluateQuotationLineMutation({
        parentStatus: row.status,
        heldPermissions,
      }),
    );
  }

  async assertQuotationLineMutationAllowedByLineId({
    authContext,
    quotationLineId,
    patch,
  }: {
    authContext: WorkspaceAuthContext;
    quotationLineId: string;
    patch?: Record<string, unknown>;
  }): Promise<void> {
    const line = await this.readLineRow(authContext, quotationLineId);

    this.throwUnlessOk(
      evaluateQuotationLineReassignment({
        currentQuotationId: line.quotationId,
        nextQuotationId: patch?.quotationId,
      }),
    );

    await this.assertQuotationLineMutationAllowed({
      authContext,
      quotationId: line.quotationId,
    });
  }

  private async readQuotationRow(
    authContext: WorkspaceAuthContext,
    quotationId: string,
  ): Promise<QuotationStatusRow> {
    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const repository =
        this.workspaceOrmManager.getRepository<QuotationStatusRow>(
          'quotation',
          { shouldBypassPermissionChecks: true },
        );
      const row = await repository.findOne({
        where: { id: quotationId },
        select: { id: true, status: true, version: true },
      });

      if (!isDefined(row) || typeof row.status !== 'string') {
        throw new QuotationQueryValidationException(
          'quotation not found',
          QuotationQueryValidationExceptionCode.FORBIDDEN,
        );
      }

      return {
        id: row.id,
        status: row.status,
        version: typeof row.version === 'number' ? row.version : null,
      };
    }, authContext);
  }

  private async readLineRow(
    authContext: WorkspaceAuthContext,
    quotationLineId: string,
  ): Promise<QuotationLineRow> {
    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const repository = this.workspaceOrmManager.getRepository<QuotationLineRow>(
        'quotationLine',
        { shouldBypassPermissionChecks: true },
      );
      const row = await repository.findOne({
        where: { id: quotationLineId },
        select: { id: true, quotationId: true },
      });

      if (!isDefined(row) || typeof row.quotationId !== 'string') {
        throw new QuotationQueryValidationException(
          'quotation line not found',
          QuotationQueryValidationExceptionCode.FORBIDDEN,
        );
      }

      return row;
    }, authContext);
  }

  private throwUnlessOk(decision: QuotationImmutabilityDecision): void {
    if (decision.ok) {
      return;
    }

    throw new QuotationQueryValidationException(
      `${decision.code}: ${decision.message}`,
      QuotationQueryValidationExceptionCode.FORBIDDEN,
    );
  }
}

export type { QuotationPermission };
