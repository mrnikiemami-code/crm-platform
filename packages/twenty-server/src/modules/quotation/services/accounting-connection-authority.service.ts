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
  type AccountingConnectionOutcome,
  type AccountingConnectionView,
  type AccountingHealthInput,
  type SaveAccountingConnectionInput,
  type WorkspaceAccountingConnectionRow,
} from 'src/modules/quotation/types/accounting-connection.type';
import {
  accountingConnectionColumnsFromSettings,
  isKnownAccountingAdapterId,
  parseAccountingConnectionSettings,
  type AccountingConnectionSettings,
} from 'src/modules/quotation/utils/accounting-connection-settings.util';
import { type TaxSettingsAuthority } from 'src/modules/quotation/types/tax-policy.type';

const CONNECTION_COLUMNS = {
  id: true,
  name: true,
  adapterId: true,
  adapterVersion: true,
  capabilities: true,
  isActive: true,
  baseUrl: true,
  remoteUserId: true,
  defaultStorageId: true,
  moneyUnit: true,
  transportApproved: true,
  specialCodes: true,
  healthState: true,
  lastHealthCheckAt: true,
  lastHealthMessage: true,
  verificationState: true,
} as const;

const HEALTH_STATES = ['UNKNOWN', 'OK', 'FAILED'] as const;

const refused = (
  code: string,
  message: string,
): AccountingConnectionOutcome => ({ kind: 'REFUSED', code, message });

// A stored timestamp comes back as a Date from the ORM, and a legacy row may hold a
// value written before a column existed; neither may crash a read of the destination.
const readText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return '';
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readSpecialCodes = (
  value: unknown,
): AccountingConnectionSettings['specialCodes'] => {
  const raw = asRecord(value) ?? {};
  const mappings = asRecord(raw.taxPolicyMappings) ?? {};

  return {
    discount: raw.discount === true,
    duty: raw.duty === true,
    tax: raw.tax === true,
    ...(Object.keys(mappings).length === 0
      ? {}
      : {
          taxPolicyMappings: Object.fromEntries(
            Object.entries(mappings).flatMap(([key, entry]) =>
              typeof entry === 'string' && entry.trim() !== ''
                ? [[key.trim(), entry.trim()]]
                : [],
            ),
          ),
        }),
  };
};

const readMoneyUnit = (value: string | null): AccountingConnectionSettings['moneyUnit'] =>
  value === 'RIAL' || value === 'TOMAN' ? value : 'UNCONFIRMED';

const toView = (row: WorkspaceAccountingConnectionRow): AccountingConnectionView => ({
  recordId: row.id,
  name: readText(row.name) || readText(row.adapterId),
  adapterId: readText(row.adapterId),
  adapterVersion: readText(row.adapterVersion) || null,
  isActive: row.isActive !== false,
  settings: {
    baseUrl: readText(row.baseUrl),
    remoteUserId: readText(row.remoteUserId),
    defaultStorageId: readText(row.defaultStorageId),
    moneyUnit: readMoneyUnit(row.moneyUnit),
    transportApproved: row.transportApproved === true,
    specialCodes: readSpecialCodes(row.specialCodes),
  },
  capabilities: row.capabilities ?? null,
  healthState: readText(row.healthState) || 'UNKNOWN',
  lastHealthCheckAt: readText(row.lastHealthCheckAt) || null,
  lastHealthMessage: readText(row.lastHealthMessage) || null,
  verificationState: readText(row.verificationState) || 'LIVE_UNVERIFIED',
});

const normalizeActor = (actor: ActorMetadata): ActorMetadata => {
  const name = (actor.name ?? '').trim();

  return {
    source: actor.source,
    name: name === '' ? actor.source : name,
    workspaceMemberId: actor.workspaceMemberId ?? null,
    context: actor.context ?? {},
  };
};

// The authority and the only writer for the workspace accounting destination.
//
// WHY THE WRITE LIVES ON THE SERVER: a destination address and an amount unit decide
// where money-bearing documents will later travel, so the decision to change them must
// be made where the caller's workspace role is provable — not in a browser panel and not
// in an app identity that any member's front component can borrow. The public GraphQL
// mutations are closed by the pre-query guard; a person's save arrives here, through the
// REST boundary, and an admin is the only person that boundary admits.
//
// Reads stay open to every authenticated member: seeing which destination the workspace
// is configured for is not a financial decision.
@Injectable()
export class AccountingConnectionAuthorityService {
  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly quotationPermissionService: QuotationPermissionService,
  ) {}

  // `null` means "this caller did not prove settings authority". Nothing here falls
  // back to allowing: a failed role lookup is a refusal.
  async resolveAuthority(
    authContext: WorkspaceAuthContext,
  ): Promise<TaxSettingsAuthority | null> {
    return this.quotationPermissionService.resolveSettingsAuthority(
      authContext,
      'accountingConnection',
    );
  }

  async listConnections(
    authContext: WorkspaceAuthContext,
  ): Promise<AccountingConnectionOutcome> {
    return this.inWorkspace(authContext, async () => {
      const repository = this.repository();

      return {
        kind: 'OK',
        connections: await this.findAll(repository),
        message: 'اتصال‌های حسابداری خوانده شد',
      };
    });
  }

  async saveConnection(
    input: SaveAccountingConnectionInput,
    authContext: WorkspaceAuthContext,
  ): Promise<AccountingConnectionOutcome> {
    const authority = await this.resolveAuthority(authContext);

    if (authority === null) {
      return refused(
        'ACCOUNTING_SETTINGS_FORBIDDEN',
        'تغییر تنظیمات حسابداری فقط برای مدیر فضای کاری یا هویت برنامهٔ مجاز انجام می‌شود',
      );
    }

    const name = input.name.trim();
    const adapterId = input.adapterId.trim();

    if (name === '') {
      return refused('INVALID_INPUT', 'نام اتصال را وارد کنید');
    }

    // An adapter that does not exist cannot be "ready to send": storing its id would
    // advertise a destination nothing can talk to.
    if (!isKnownAccountingAdapterId(adapterId)) {
      return refused(
        'ADAPTER_UNKNOWN',
        'نرم‌افزار انتخاب‌شده آداپتور عملیاتی ندارد',
      );
    }

    const settings = parseAccountingConnectionSettings(input.settings);

    if (!settings.ok) {
      return refused(settings.code, settings.message);
    }

    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runInTransaction(async (scope) => {
        const repository = scope.getRepository<WorkspaceAccountingConnectionRow>(
          'accountingConnection',
          { shouldBypassPermissionChecks: true },
        );
        const existing =
          input.recordId === null
            ? null
            : await repository.findOne({
                where: { id: input.recordId },
                select: CONNECTION_COLUMNS,
              });

        if (input.recordId !== null && existing === null) {
          return refused(
            'ACCOUNTING_CONNECTION_NOT_FOUND',
            'اتصال حسابداری انتخاب‌شده پیدا نشد',
          );
        }

        const values = {
          name,
          adapterId,
          ...accountingConnectionColumnsFromSettings(settings.value),
          // A live adapter has still not answered: only a real read from the vendor
          // turns "unverified" into "verified", never a save.
          verificationState: adapterId === 'mock' ? 'MOCK' : 'LIVE_UNVERIFIED',
        };

        if (existing === null) {
          await repository.insert({
            ...values,
            isActive: true,
            capabilities:
              asRecord(input.capabilities) ?? {
                adapterId,
                declaredBy: 'settings-save',
              },
            createdBy: actor,
            updatedBy: actor,
          } as never);
        } else {
          await repository.update(
            { id: existing.id },
            {
              ...values,
              updatedBy: actor,
            } as never,
          );
        }

        return {
          kind: 'OK' as const,
          connections: await this.findAll(repository),
          message:
            existing === null
              ? 'اتصال حسابداری ثبت شد؛ ارسال مالی همچنان غیرفعال است'
              : 'تنظیمات اتصال حسابداری ذخیره شد؛ ارسال مالی همچنان غیرفعال است',
        };
      }),
    );
  }

  // A health record is evidence, not configuration: the probe itself runs in the app
  // where the one adapter implementation lives, and only its answer is stored here.
  async persistHealth(
    input: AccountingHealthInput,
    authContext: WorkspaceAuthContext,
  ): Promise<AccountingConnectionOutcome> {
    const authority = await this.resolveAuthority(authContext);

    if (authority === null) {
      return refused(
        'ACCOUNTING_SETTINGS_FORBIDDEN',
        'ثبت نتیجهٔ آزمایش اتصال برای این کاربر مجاز نیست',
      );
    }

    if (!(HEALTH_STATES as readonly string[]).includes(input.healthState)) {
      return refused('INVALID_INPUT', 'وضعیت سلامت اتصال نامعتبر است');
    }

    const checkedAt = new Date(input.checkedAt);

    if (Number.isNaN(checkedAt.getTime())) {
      return refused('INVALID_INPUT', 'زمان آزمایش اتصال نامعتبر است');
    }

    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runInTransaction(async (scope) => {
        const repository = scope.getRepository<WorkspaceAccountingConnectionRow>(
          'accountingConnection',
          { shouldBypassPermissionChecks: true },
        );
        const existing = await repository.findOne({
          where: { id: input.recordId },
          select: CONNECTION_COLUMNS,
        });

        if (existing === null) {
          return refused(
            'ACCOUNTING_CONNECTION_NOT_FOUND',
            'اتصال حسابداری انتخاب‌شده پیدا نشد',
          );
        }

        // Verification is derived from what the record can prove, never accepted from
        // the caller: the app's own probe may report a mock destination as MOCK, and a
        // real vendor address stays LIVE_UNVERIFIED until an independent read-only
        // validation exists. A member with settings authority cannot mint LIVE_VERIFIED.
        const verificationState =
          readText(existing.adapterId) === 'mock' ? 'MOCK' : 'LIVE_UNVERIFIED';

        await repository.update(
          { id: existing.id },
          {
            healthState: input.healthState,
            lastHealthMessage: input.message.slice(0, 2_000),
            lastHealthCheckAt: checkedAt.toISOString(),
            verificationState,
            updatedBy: actor,
          } as never,
        );

        return {
          kind: 'OK' as const,
          connections: await this.findAll(repository),
          message: 'نتیجهٔ آزمایش اتصال ثبت شد؛ هیچ سندی به مقصد ارسال نشد',
        };
      }),
    );
  }

  private inWorkspace<T>(
    authContext: WorkspaceAuthContext,
    work: () => Promise<T>,
  ): Promise<T> {
    return this.workspaceOrmManager.executeInWorkspaceContext(work, authContext);
  }

  private runInTransaction<T>(
    work: (scope: WorkspaceTransactionScope) => Promise<T>,
  ): Promise<T> {
    return this.workspaceOrmManager.runInWorkspaceTransaction(async (scope) =>
      work(scope),
    );
  }

  private repository(): WorkspaceRepository<WorkspaceAccountingConnectionRow> {
    return this.workspaceOrmManager.getRepository<WorkspaceAccountingConnectionRow>(
      'accountingConnection',
      { shouldBypassPermissionChecks: true },
    );
  }

  private async findAll(
    repository: WorkspaceRepository<WorkspaceAccountingConnectionRow>,
  ): Promise<AccountingConnectionView[]> {
    const rows = await repository.find({
      select: CONNECTION_COLUMNS,
      order: { createdAt: 'ASC' },
    });

    return rows.map(toView);
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
}
