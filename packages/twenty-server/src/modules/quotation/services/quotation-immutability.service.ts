import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { isDefined } from 'twenty-shared/utils';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import {
  QuotationQueryValidationException,
  QuotationQueryValidationExceptionCode,
} from 'src/modules/quotation/exceptions/quotation-query-validation.exception';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import {
  QUOTATION_CONTENT_MUTABLE_STATUSES,
  QUOTATION_SYSTEM_FIELD_NAMES,
  evaluateQuotationDelete,
  evaluateQuotationLineMutation,
  evaluateQuotationLineReassignment,
  evaluateQuotationUpdate,
  parseQuotationVersion,
  quotationUpdateTouchesProtectedState,
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
    const heldPermissions =
      await this.quotationPermissionService.resolveHeldPermissions(authContext);

    // Apply content + version (+ status) in one conditional UPDATE so a later
    // GraphQL write failure cannot leave a claimed status without content.
    await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      await this.workspaceOrmManager.runInWorkspaceTransaction(
        async (transactionScope) => {
          const repository = transactionScope.getRepository<QuotationStatusRow>(
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

          const currentVersion = parseQuotationVersion(row.version);

          this.throwUnlessOk(
            evaluateQuotationUpdate({
              currentStatus: row.status,
              currentVersion,
              patch,
              heldPermissions,
            }),
          );

          if (
            !quotationUpdateTouchesProtectedState({
              currentStatus: row.status,
              patch,
            })
          ) {
            return;
          }

          const observedVersion = parseQuotationVersion(patch.version);

          if (observedVersion === null || currentVersion === null) {
            throw new QuotationQueryValidationException(
              'QUOTATION_VERSION_REQUIRED: version is required when changing a quotation; reload and retry',
              QuotationQueryValidationExceptionCode.FORBIDDEN,
            );
          }

          // Actor composites (updatedBy) are stamped by the GraphQL writer; raw
          // ORM set() cannot expand them into source/name columns.
          const setColumns: Record<string, unknown> = Object.fromEntries(
            Object.entries(patch).filter(
              ([key, value]) =>
                value !== undefined &&
                key !== 'version' &&
                !QUOTATION_SYSTEM_FIELD_NAMES.has(key),
            ),
          );
          setColumns.version = observedVersion + 1;

          const result = await repository
            .createQueryBuilder()
            .where({
              id: quotationId,
              version: observedVersion,
              status: row.status,
            })
            .update()
            .set(setColumns)
            .returning(['id', 'version', 'status'])
            .execute();

          if (result.generatedMaps.length === 0) {
            throw new QuotationQueryValidationException(
              'QUOTATION_VERSION_CONFLICT: quotation was changed concurrently; reload the current version and retry',
              QuotationQueryValidationExceptionCode.FORBIDDEN,
            );
          }
        },
      );
    }, authContext);
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

    if (row.version === null) {
      throw new QuotationQueryValidationException(
        'QUOTATION_VERSION_REQUIRED: parent quotation version is unreadable; reload and retry',
        QuotationQueryValidationExceptionCode.FORBIDDEN,
      );
    }

    // Parent version claim only (no status mutation). Line insert/update still
    // runs after the hook; a failed line write can leave a bumped parent version.
    await this.claimQuotationVersion({
      authContext,
      quotationId,
      observedVersion: row.version,
      nextVersion: row.version + 1,
      expectedStatus: row.status,
      requireMutableStatus: true,
    });
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

  private async claimQuotationVersion({
    authContext,
    quotationId,
    observedVersion,
    nextVersion,
    expectedStatus,
    requireMutableStatus = false,
  }: {
    authContext: WorkspaceAuthContext;
    quotationId: string;
    observedVersion: number;
    nextVersion: number;
    expectedStatus: string;
    requireMutableStatus?: boolean;
  }): Promise<void> {
    await this.workspaceOrmManager.executeInWorkspaceContext(async () => {
      await this.workspaceOrmManager.runInWorkspaceTransaction(
        async (transactionScope) => {
          const repository = transactionScope.getRepository<{
            id: string;
            status: string;
            version: number;
          }>('quotation', { shouldBypassPermissionChecks: true });

          const where = requireMutableStatus
            ? {
                id: quotationId,
                version: observedVersion,
                status: In([...QUOTATION_CONTENT_MUTABLE_STATUSES]),
              }
            : {
                id: quotationId,
                version: observedVersion,
                status: expectedStatus,
              };

          const result = await repository
            .createQueryBuilder()
            .where(where)
            .update()
            .set({ version: nextVersion })
            .returning(['id', 'version', 'status'])
            .execute();

          if (result.generatedMaps.length === 0) {
            throw new QuotationQueryValidationException(
              requireMutableStatus
                ? 'QUOTATION_LINES_FROZEN: quotation changed concurrently or is no longer editable; reload and retry'
                : 'QUOTATION_VERSION_CONFLICT: quotation was changed concurrently; reload the current version and retry',
              QuotationQueryValidationExceptionCode.FORBIDDEN,
            );
          }
        },
      );
    }, authContext);
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
        version: parseQuotationVersion(row.version),
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
