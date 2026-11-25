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
  type QuotationCurrencyMutationOutcome,
  type SaveQuotationCurrencyInput,
  type TaxSettingsAuthority,
  type WorkspaceQuotationCurrencyRow,
  type WorkspaceQuotationCurrencyView,
} from 'src/modules/quotation/types/quotation-currency.type';
import { parseAccountingCodeInput } from 'src/modules/quotation/utils/parse-accounting-code.util';
import { acquireCurrencyCatalogExclusiveLock } from 'src/modules/quotation/utils/quotation-currency-lock.util';

const BASELINE_CURRENCY = {
  code: 'IRR',
  name: 'ریال ایران',
} as const;

const CURRENCY_COLUMNS = {
  id: true,
  code: true,
  name: true,
  isDefault: true,
  isActive: true,
  accountingCode: true,
} as const;

const refused = (
  code: string,
  message: string,
): QuotationCurrencyMutationOutcome => ({ kind: 'REFUSED', code, message });

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
  row: WorkspaceQuotationCurrencyRow,
): WorkspaceQuotationCurrencyView | null => {
  const code = readText(row.code).toUpperCase();

  if (code === '' || !/^[A-Z]{3}$/.test(code)) {
    return null;
  }

  return {
    recordId: row.id,
    code,
    name: readText(row.name) || code,
    isDefault: row.isDefault === true,
    isActive: row.isActive !== false,
    accountingCode: readText(row.accountingCode),
  };
};

@Injectable()
export class QuotationCurrencyAuthorityService {
  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly quotationPermissionService: QuotationPermissionService,
  ) {}

  async resolveAuthority(
    authContext: WorkspaceAuthContext,
  ): Promise<TaxSettingsAuthority | null> {
    return this.quotationPermissionService.resolveSettingsAuthority(authContext);
  }

  async listCurrencies(
    authContext: WorkspaceAuthContext,
  ): Promise<QuotationCurrencyMutationOutcome> {
    return this.readCurrencies(authContext, 'فهرست ارزها خوانده شد');
  }

  async bootstrap(
    authContext: WorkspaceAuthContext,
  ): Promise<QuotationCurrencyMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const existing = await this.findAll(repository);

        if (existing.length === 0) {
          await repository.insert({
            code: BASELINE_CURRENCY.code,
            name: BASELINE_CURRENCY.name,
            isActive: true,
            isDefault: true,
            accountingCode: '',
            createdBy: actor,
            updatedBy: actor,
          } as never);
        }

        const currencies = await this.findAll(repository);

        return {
          kind: 'OK',
          currencies,
          message:
            existing.length === 0
              ? 'ارز پایهٔ ریال ساخته شد'
              : 'فهرست ارز از قبل وجود دارد',
        };
      }),
    );
  }

  async saveCurrency(
    input: SaveQuotationCurrencyInput,
    authContext: WorkspaceAuthContext,
  ): Promise<QuotationCurrencyMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const rows = await this.findAll(repository);
        const existing =
          input.recordId === null
            ? null
            : (rows.find((row) => row.recordId === input.recordId) ?? null);

        if (input.recordId !== null && existing === null) {
          return refused('QUOTATION_CURRENCY_NOT_FOUND', 'ارز پیدا نشد');
        }

        // WS1: create path only via bootstrap (IRR). Saves update existing rows.
        if (existing === null) {
          return refused(
            'QUOTATION_CURRENCY_CREATE_FORBIDDEN',
            'ارز جدید فقط از مسیر راه‌اندازی پایه ساخته می‌شود',
          );
        }

        const name = input.name.trim();

        if (name === '') {
          return refused('QUOTATION_CURRENCY_NAME_REQUIRED', 'نام ارز را وارد کنید');
        }

        const accountingCode = parseAccountingCodeInput(input.accountingCodeText);

        if (!accountingCode.ok) {
          return refused(accountingCode.code, accountingCode.message);
        }

        const wasDefault = existing.isDefault === true;

        if (wasDefault && !input.isActive) {
          return refused(
            'QUOTATION_CURRENCY_DEFAULT_MUST_STAY_ACTIVE',
            'ارز پیش‌فرض را نمی‌توان غیرفعال کرد؛ ابتدا ارز پیش‌فرض دیگری انتخاب کنید',
          );
        }

        if (input.isDefault && !input.isActive) {
          return refused(
            'QUOTATION_CURRENCY_DEFAULT_MUST_BE_ACTIVE',
            'ارز پیش‌فرض باید فعال باشد',
          );
        }

        const activeOthers = rows.filter(
          (row) => row.recordId !== existing.recordId && row.isActive,
        );

        if (input.isActive === false && activeOthers.length === 0) {
          return refused(
            'QUOTATION_CURRENCY_LAST_ACTIVE',
            'حداقل یک ارز فعال لازم است',
          );
        }

        const shouldBeDefault = input.isDefault || wasDefault;

        if (shouldBeDefault) {
          await this.clearDefaults(repository, rows, existing.recordId, actor);
        }

        await repository.update(
          { id: existing.recordId },
          {
            name,
            accountingCode: accountingCode.accountingCode,
            isActive: input.isActive,
            isDefault: shouldBeDefault,
            updatedBy: actor,
          } as never,
        );

        const repaired = await this.enforceSingleActiveDefault(repository, actor);

        return {
          kind: 'OK',
          currencies: await this.findAll(repository),
          message: repaired
            ? 'ارز ذخیره شد؛ وضعیت پیش‌فرض ناسازگار بود و اصلاح شد'
            : 'ارز ذخیره شد',
        };
      }),
    );
  }

  async setDefaultCurrency(
    recordId: string,
    authContext: WorkspaceAuthContext,
  ): Promise<QuotationCurrencyMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const rows = await this.findAll(repository);
        const target = rows.find((row) => row.recordId === recordId) ?? null;

        if (target === null) {
          return refused('QUOTATION_CURRENCY_NOT_FOUND', 'ارز پیدا نشد');
        }

        if (!target.isActive) {
          return refused(
            'QUOTATION_CURRENCY_DEFAULT_MUST_BE_ACTIVE',
            'ارز پیش‌فرض باید فعال باشد',
          );
        }

        await this.clearDefaults(repository, rows, recordId, actor);
        await repository.update(
          { id: recordId },
          { isDefault: true, updatedBy: actor } as never,
        );

        return {
          kind: 'OK',
          currencies: await this.findAll(repository),
          message: 'ارز پیش‌فرض تنظیم شد',
        };
      }),
    );
  }

  private async readCurrencies(
    authContext: WorkspaceAuthContext,
    message: string,
  ): Promise<QuotationCurrencyMutationOutcome> {
    return this.inWorkspace(authContext, async () => {
      const repository =
        this.workspaceOrmManager.getRepository<WorkspaceQuotationCurrencyRow>(
          'quotationCurrency',
          { shouldBypassPermissionChecks: true },
        );

      return {
        kind: 'OK',
        currencies: await this.findAll(repository),
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
      await acquireCurrencyCatalogExclusiveLock(scope);

      return work(scope);
    });
  }

  private repository(
    scope: WorkspaceTransactionScope,
  ): WorkspaceRepository<WorkspaceQuotationCurrencyRow> {
    return scope.getRepository<WorkspaceQuotationCurrencyRow>(
      'quotationCurrency',
      { shouldBypassPermissionChecks: true },
    );
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

  private async findAll(
    repository: WorkspaceRepository<WorkspaceQuotationCurrencyRow>,
  ): Promise<WorkspaceQuotationCurrencyView[]> {
    const rows = await repository.find({
      select: CURRENCY_COLUMNS,
      order: { createdAt: 'ASC' },
    });

    return rows
      .map((row) => toView(row))
      .filter((row): row is WorkspaceQuotationCurrencyView => row !== null);
  }

  private async clearDefaults(
    repository: WorkspaceRepository<WorkspaceQuotationCurrencyRow>,
    rows: WorkspaceQuotationCurrencyView[],
    keepRecordId: string | null,
    actor: ActorMetadata,
  ): Promise<void> {
    for (const row of rows) {
      if (row.isDefault && row.recordId !== keepRecordId) {
        await repository.update(
          { id: row.recordId },
          { isDefault: false, updatedBy: actor } as never,
        );
      }
    }
  }

  private async enforceSingleActiveDefault(
    repository: WorkspaceRepository<WorkspaceQuotationCurrencyRow>,
    actor: ActorMetadata,
  ): Promise<boolean> {
    const rows = await this.findAll(repository);
    const defaults = rows.filter((row) => row.isDefault && row.isActive);

    if (defaults.length === 1) {
      return false;
    }

    for (const row of defaults) {
      await repository.update(
        { id: row.recordId },
        { isDefault: false, updatedBy: actor } as never,
      );
    }

    const firstActive = rows.find((row) => row.isActive) ?? null;

    if (firstActive !== null) {
      await repository.update(
        { id: firstActive.recordId },
        { isDefault: true, updatedBy: actor } as never,
      );
    }

    return true;
  }
}
