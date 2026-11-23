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
  type AccountingHealthView,
  type SaveAccountingConnectionInput,
  type WorkspaceAccountingConnectionRow,
} from 'src/modules/quotation/types/accounting-connection.type';
import {
  accountingConnectionColumnsFromSettings,
  isKnownAccountingAdapterId,
  parseAccountingConnectionSettings,
  type AccountingConnectionSettings,
} from 'src/modules/quotation/utils/accounting-connection-settings.util';
import { accountingAdapterContract } from 'src/modules/quotation/utils/accounting-adapter-contract.util';
import { readPrivateDestinationAllowlist } from 'src/modules/quotation/utils/accounting-destination-policy.util';
import { AccountingDestinationProbeService } from 'src/modules/quotation/services/accounting-destination-probe.service';
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
  financialSettings: true,
  healthState: true,
  lastHealthCheckAt: true,
  lastHealthMessage: true,
  verificationState: true,
} as const;

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
  const rawRowCodes = asRecord(raw.specialItemCodes) ?? {};
  const specialItemCodes = Object.fromEntries(
    Object.entries(rawRowCodes).flatMap(([key, entry]) =>
      (key === 'discount' || key === 'duty' || key === 'tax') &&
      typeof entry === 'string' &&
      /^\d+$/.test(entry.trim())
        ? [[key, entry.trim()]]
        : [],
    ),
  );

  return {
    discount: raw.discount === true,
    duty: raw.duty === true,
    tax: raw.tax === true,
    ...(Object.keys(specialItemCodes).length === 0
      ? {}
      : { specialItemCodes }),
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

const readFinancialSettings = (
  value: unknown,
): AccountingConnectionSettings['financial'] => {
  const raw = asRecord(value) ?? {};
  const baseCurrency =
    typeof raw.baseCurrency === 'string' && /^[A-Z]{3}$/.test(raw.baseCurrency)
      ? raw.baseCurrency
      : 'IRR';
  const conversionRate =
    typeof raw.conversionRate === 'string' &&
    /^(0|[1-9]\d*)(\.\d{1,6})?$/.test(raw.conversionRate) &&
    Number(raw.conversionRate) > 0
      ? raw.conversionRate
      : '';
  const rawMappings = asRecord(raw.currencyMappings) ?? {};
  const currencyMappings = Object.fromEntries(
    Object.entries(rawMappings).flatMap(([key, entry]) =>
      typeof entry === 'string' && entry.trim() !== ''
        ? [[key.trim(), entry.trim()]]
        : [],
    ),
  );
  const profile = raw.mockProfile;

  return {
    baseCurrency,
    currencyMappings,
    conversionRate,
    mockProfile:
      profile === 'CODED' ||
      profile === 'AMOUNT' ||
      profile === 'AGGREGATE' ||
      profile === 'TAX_ONLY' ||
      profile === 'NO_TAX' ||
      profile === 'SIMPLE'
        ? profile
        : 'SIMPLE',
  };
};

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
    financial: readFinancialSettings(row.financialSettings),
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
    private readonly destinationProbe: AccountingDestinationProbeService,
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

    const settings = parseAccountingConnectionSettings(input.settings, {
      privateDestinationAllowlist: readPrivateDestinationAllowlist(),
      adapterId,
    });

    if (!settings.ok) {
      return refused(settings.code, settings.message);
    }

    // Capabilities come from the adapter contract, never from the request: an authorized
    // caller must not be able to rewrite what the destination can do just by saving. A mock
    // may name one of the closed test profiles, and the profile is expanded here.
    const contract = accountingAdapterContract(adapterId, {
      mockProfile: settings.value.financial.mockProfile,
    });

    if (contract === null) {
      return refused(
        'ADAPTER_UNKNOWN',
        'نرم‌افزار انتخاب‌شده آداپتور عملیاتی ندارد',
      );
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
          adapterVersion: contract.contractVersion,
          capabilities: contract.capabilities,
          ...accountingConnectionColumnsFromSettings(settings.value),
          // A live adapter has still not answered: only a real read from the vendor
          // turns "unverified" into "verified", never a save.
          verificationState: contract.isLive ? 'LIVE_UNVERIFIED' : 'MOCK',
        };

        if (existing === null) {
          await repository.insert({
            ...values,
            isActive: true,
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

  // A health record is evidence, not configuration. The probe runs here, in the trusted
  // process, against an address that is resolved and validated for this request; only its
  // result is stored. The caller supplies neither a state, a time nor a message, so a
  // forged "OK" cannot exist.
  async testConnection(
    recordId: string,
    authContext: WorkspaceAuthContext,
  ): Promise<AccountingConnectionOutcome> {
    const authority = await this.resolveAuthority(authContext);

    if (authority === null) {
      return refused(
        'ACCOUNTING_SETTINGS_FORBIDDEN',
        'ثبت نتیجهٔ آزمایش اتصال برای این کاربر مجاز نیست',
      );
    }

    const id = recordId.trim();

    if (id === '') {
      return refused('INVALID_INPUT', 'اتصال حسابداری را انتخاب کنید');
    }

    return this.inWorkspace(authContext, async () => {
      const repository = this.repository();
      const existing = await repository.findOne({
        where: { id },
        select: CONNECTION_COLUMNS,
      });

      if (existing === null) {
        return refused(
          'ACCOUNTING_CONNECTION_NOT_FOUND',
          'اتصال حسابداری انتخاب‌شده پیدا نشد',
        );
      }

      const contract = accountingAdapterContract(readText(existing.adapterId));

      if (contract === null) {
        return refused(
          'ADAPTER_UNKNOWN',
          'نرم‌افزار اتصال آداپتور عملیاتی ندارد',
        );
      }

      const probe = await this.destinationProbe.probe({
        adapterId: readText(existing.adapterId),
        isLive: contract.isLive,
        healthProbe: contract.healthProbe,
        baseUrl: readText(existing.baseUrl),
        transportApproved: existing.transportApproved === true,
        allowlist: readPrivateDestinationAllowlist(),
      });

      // A live vendor is not "verified" because it answered a read: nothing here proves
      // an accepted write or a mapped document, so the state stays LIVE_UNVERIFIED.
      const verificationState = contract.isLive ? 'LIVE_UNVERIFIED' : 'MOCK';
      // A mock's success is a simulated success. Saying "connection established" would
      // report a network event that never happened.
      const message =
        probe.healthState === 'OK'
          ? contract.isLive
            ? 'پاسخ سرور حسابداری دریافت شد؛ ارسال مالی همچنان غیرفعال است و اتصال واقعی تأیید نشده است'
            : 'آزمایش شبیه‌سازی‌شده موفق بود؛ هیچ تماس واقعی با نرم‌افزار حسابداری انجام نشد'
          : 'آزمایش اتصال ناموفق بود؛ هیچ سندی به مقصد ارسال نشد';
      const health: AccountingHealthView = {
        healthState: probe.healthState,
        message,
        detail: probe.detail,
        checkedAt: probe.checkedAt,
        latencyMs: probe.latencyMs,
      };
      const actor = this.actorFor(authContext);

      await this.runInTransaction(async (scope) => {
        const transactionalRepository =
          scope.getRepository<WorkspaceAccountingConnectionRow>(
            'accountingConnection',
            { shouldBypassPermissionChecks: true },
          );

        await transactionalRepository.update(
          { id: existing.id },
          {
            healthState: probe.healthState,
            lastHealthMessage: probe.detail.slice(0, 2_000),
            lastHealthCheckAt: probe.checkedAt,
            verificationState,
            updatedBy: actor,
          } as never,
        );
      });

      return {
        kind: 'OK' as const,
        connections: await this.findAll(repository),
        message,
        health,
      };
    });
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
