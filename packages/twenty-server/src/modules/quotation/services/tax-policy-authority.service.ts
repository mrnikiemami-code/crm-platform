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
  type SaveTaxPolicyInput,
  type TaxPolicyMutationOutcome,
  type TaxSettingsAuthority,
  type WorkspaceTaxPolicyRow,
  type WorkspaceTaxPolicyView,
} from 'src/modules/quotation/types/tax-policy.type';
import {
  formatBasisPointsAsPercent,
  parseTaxRatePercent,
} from 'src/modules/quotation/utils/parse-tax-rate-percent.util';
import { acquireTaxPolicyExclusiveLock } from 'src/modules/quotation/utils/quotation-tax-policy-lock.util';

// The initial policy of a workspace that has none: the same 9% definition the
// sealed legacy documents were written with. Created only by the explicit,
// idempotent bootstrap below — never as a side effect of reading the list.
const BASELINE_POLICY = {
  code: 'IR_VAT_9',
  name: 'مالیات بر ارزش افزوده ۹٪',
  rateBasisPoints: BigInt(900),
  // The legacy 9% was a single tax figure with no separate duty; a workspace that
  // bootstraps keeps exactly the rate its older documents were sealed with.
  dutyRateBasisPoints: BigInt(0),
} as const;

const POLICY_COLUMNS = {
  id: true,
  code: true,
  name: true,
  rateBasisPoints: true,
  dutyRateBasisPoints: true,
  isActive: true,
  isDefault: true,
  isExempt: true,
} as const;

const refused = (
  code: string,
  message: string,
): TaxPolicyMutationOutcome => ({ kind: 'REFUSED', code, message });

const readText = (value: string | null): string => (value ?? '').trim();

// An API-key token can carry the key id without its display name, and every audit
// column is NOT NULL. An unnamed writer is recorded by the kind of writer it was,
// never as null: the settings page has to be able to say who changed a rate.
const normalizeActor = (actor: ActorMetadata): ActorMetadata => {
  const name = (actor.name ?? '').trim();

  return {
    source: actor.source,
    name: name === '' ? actor.source : name,
    workspaceMemberId: actor.workspaceMemberId ?? null,
    context: actor.context ?? {},
  };
};

const toView = (row: WorkspaceTaxPolicyRow): WorkspaceTaxPolicyView | null => {
  const code = readText(row.code);
  const rateBasisPoints = readText(row.rateBasisPoints);
  // A row written before the duty column existed reads as 0% duty, which is what
  // its documents were already priced with.
  const dutyRateBasisPoints = readText(row.dutyRateBasisPoints) || '0';

  if (
    code === '' ||
    !/^\d{1,5}$/.test(rateBasisPoints) ||
    !/^\d{1,5}$/.test(dutyRateBasisPoints)
  ) {
    // An unreadable row is not offered as a rate: guessing one would be a price.
    return null;
  }

  const taxBasisPoints = BigInt(rateBasisPoints);
  const dutyBasisPoints = BigInt(dutyRateBasisPoints);
  const totalBasisPoints = taxBasisPoints + dutyBasisPoints;

  return {
    recordId: row.id,
    code,
    name: readText(row.name) || code,
    rateBasisPoints,
    ratePercent: formatBasisPointsAsPercent(taxBasisPoints),
    dutyRateBasisPoints,
    dutyRatePercent: formatBasisPointsAsPercent(dutyBasisPoints),
    totalRateBasisPoints: totalBasisPoints.toString(),
    totalRatePercent: formatBasisPointsAsPercent(totalBasisPoints),
    isActive: row.isActive !== false,
    isDefault: row.isDefault === true,
    isExempt: row.isExempt === true,
  };
};

// The authority and the only writer for the workspace tax-policy table.
//
// WHY IT LIVES HERE: a tax rate is a financial decision, so the decision to change
// it must be made where the workspace role is known — the server — not in a browser
// panel and not in a logic function that may fail to recover an identity. Reads are
// pure; every mutation is one transaction under one advisory lock, because "exactly
// one default" is a property of the row set, not of a single row.
@Injectable()
export class TaxPolicyAuthorityService {
  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly quotationPermissionService: QuotationPermissionService,
  ) {}

  // `null` means "this caller did not prove settings authority". Nothing in this
  // method falls back to allowing: a failed role lookup is a refusal.
  async resolveAuthority(
    authContext: WorkspaceAuthContext,
  ): Promise<TaxSettingsAuthority | null> {
    return this.quotationPermissionService.resolveSettingsAuthority(authContext);
  }

  async listPolicies(
    authContext: WorkspaceAuthContext,
  ): Promise<TaxPolicyMutationOutcome> {
    return this.readPolicies(authContext, 'فهرست سیاست‌های مالیات خوانده شد');
  }

  async bootstrap(
    authContext: WorkspaceAuthContext,
  ): Promise<TaxPolicyMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const existing = await this.findAll(repository);

        // Idempotent: a workspace that already has any policy is left byte-identical.
        if (existing.length === 0) {
          await repository.insert({
            code: BASELINE_POLICY.code,
            name: BASELINE_POLICY.name,
            rateBasisPoints: BASELINE_POLICY.rateBasisPoints.toString(),
            dutyRateBasisPoints: BASELINE_POLICY.dutyRateBasisPoints.toString(),
            isActive: true,
            isDefault: true,
            isExempt: false,
            createdBy: actor,
            updatedBy: actor,
          } as never);
        }

        const policies = await this.findAll(repository);

        return {
          kind: 'OK',
          policies,
          message:
            existing.length === 0
              ? 'سیاست پایهٔ ۹٪ ساخته شد'
              : 'سیاست پایه از قبل وجود دارد',
        };
      }),
    );
  }

  async savePolicy(
    input: SaveTaxPolicyInput,
    authContext: WorkspaceAuthContext,
  ): Promise<TaxPolicyMutationOutcome> {
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
          return refused('TAX_POLICY_NOT_FOUND', 'سیاست مالیات پیدا نشد');
        }

        const name = input.name.trim();

        if (name === '') {
          return refused('TAX_POLICY_NAME_REQUIRED', 'نام سیاست مالیات را وارد کنید');
        }

        const rate = parseTaxRatePercent(input.ratePercentText);

        if (!rate.ok) {
          return refused(rate.code, rate.message);
        }

        // An empty duty field means "no duty", which is a real policy; a typed value
        // must parse like the tax rate. Both components are checked before storage so a
        // policy can never be saved with a duty rate the arithmetic would misread.
        const dutyText = input.dutyRatePercentText.trim();
        const dutyRate =
          dutyText === ''
            ? { ok: true as const, rateBasisPoints: BigInt(0) }
            : parseTaxRatePercent(dutyText);

        if (!dutyRate.ok) {
          return refused(dutyRate.code, dutyRate.message);
        }

        // Each component is a percentage and so is their sum: two valid components
        // whose sum exceeds 100% would price a document above its own net.
        if (rate.rateBasisPoints + dutyRate.rateBasisPoints > BigInt(10000)) {
          return refused(
            'DUTY_RATE_OUT_OF_RANGE',
            'جمع مالیات و عوارض از ۱۰۰٪ بیشتر نمی‌شود',
          );
        }

        // An exempt policy is a 0% policy and nothing else; "exempt at 9%" would
        // claim an exemption the arithmetic does not reflect.
        if (
          input.isExempt !==
          (rate.rateBasisPoints === BigInt(0) &&
            dutyRate.rateBasisPoints === BigInt(0))
        ) {
          return refused(
            'TAX_POLICY_EXEMPTION_MISMATCH',
            input.isExempt
              ? 'سیاست معاف باید نرخ صفر داشته باشد'
              : 'سیاست با نرخ صفر باید معاف علامت بخورد',
          );
        }

        const wasDefault = existing?.isDefault === true;

        if (wasDefault && !input.isActive) {
          return refused(
            'TAX_POLICY_DEFAULT_MUST_STAY_ACTIVE',
            'سیاست پیش‌فرض را نمی‌توان غیرفعال کرد؛ ابتدا سیاست پیش‌فرض دیگری انتخاب کنید',
          );
        }

        if (input.isDefault && !input.isActive) {
          return refused(
            'TAX_POLICY_DEFAULT_MUST_BE_ACTIVE',
            'سیاست پیش‌فرض باید فعال باشد',
          );
        }

        // A workspace must never be left without an active policy: there would be no
        // rate to price a new document with. Deactivation is therefore refused when it
        // would remove the last active one, on this path as well as `deactivatePolicy`.
        const activeOthers = rows.filter(
          (row) => row.recordId !== existing?.recordId && row.isActive,
        );

        if (input.isActive === false && activeOthers.length === 0) {
          return existing === null && rows.length === 0
            ? refused(
                'TAX_POLICY_FIRST_MUST_BE_ACTIVE',
                'اولین سیاست مالیات باید فعال باشد',
              )
            : refused(
                'TAX_POLICY_LAST_ACTIVE',
                'حداقل یک سیاست مالیات فعال لازم است',
              );
        }

        const code = readText(existing?.code ?? null) || this.nextCode(rows, rate.rateBasisPoints);
        // The first policy of a workspace has to become the default: a catalog with a
        // rate but no default cannot price anything, and there is nothing else to pick.
        const shouldBeDefault =
          input.isDefault || wasDefault || rows.length === 0;

        // Clear first, then write, in the same transaction: a failure on the second
        // statement rolls the first one back, so no state is ever observed with two
        // defaults or with none.
        if (shouldBeDefault) {
          await this.clearDefaults(repository, rows, existing?.recordId ?? null, actor);
        }

        const values = {
          code,
          name,
          rateBasisPoints: rate.rateBasisPoints.toString(),
          dutyRateBasisPoints: dutyRate.rateBasisPoints.toString(),
          isActive: input.isActive,
          isDefault: shouldBeDefault,
          isExempt: input.isExempt,
        };

        if (existing === null) {
          await repository.insert({
            ...values,
            // `createdBy` belongs to the insert only. An update that rewrote it would
            // turn "who introduced this rate" into "who touched it last".
            createdBy: actor,
            updatedBy: actor,
          } as never);
        } else {
          await repository.update({ id: existing.recordId }, {
            ...values,
            updatedBy: actor,
          } as never);
        }

        const repaired = await this.enforceSingleActiveDefault(repository, actor);

        return {
          kind: 'OK',
          policies: await this.findAll(repository),
          message: repaired
            ? 'سیاست مالیات ذخیره شد؛ وضعیت پیش‌فرض ناسازگار بود و به قدیمی‌ترین سیاست فعال بازگردانده شد'
            : 'سیاست مالیات ذخیره شد',
        };
      }),
    );
  }

  async setDefaultPolicy(
    recordId: string,
    authContext: WorkspaceAuthContext,
  ): Promise<TaxPolicyMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const rows = await this.findAll(repository);
        const chosen = rows.find((row) => row.recordId === recordId);

        if (chosen === undefined) {
          return refused('TAX_POLICY_NOT_FOUND', 'سیاست مالیات پیدا نشد');
        }

        if (chosen.isActive === false) {
          return refused(
            'TAX_POLICY_DEFAULT_MUST_BE_ACTIVE',
            'سیاست غیرفعال را نمی‌توان پیش‌فرض کرد',
          );
        }

        await this.clearDefaults(repository, rows, recordId, actor);
        await repository.update({ id: recordId }, { isDefault: true, updatedBy: actor } as never);
        const repaired = await this.enforceSingleActiveDefault(repository, actor);

        return {
          kind: 'OK',
          policies: await this.findAll(repository),
          message: repaired
            ? 'سیاست پیش‌فرض تغییر کرد؛ وضعیت ناسازگار به قدیمی‌ترین سیاست فعال بازگردانده شد'
            : 'سیاست پیش‌فرض تغییر کرد',
        };
      }),
    );
  }

  async deactivatePolicy(
    recordId: string,
    authContext: WorkspaceAuthContext,
  ): Promise<TaxPolicyMutationOutcome> {
    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = this.repository(scope);
        const rows = await this.findAll(repository);
        const chosen = rows.find((row) => row.recordId === recordId);

        if (chosen === undefined) {
          return refused('TAX_POLICY_NOT_FOUND', 'سیاست مالیات پیدا نشد');
        }

        if (chosen.isDefault === true) {
          return refused(
            'TAX_POLICY_IS_DEFAULT',
            'سیاست پیش‌فرض را ابتدا با انتخاب سیاست دیگری جابه‌جا کنید',
          );
        }

        const activeOthers = rows.filter(
          (row) => row.isActive !== false && row.recordId !== recordId,
        );

        if (activeOthers.length === 0) {
          return refused(
            'TAX_POLICY_LAST_ACTIVE',
            'حداقل یک سیاست مالیات فعال لازم است',
          );
        }

        // Deactivation, never destruction: documents that name this policy must stay
        // readable forever.
        await repository.update({ id: recordId }, { isActive: false, updatedBy: actor } as never);
        const repaired = await this.enforceSingleActiveDefault(repository, actor);

        return {
          kind: 'OK',
          policies: await this.findAll(repository),
          message: repaired
            ? 'سیاست مالیات غیرفعال شد؛ وضعیت پیش‌فرض ناسازگار به قدیمی‌ترین سیاست فعال بازگردانده شد'
            : 'سیاست مالیات غیرفعال شد',
        };
      }),
    );
  }

  private async readPolicies(
    authContext: WorkspaceAuthContext,
    message: string,
  ): Promise<TaxPolicyMutationOutcome> {
    return this.inWorkspace(authContext, async () => {
      const repository = this.workspaceOrmManager.getRepository<WorkspaceTaxPolicyRow>(
        'taxPolicy',
        { shouldBypassPermissionChecks: true },
      );
      const policies = await this.findAll(repository);

      return { kind: 'OK', policies, message };
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
      // Serialize policy mutations for this workspace. Clearing the old default and
      // setting the new one are two statements; without the lock two concurrent
      // requests interleave and leave two defaults behind. The same lock is taken in
      // shared mode by a draft save, so a rate cannot change mid-pricing.
      await acquireTaxPolicyExclusiveLock(scope);

      return work(scope);
    });
  }

  private repository(
    scope: WorkspaceTransactionScope,
  ): WorkspaceRepository<WorkspaceTaxPolicyRow> {
    return scope.getRepository<WorkspaceTaxPolicyRow>('taxPolicy', {
      shouldBypassPermissionChecks: true,
    });
  }

  // The audit columns are NOT NULL and the ORM does not derive them from the request,
  // so every write names its actor. A policy written by an API key is an API write,
  // not an anonymous one: the settings page must be able to say who changed a rate.
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
    repository: WorkspaceRepository<WorkspaceTaxPolicyRow>,
  ): Promise<WorkspaceTaxPolicyView[]> {
    const rows = await repository.find({
      select: POLICY_COLUMNS,
      order: { createdAt: 'ASC' },
    });

    return rows.flatMap((row) => {
      const view = toView(row);

      return view === null ? [] : [view];
    });
  }

  private async clearDefaults(
    repository: WorkspaceRepository<WorkspaceTaxPolicyRow>,
    rows: WorkspaceTaxPolicyView[],
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

  // The invariant is "exactly one ACTIVE default", not "one default": a default on an
  // inactive row prices nothing, and two defaults make the choice non-deterministic.
  // Contradictory state is repaired deterministically (oldest active policy wins) and
  // reported in the outcome message — never silently. Running it after every write
  // means the transaction that introduced the contradiction is the one that fixes it.
  private async enforceSingleActiveDefault(
    repository: WorkspaceRepository<WorkspaceTaxPolicyRow>,
    actor: ActorMetadata,
  ): Promise<boolean> {
    const rows = await repository.find({
      select: POLICY_COLUMNS,
      order: { createdAt: 'ASC' },
    });
    const activeRows = rows.filter((row) => row.isActive === true);

    if (activeRows.length === 0) {
      // No permitted mutation can leave the catalog without an active rate; reaching
      // here means a write path was bypassed. Throwing aborts the transaction instead
      // of persisting a catalog that cannot price a document.
      throw new Error(
        'TAX_POLICY_INVARIANT_VIOLATED: a workspace must keep at least one active tax policy',
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
    rows: WorkspaceTaxPolicyView[],
    rateBasisPoints: bigint,
  ): string {
    const base = `TAX_${rateBasisPoints.toString()}`;
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
