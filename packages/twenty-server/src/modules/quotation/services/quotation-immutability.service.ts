import { Injectable } from '@nestjs/common';
import { isDefined } from 'twenty-shared/utils';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import {
  evaluateQuotationDelete,
  evaluateQuotationLineMutation,
  evaluateQuotationUpdate,
  type QuotationImmutabilityDecision,
} from 'src/modules/quotation/utils/quotation-immutability.util';

type QuotationStatusRow = {
  id: string;
  status: string;
};

type QuotationLineRow = {
  id: string;
  quotationId: string;
};

@Injectable()
export class QuotationImmutabilityService {
  constructor(private readonly workspaceOrmManager: WorkspaceOrmManager) {}

  async assertQuotationUpdateAllowed({
    authContext,
    quotationId,
    patch,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
    patch: Record<string, unknown>;
  }): Promise<void> {
    const status = await this.readQuotationStatus(authContext, quotationId);

    this.throwUnlessOk(
      evaluateQuotationUpdate({ currentStatus: status, patch }),
    );
  }

  async assertQuotationDeleteAllowed({
    authContext,
    quotationId,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
  }): Promise<void> {
    const status = await this.readQuotationStatus(authContext, quotationId);

    this.throwUnlessOk(evaluateQuotationDelete({ currentStatus: status }));
  }

  async assertQuotationLineMutationAllowed({
    authContext,
    quotationId,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
  }): Promise<void> {
    const status = await this.readQuotationStatus(authContext, quotationId);

    this.throwUnlessOk(evaluateQuotationLineMutation({ parentStatus: status }));
  }

  async assertQuotationLineMutationAllowedByLineId({
    authContext,
    quotationLineId,
  }: {
    authContext: WorkspaceAuthContext;
    quotationLineId: string;
  }): Promise<void> {
    const quotationId = await this.readLineQuotationId(
      authContext,
      quotationLineId,
    );

    await this.assertQuotationLineMutationAllowed({
      authContext,
      quotationId,
    });
  }

  private async readQuotationStatus(
    authContext: WorkspaceAuthContext,
    quotationId: string,
  ): Promise<string> {
    return this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      const repository = this.workspaceOrmManager.getRepository<QuotationStatusRow>(
        'quotation',
        { shouldBypassPermissionChecks: true },
      );
      const row = await repository.findOne({
        where: { id: quotationId },
        select: { id: true, status: true },
      });

      if (!isDefined(row) || typeof row.status !== 'string') {
        throw new QuotationQueryValidationException(
          'quotation not found',
          QuotationQueryValidationExceptionCode.FORBIDDEN,
        );
      }

      return row.status;
    }, authContext);
  }

  private async readLineQuotationId(
    authContext: WorkspaceAuthContext,
    quotationLineId: string,
  ): Promise<string> {
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

      return row.quotationId;
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
