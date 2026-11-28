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
  type RoundingRuleMutationOutcome,
  type RoundingSettingsAuthority,
  type SaveRoundingRuleInput,
  type WorkspaceRoundingRuleRow,
  type WorkspaceRoundingRuleView,
} from 'src/modules/quotation/types/rounding-rule.type';
import { parseRoundingStepRialsText } from 'src/modules/quotation/utils/parse-rounding-step-rials.util';
import { acquireRoundingRuleExclusiveLock } from 'src/modules/quotation/utils/quotation-rounding-rule-lock.util';
import { toPersianDigits } from 'src/modules/quotation/utils/quotation-numbering.util';

const SEED_STEPS = [
  BigInt(10),
  BigInt(100),
  BigInt(1000),
  BigInt(10000),
  BigInt(100000),
  BigInt(1000000),
] as const;

const RULE_COLUMNS = {
  id: true,
  code: true,
  name: true,
  stepRials: true,
  isActive: true,
  isDefault: true,
} as const;

const refused = (
  code: string,
  message: string,
): RoundingRuleMutationOutcome => ({ kind: 'REFUSED', code, message });

const readText = (value: string | null | undefined): string =>
  (value ?? '').trim();

const normalizeActor = (actor: ActorMetadata): ActorMetadata => {
  const name = (actor.name ?? '').trim();

  return {
    source: actor.source,
    name: name === '' ? actor.source : name,
    workspaceMemberId: actor.workspaceMemberId ?? null,
    context: actor.context ?? {},
  };
};

const seedLabel = (step: bigint): string =>
  `مبنای ${toPersianDigits(step.toString())} ریال`;

const seedCode = (step: bigint): string => `STEP_${step.toString()}`;

const toView = (
  row: WorkspaceRoundingRuleRow,
): WorkspaceRoundingRuleView | null => {
  const code = readText(row.code);
  const stepRials = readText(row.stepRials);

  if (code === '' || !/^[1-9]\d{0,17}$/.test(stepRials)) {
    return null;
  }

  return {
    recordId: row.id,
    code,
    name: readText(row.name) || code,
    stepRials,
    isActive: row.isActive !== false,
    isDefault: row.isDefault === true,
    quotationCount: 0,
  };
};

@Injectable()
export class RoundingRuleAuthorityService {
  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly quotationPermissionService: QuotationPermissionService,
  ) {}

  async resolveAuthority(
    authContext: WorkspaceAuthContext,
  ): Promise<RoundingSettingsAuthority | null> {
    return this.quotationPermissionService.resolveSettingsAuthority(authContext);
  }

  async listRules(
    authContext: WorkspaceAuthContext,
  ): Promise<RoundingRuleMutationOutcome> {
    return this.readRules(authContext, 'فهرست قواعد رُند خوانده شد');
  }

  async bootstrap(
    authContext: WorkspaceAuthContext,
  ): Promise<RoundingRuleMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const existing = await this.findAll(
          repository,
          this.usageCounter(this.quotationRepository(scope)),
        );

        if (existing.length === 0) {
          for (let index = 0; index < SEED_STEPS.length; index += 1) {
            const step = SEED_STEPS[index];

            await repository.insert({
              code: seedCode(step),
              name: seedLabel(step),
              stepRials: step.toString(),
              isActive: true,
              // Smallest seeded step is the workspace default.
              isDefault: index === 0,
              createdBy: actor,
              updatedBy: actor,
            } as never);
          }
        }

        const rules = await this.findAll(
          repository,
          this.usageCounter(this.quotationRepository(scope)),
        );

        return {
          kind: 'OK',
          rules,
          message:
            existing.length === 0
              ? 'قواعد پایهٔ رُند ساخته شد'
              : 'قواعد رُند از قبل وجود دارد',
        };
      }),
    );
  }

  async saveRule(
    input: SaveRoundingRuleInput,
    authContext: WorkspaceAuthContext,
  ): Promise<RoundingRuleMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const rows = await this.findAll(
          repository,
          this.usageCounter(this.quotationRepository(scope)),
        );
        const existing =
          input.recordId === null
            ? null
            : (rows.find((row) => row.recordId === input.recordId) ?? null);

        if (input.recordId !== null && existing === null) {
          return refused('ROUNDING_RULE_NOT_FOUND', 'قاعده رُند پیدا نشد');
        }

        const name = input.name.trim();

        if (name === '') {
          return refused(
            'ROUNDING_RULE_NAME_REQUIRED',
            'نام قاعده رُند را وارد کنید',
          );
        }

        const duplicateName = rows.find(
          (row) =>
            row.recordId !== existing?.recordId &&
            row.name.trim().toLocaleLowerCase('fa') ===
              name.toLocaleLowerCase('fa'),
        );

        if (duplicateName !== undefined) {
          return refused(
            'ROUNDING_RULE_NAME_DUPLICATE',
            'نام قاعده رُند در این فضای کاری تکراری است',
          );
        }

        const step = parseRoundingStepRialsText(input.stepRialsText);

        if (!step.ok) {
          return refused(step.code, step.message);
        }

        const wasDefault = existing?.isDefault === true;

        if (wasDefault && !input.isActive) {
          return refused(
            'ROUNDING_RULE_DEFAULT_MUST_STAY_ACTIVE',
            'قاعده پیش‌فرض را نمی‌توان غیرفعال کرد؛ ابتدا قاعده پیش‌فرض دیگری انتخاب کنید',
          );
        }

        if (input.isDefault && !input.isActive) {
          return refused(
            'ROUNDING_RULE_DEFAULT_MUST_BE_ACTIVE',
            'قاعده پیش‌فرض باید فعال باشد',
          );
        }

        const activeOthers = rows.filter(
          (row) => row.recordId !== existing?.recordId && row.isActive,
        );

        if (input.isActive === false && activeOthers.length === 0) {
          return refused(
            'ROUNDING_RULE_LAST_ACTIVE',
            'حداقل یک قاعده رُند فعال لازم است',
          );
        }

        const code =
          readText(existing?.code ?? null) ||
          this.nextCode(rows, step.stepRials);
        const shouldBeDefault =
          input.isDefault || wasDefault || rows.length === 0;

        if (shouldBeDefault) {
          await this.clearDefaults(
            repository,
            rows,
            existing?.recordId ?? null,
            actor,
          );
        }

        const values = {
          code,
          name,
          stepRials: step.stepRials.toString(),
          isActive: input.isActive,
          isDefault: shouldBeDefault,
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

        const repaired = await this.enforceSingleActiveDefault(
          repository,
          actor,
        );

        return {
          kind: 'OK',
          rules: await this.findAll(
            repository,
            this.usageCounter(this.quotationRepository(scope)),
          ),
          message: repaired
            ? 'قاعده رُند ذخیره شد؛ وضعیت پیش‌فرض ناسازگار ترمیم شد'
            : 'قاعده رُند ذخیره شد',
        };
      }),
    );
  }

  async setDefaultRule(
    recordId: string,
    authContext: WorkspaceAuthContext,
  ): Promise<RoundingRuleMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const rows = await this.findAll(
          repository,
          this.usageCounter(this.quotationRepository(scope)),
        );
        const chosen = rows.find((row) => row.recordId === recordId);

        if (chosen === undefined) {
          return refused('ROUNDING_RULE_NOT_FOUND', 'قاعده رُند پیدا نشد');
        }

        if (chosen.isActive === false) {
          return refused(
            'ROUNDING_RULE_DEFAULT_MUST_BE_ACTIVE',
            'قاعده غیرفعال را نمی‌توان پیش‌فرض کرد',
          );
        }

        await this.clearDefaults(repository, rows, recordId, actor);
        await repository.update(
          { id: recordId },
          { isDefault: true, updatedBy: actor } as never,
        );
        const repaired = await this.enforceSingleActiveDefault(
          repository,
          actor,
        );

        return {
          kind: 'OK',
          rules: await this.findAll(
            repository,
            this.usageCounter(this.quotationRepository(scope)),
          ),
          message: repaired
            ? 'قاعده پیش‌فرض تغییر کرد؛ وضعیت ناسازگار ترمیم شد'
            : 'قاعده پیش‌فرض تغییر کرد',
        };
      }),
    );
  }

  async deactivateRule(
    recordId: string,
    authContext: WorkspaceAuthContext,
  ): Promise<RoundingRuleMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const rows = await this.findAll(
          repository,
          this.usageCounter(this.quotationRepository(scope)),
        );
        const chosen = rows.find((row) => row.recordId === recordId);

        if (chosen === undefined) {
          return refused('ROUNDING_RULE_NOT_FOUND', 'قاعده رُند پیدا نشد');
        }

        if (chosen.isDefault === true) {
          return refused(
            'ROUNDING_RULE_IS_DEFAULT',
            'قاعده پیش‌فرض را ابتدا با انتخاب قاعده دیگری جابه‌جا کنید',
          );
        }

        const activeOthers = rows.filter(
          (row) => row.isActive !== false && row.recordId !== recordId,
        );

        if (activeOthers.length === 0) {
          return refused(
            'ROUNDING_RULE_LAST_ACTIVE',
            'حداقل یک قاعده رُند فعال لازم است',
          );
        }

        await repository.update(
          { id: recordId },
          { isActive: false, updatedBy: actor } as never,
        );
        const repaired = await this.enforceSingleActiveDefault(
          repository,
          actor,
        );

        return {
          kind: 'OK',
          rules: await this.findAll(
            repository,
            this.usageCounter(this.quotationRepository(scope)),
          ),
          message: repaired
            ? 'قاعده رُند غیرفعال شد؛ وضعیت پیش‌فرض ناسازگار ترمیم شد'
            : 'قاعده رُند غیرفعال شد',
        };
      }),
    );
  }

  async deleteRule(
    recordId: string,
    authContext: WorkspaceAuthContext,
  ): Promise<RoundingRuleMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const countUsage = this.usageCounter(this.quotationRepository(scope));
        const rows = await this.findAll(repository, countUsage);
        const chosen = rows.find((row) => row.recordId === recordId);

        if (chosen === undefined) {
          return refused('ROUNDING_RULE_NOT_FOUND', 'قاعده رُند پیدا نشد');
        }

        if (chosen.isDefault) {
          return refused(
            'ROUNDING_RULE_IS_DEFAULT',
            'این قاعده پیش‌فرض است؛ ابتدا قاعده پیش‌فرض دیگری انتخاب کنید',
          );
        }

        if (
          chosen.isActive &&
          rows.filter((row) => row.isActive && row.recordId !== recordId)
            .length === 0
        ) {
          return refused(
            'ROUNDING_RULE_LAST_ACTIVE',
            'حداقل یک قاعده رُند فعال لازم است',
          );
        }

        if (chosen.quotationCount > 0) {
          return refused(
            'ROUNDING_RULE_IN_USE',
            `این قاعده در ${toPersianDigits(
              String(chosen.quotationCount),
            )} سند استفاده شده است؛ حذف نمی‌شود، فقط غیرفعال می‌شود`,
          );
        }

        await repository.softDelete({ id: recordId } as never);
        const repaired = await this.enforceSingleActiveDefault(
          repository,
          actor,
        );

        return {
          kind: 'OK',
          rules: await this.findAll(repository, countUsage),
          message: repaired
            ? 'قاعده رُند حذف شد؛ وضعیت پیش‌فرض ناسازگار ترمیم شد'
            : 'قاعده رُند حذف شد',
        };
      }),
    );
  }

  private async readRules(
    authContext: WorkspaceAuthContext,
    message: string,
  ): Promise<RoundingRuleMutationOutcome> {
    return this.inWorkspace(authContext, async () => {
      const repository =
        this.workspaceOrmManager.getRepository<WorkspaceRoundingRuleRow>(
          'roundingRule',
          { shouldBypassPermissionChecks: true },
        );
      const quotationRepository = this.workspaceOrmManager.getRepository<{
        id: string;
        roundingRuleCode: string | null;
      }>('quotation', { shouldBypassPermissionChecks: true });
      const rules = await this.findAll(
        repository,
        this.usageCounter(quotationRepository),
      );

      return { kind: 'OK', rules, message };
    });
  }

  private async inWorkspace<T>(
    authContext: WorkspaceAuthContext,
    work: () => Promise<T>,
  ): Promise<T> {
    return this.workspaceOrmManager.executeInWorkspaceContext(work, authContext);
  }

  private runLocked<T>(
    work: (scope: WorkspaceTransactionScope) => Promise<T>,
  ): Promise<T> {
    return this.workspaceOrmManager.runInWorkspaceTransaction(async (scope) => {
      await acquireRoundingRuleExclusiveLock(scope);

      return work(scope);
    });
  }

  private repository(
    scope: WorkspaceTransactionScope,
  ): WorkspaceRepository<WorkspaceRoundingRuleRow> {
    return scope.getRepository<WorkspaceRoundingRuleRow>('roundingRule', {
      shouldBypassPermissionChecks: true,
    });
  }

  private quotationRepository(
    scope: WorkspaceTransactionScope,
  ): WorkspaceRepository<{ id: string; roundingRuleCode: string | null }> {
    return scope.getRepository<{ id: string; roundingRuleCode: string | null }>(
      'quotation',
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
    repository: WorkspaceRepository<WorkspaceRoundingRuleRow>,
    countUsage?: (code: string) => Promise<number>,
  ): Promise<WorkspaceRoundingRuleView[]> {
    const rows = await repository.find({
      select: RULE_COLUMNS,
      order: { createdAt: 'ASC' },
    });

    const views = rows.flatMap((row) => {
      const view = toView(row);

      return view === null ? [] : [view];
    });

    if (countUsage === undefined) {
      return views;
    }

    return Promise.all(
      views.map(async (view) => ({
        ...view,
        quotationCount: await countUsage(view.code),
      })),
    );
  }

  private usageCounter(
    quotationRepository: WorkspaceRepository<{
      id: string;
      roundingRuleCode: string | null;
    }>,
  ): (code: string) => Promise<number> {
    return (code) =>
      quotationRepository.count({
        where: { roundingRuleCode: code } as never,
      });
  }

  private async clearDefaults(
    repository: WorkspaceRepository<WorkspaceRoundingRuleRow>,
    rows: WorkspaceRoundingRuleView[],
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
    repository: WorkspaceRepository<WorkspaceRoundingRuleRow>,
    actor: ActorMetadata,
  ): Promise<boolean> {
    const rows = await repository.find({
      select: RULE_COLUMNS,
      order: { createdAt: 'ASC' },
    });
    const activeRows = rows.filter((row) => row.isActive === true);

    if (activeRows.length === 0) {
      throw new Error(
        'ROUNDING_RULE_INVARIANT_VIOLATED: a workspace must keep at least one active rounding rule',
      );
    }

    const preferred =
      activeRows.find((row) => row.isDefault === true) ?? activeRows[0];
    const preferredId = readText(preferred.id);
    let repaired = false;

    for (const row of rows) {
      if (row.isDefault === true && row.id !== preferredId) {
        await repository.update(
          { id: row.id },
          { isDefault: false, updatedBy: actor } as never,
        );
        repaired = true;
      }
    }

    if (preferred.isDefault !== true) {
      await repository.update(
        { id: preferred.id },
        { isDefault: true, updatedBy: actor } as never,
      );
      repaired = true;
    }

    return repaired;
  }

  private nextCode(
    rows: WorkspaceRoundingRuleView[],
    stepRials: bigint,
  ): string {
    const base = `STEP_${stepRials.toString()}`;
    const taken = new Set(rows.map((row) => row.code));

    if (!taken.has(base)) {
      return base;
    }

    let suffix = 2;

    while (taken.has(`${base}_${suffix}`)) {
      suffix += 1;
    }

    return `${base}_${suffix}`;
  }
}
