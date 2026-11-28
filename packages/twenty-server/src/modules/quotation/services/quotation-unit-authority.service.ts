import { Injectable } from '@nestjs/common';

import { type ActorMetadata, FieldActorSource } from 'twenty-shared/types';

import { buildCreatedByFromApiKey } from 'src/engine/core-modules/actor/utils/build-created-by-from-api-key.util';
import { buildCreatedByFromApplication } from 'src/engine/core-modules/actor/utils/build-created-by-from-application.util';
import { buildCreatedByFromFullNameMetadata } from 'src/engine/core-modules/actor/utils/build-created-by-from-full-name-metadata.util';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace-repository';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import {
  type QuotationUnitMutationOutcome,
  type SaveQuotationUnitInput,
  type TaxSettingsAuthority,
  type WorkspaceQuotationUnitRow,
  type WorkspaceQuotationUnitView,
} from 'src/modules/quotation/types/quotation-unit.type';
import { parseAccountingCodeInput } from 'src/modules/quotation/utils/parse-accounting-code.util';
import { isQuotationUnitAccountingCodeLocked } from 'src/modules/quotation/utils/quotation-accounting-code-lock.util';
import { acquireQuotationUnitCatalogExclusiveLock } from 'src/modules/quotation/utils/quotation-unit-lock.util';

const UNIT_COLUMNS = {
  id: true,
  code: true,
  name: true,
  isActive: true,
  accountingCode: true,
} as const;

const refused = (
  code: string,
  message: string,
): QuotationUnitMutationOutcome => ({ kind: 'REFUSED', code, message });

const readText = (value: string | null): string => (value ?? '').trim();

const normalizeActor = (actor: ActorMetadata): ActorMetadata => {
  const name = (actor.name ?? '').trim();

  return {
    source: actor.source,
    name: name === '' ? actor.source : name,
    workspaceMemberId: actor.workspaceMemberId ?? null,
    context: actor.context ?? {},
  };
};

const toView = (
  row: WorkspaceQuotationUnitRow,
  catalogItemCount: number,
): WorkspaceQuotationUnitView | null => {
  const code = readText(row.code);

  if (code === '' || !/^UNIT_[1-9]\d*$/.test(code)) {
    return null;
  }

  return {
    recordId: row.id,
    code,
    name: readText(row.name) || code,
    isActive: row.isActive !== false,
    accountingCode: readText(row.accountingCode),
    catalogItemCount,
  };
};

@Injectable()
export class QuotationUnitAuthorityService {
  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly quotationPermissionService: QuotationPermissionService,
  ) {}

  async resolveAuthority(
    authContext: WorkspaceAuthContext,
  ): Promise<TaxSettingsAuthority | null> {
    return this.quotationPermissionService.resolveSettingsAuthority(authContext);
  }

  async listUnits(
    authContext: WorkspaceAuthContext,
  ): Promise<QuotationUnitMutationOutcome> {
    return this.readUnits(authContext, 'فهرست واحدها خوانده شد');
  }

  async saveUnit(
    input: SaveQuotationUnitInput,
    authContext: WorkspaceAuthContext,
  ): Promise<QuotationUnitMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const rows = await this.findAll(
          repository,
          this.catalogUsageCounter(this.catalogItemRepository(scope)),
        );
        const existing =
          input.recordId === null
            ? null
            : (rows.find((row) => row.recordId === input.recordId) ?? null);

        if (input.recordId !== null && existing === null) {
          return refused('QUOTATION_UNIT_NOT_FOUND', 'واحد پیدا نشد');
        }

        const name = input.name.trim();

        if (name === '') {
          return refused('QUOTATION_UNIT_NAME_REQUIRED', 'نام واحد را وارد کنید');
        }

        const duplicateName = rows.find(
          (row) =>
            row.recordId !== existing?.recordId &&
            row.name.trim().toLocaleLowerCase('fa') ===
              name.toLocaleLowerCase('fa'),
        );

        if (duplicateName !== undefined) {
          return refused(
            'QUOTATION_UNIT_NAME_DUPLICATE',
            'نام واحد در این فضای کاری تکراری است',
          );
        }

        const accountingCode = parseAccountingCodeInput(input.accountingCodeText);

        if (!accountingCode.ok) {
          return refused(accountingCode.code, accountingCode.message);
        }

        if (accountingCode.accountingCode !== '') {
          const duplicateCode = rows.find(
            (row) =>
              row.recordId !== existing?.recordId &&
              row.accountingCode.trim() !== '' &&
              row.accountingCode.trim() === accountingCode.accountingCode,
          );

          if (duplicateCode !== undefined) {
            return refused(
              'QUOTATION_UNIT_ACCOUNTING_CODE_DUPLICATE',
              'کد حسابداری واحد در این فضای کاری تکراری است',
            );
          }
        }

        if (
          existing !== null &&
          accountingCode.accountingCode !== readText(existing.accountingCode)
        ) {
          const locked = await isQuotationUnitAccountingCodeLocked({
            scope,
            quotationUnitRecordId: existing.recordId,
          });

          if (locked) {
            return refused(
              'ACCOUNTING_CODE_IN_USE',
              'کد حسابداری این واحد پس از اولین ذخیره پیش‌فاکتور با کد غیرخالی قفل شده است',
            );
          }
        }

        const code =
          readText(existing?.code ?? null) || this.nextCode(rows);
        const values = {
          code,
          name,
          accountingCode: accountingCode.accountingCode,
          isActive: input.isActive,
        };

        if (existing === null) {
          await repository.insert({
            ...values,
            createdBy: actor,
            updatedBy: actor,
          } as never);
        } else {
          await repository.update(
            { id: existing.recordId },
            { ...values, updatedBy: actor } as never,
          );
        }

        return {
          kind: 'OK',
          units: await this.findAll(
            repository,
            this.catalogUsageCounter(this.catalogItemRepository(scope)),
          ),
          message: existing === null ? 'واحد ساخته شد' : 'واحد ذخیره شد',
        };
      }),
    );
  }

  async deactivateUnit(
    recordId: string,
    authContext: WorkspaceAuthContext,
  ): Promise<QuotationUnitMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const countUsage = this.catalogUsageCounter(
          this.catalogItemRepository(scope),
        );
        const rows = await this.findAll(repository, countUsage);
        const chosen = rows.find((row) => row.recordId === recordId);

        if (chosen === undefined) {
          return refused('QUOTATION_UNIT_NOT_FOUND', 'واحد پیدا نشد');
        }

        if (!chosen.isActive) {
          return refused('QUOTATION_UNIT_ALREADY_INACTIVE', 'واحد از قبل غیرفعال است');
        }

        await repository.update(
          { id: recordId },
          { isActive: false, updatedBy: actor } as never,
        );

        return {
          kind: 'OK',
          units: await this.findAll(repository, countUsage),
          message: 'واحد غیرفعال شد',
        };
      }),
    );
  }

  private async readUnits(
    authContext: WorkspaceAuthContext,
    message: string,
  ): Promise<QuotationUnitMutationOutcome> {
    return this.inWorkspace(authContext, async () => {
      const repository =
        this.workspaceOrmManager.getRepository<WorkspaceQuotationUnitRow>(
          'quotationUnit',
          { shouldBypassPermissionChecks: true },
        );
      const catalogRepository =
        this.workspaceOrmManager.getRepository<{ id: string; unitRecordId?: string | null }>(
          'catalogItem',
          { shouldBypassPermissionChecks: true },
        );

      return {
        kind: 'OK',
        units: await this.findAll(
          repository,
          this.catalogUsageCounter(catalogRepository),
        ),
        message,
      };
    });
  }

  private async inWorkspace<TResult>(
    authContext: WorkspaceAuthContext,
    work: () => Promise<TResult>,
  ): Promise<TResult> {
    return this.workspaceOrmManager.executeInWorkspaceContext(work, authContext);
  }

  private runLocked<TResult>(
    work: (scope: WorkspaceTransactionScope) => Promise<TResult>,
  ): Promise<TResult> {
    return this.workspaceOrmManager.runInWorkspaceTransaction(async (scope) => {
      await acquireQuotationUnitCatalogExclusiveLock(scope);

      return work(scope);
    });
  }

  private repository(
    scope: WorkspaceTransactionScope,
  ): WorkspaceRepository<WorkspaceQuotationUnitRow> {
    return scope.getRepository<WorkspaceQuotationUnitRow>('quotationUnit', {
      shouldBypassPermissionChecks: true,
    });
  }

  private catalogItemRepository(
    scope: WorkspaceTransactionScope,
  ): WorkspaceRepository<{ id: string; unitRecordId?: string | null }> {
    return scope.getRepository('catalogItem', {
      shouldBypassPermissionChecks: true,
    });
  }

  private actorFor(authContext: WorkspaceAuthContext): ActorMetadata {
    if (authContext.type === 'user') {
      return normalizeActor(
        buildCreatedByFromFullNameMetadata({
          fullNameMetadata: authContext.workspaceMember.name,
          workspaceMemberId: authContext.workspaceMemberId,
        }),
      );
    }

    if (authContext.type === 'apiKey') {
      return normalizeActor(
        buildCreatedByFromApiKey({ apiKey: authContext.apiKey }),
      );
    }

    if (authContext.type === 'application') {
      return normalizeActor(
        buildCreatedByFromApplication({
          application: authContext.application,
        }),
      );
    }

    return {
      source: FieldActorSource.SYSTEM,
      name: 'System',
      workspaceMemberId: null,
      context: {},
    };
  }

  private catalogUsageCounter(
    repository: WorkspaceRepository<{ id: string; unitRecordId?: string | null }>,
  ): (unitRecordId: string) => Promise<number> {
    return async (unitRecordId: string) => {
      try {
        const items = await repository.find({
          where: { unitRecordId },
          select: { id: true, unitRecordId: true },
          take: 1000,
        });

        return items.length;
      } catch {
        // Schema may lack unitRecordId until app sync applies.
        return 0;
      }
    };
  }

  private async findAll(
    repository: WorkspaceRepository<WorkspaceQuotationUnitRow>,
    countUsage: (unitRecordId: string) => Promise<number>,
  ): Promise<WorkspaceQuotationUnitView[]> {
    const rows = await repository.find({
      select: UNIT_COLUMNS,
      order: { createdAt: 'ASC' },
    });

    const views: WorkspaceQuotationUnitView[] = [];

    for (const row of rows) {
      const catalogItemCount = await countUsage(row.id);
      const view = toView(row, catalogItemCount);

      if (view !== null) {
        views.push(view);
      }
    }

    return views;
  }

  private nextCode(rows: WorkspaceQuotationUnitView[]): string {
    let max = 0;

    for (const row of rows) {
      const match = /^UNIT_(\d+)$/.exec(row.code);

      if (match !== null) {
        const value = Number(match[1]);

        if (Number.isFinite(value)) {
          max = Math.max(max, value);
        }
      }
    }

    return `UNIT_${max + 1}`;
  }
}