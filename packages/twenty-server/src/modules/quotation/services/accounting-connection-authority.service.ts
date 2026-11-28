import { randomUUID } from 'node:crypto';
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
import { acquireAccountingConnectionExclusiveLock } from 'src/modules/quotation/utils/accounting-connection-lock.util';
import { isValidWorkspaceDefaultConnection } from 'src/modules/quotation/utils/resolve-accounting-destination.util';

const CONNECTION_COLUMNS = {
  id: true,
  name: true,
  adapterId: true,
  adapterVersion: true,
  capabilities: true,
  isActive: true,
  isDefault: true,
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
  datasetBindingId: true,
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
      profile === 'PARTY_UAT' ||
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
  // Default is opt-in only. A missing/legacy column reads as false so old workspaces never
  // silently gain a destination from row order.
  isDefault: row.isDefault === true,
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
      this.runLocked(async (scope) => {
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

        // A bound connection owns its remote identities and its history. Repointing
        // it to another vendor or dataset would silently reinterpret every mapping.
        if (existing !== null && (
          readText(existing.adapterId) !== adapterId ||
          readText(existing.baseUrl).replace(/\/+$/, '') !== settings.value.baseUrl ||
          (adapterId === 'asan' && readText(existing.remoteUserId) !== settings.value.remoteUserId) ||
          (adapterId === 'mock' && readFinancialSettings(existing.financialSettings).mockProfile !== settings.value.financial.mockProfile) ||
          (readMoneyUnit(existing.moneyUnit) !== 'UNCONFIRMED' &&
            readMoneyUnit(existing.moneyUnit) !== settings.value.moneyUnit)
        )) {
          if (readText(existing.datasetBindingId)) return refused('ACCOUNTING_DATASET_REBIND_REQUIRED', 'هویت مجموعه داده این اتصال قفل شده است؛ اتصال جدید ایجاد کنید.');
          for (const object of ['accountingItemLink', 'accountingPartyLink', 'accountingSyncOperation']) {
            const history = scope.getRepository<{ id: string; connectionId: string }>(
              object, { shouldBypassPermissionChecks: true },
            );
            const linked = await history.findOne({
              where: { connectionId: existing.id }, withDeleted: true, select: { id: true },
            });
            if (linked !== null) {
              return refused('ACCOUNTING_DATASET_REBIND_REQUIRED',
                'این اتصال دارای سوابق است؛ برای تغییر مقصد، هویت داده یا واحد پول، اتصال جدید ایجاد کنید.');
            }
          }
        }

        const affectedRecordId = existing?.id ?? randomUUID();
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
            id: affectedRecordId,
            ...values,
            isActive: true,
            // New rows are never auto-promoted: an authorized set-default must opt in.
            isDefault: false,
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
          affectedRecordId,
          message:
            existing === null
              ? 'اتصال حسابداری ثبت شد؛ ارسال مالی همچنان غیرفعال است'
              : 'تنظیمات اتصال حسابداری ذخیره شد؛ ارسال مالی همچنان غیرفعال است',
        };
      }),
    );
  }

  // Exactly one active workspace default. Concurrent callers serialize under the advisory
  // lock so two set-default requests cannot leave two true flags. Inactive rows are refused;
  // old workspaces with every row false stay that way until this method runs.
  // Separate, explicit administrator attestation after independently approved G1
  // dataset verification. No network calls or automatic activation here.
  async bindDataset(input: { recordId: string; datasetId: string; expectedBaseUrl: string; expectedRemoteUserId: string; confirmed: boolean }, authContext: WorkspaceAuthContext): Promise<AccountingConnectionOutcome> {
    if (authContext.type !== 'user' || await this.resolveAuthority(authContext) !== 'SETTINGS_ROLE') return refused('FORBIDDEN', 'تأیید هویت مقصد فقط با مجوز مدیر تنظیمات امکان‌پذیر است.');
    if (!input.confirmed || !/^[A-Za-z0-9_-]{1,128}$/.test(input.datasetId) || !input.recordId || !input.expectedBaseUrl) return refused('INVALID_INPUT', 'هویت مجموعه داده و تأیید صریح بررسی مقصد الزامی است.');
    return this.inWorkspace(authContext, () => this.runLocked(async scope => {
      const repository = scope.getRepository<WorkspaceAccountingConnectionRow>('accountingConnection', { shouldBypassPermissionChecks: true });
      const row = await repository.findOne({ where: { id: input.recordId }, select: CONNECTION_COLUMNS });
      if (!row || row.adapterId !== 'asan' || row.isActive !== true ||
          readText(row.baseUrl).replace(/\\/+$/, '') !== input.expectedBaseUrl.replace(/\\/+$/, '') ||
          readText(row.remoteUserId) !== input.expectedRemoteUserId) return refused('ACCOUNTING_CONNECTION_CHANGED', 'مقصد یا کاربر اتصال تغییر کرده است.');
      const bound = readText(row.datasetBindingId);
      if (bound && bound !== input.datasetId) return refused('ACCOUNTING_DATASET_REBIND_REQUIRED', 'تغییر هویت مقصد مجاز نیست؛ اتصال جدید ایجاد کنید.');
      if (!bound) {
        for (const object of ['accountingItemLink', 'accountingPartyLink', 'accountingSyncOperation']) {
          const history = await scope.getRepository<{ id: string; connectionId: string }>(object, { shouldBypassPermissionChecks: true })
            .findOne({ where: { connectionId: row.id }, withDeleted: true, select: { id: true } });
          if (history) return refused('ACCOUNTING_DATASET_REBIND_REQUIRED', 'اتصال دارای سابقه بدون هویت تأییدشده است؛ ابتدا سوابق را مستقل بررسی کنید.');
        }
        const changed = await repository.update({ id: row.id }, { datasetBindingId: input.datasetId, updatedBy: this.actorFor(authContext) } as never);
        if (changed.affected !== 1) return refused('ACCOUNTING_CONNECTION_CHANGED', 'ثبت هویت مقصد تأیید نشد.');
      }
      return { kind: 'OK', connections: await this.findAll(repository), affectedRecordId: row.id, message: 'هویت مقصد ثبت شد؛ مجوز مستقل اتصال واقعی همچنان لازم است.' };
    }));
  }

  async setDefaultConnection(
    recordId: string,
    authContext: WorkspaceAuthContext,
  ): Promise<AccountingConnectionOutcome> {
    const authority = await this.resolveAuthority(authContext);

    if (authority === null) {
      return refused(
        'ACCOUNTING_SETTINGS_FORBIDDEN',
        'تغییر مقصد پیش‌فرض حسابداری فقط برای مدیر فضای کاری یا هویت برنامهٔ مجاز انجام می‌شود',
      );
    }

    const id = recordId.trim();

    if (id === '') {
      return refused('INVALID_INPUT', 'اتصال حسابداری را انتخاب کنید');
    }

    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = scope.getRepository<WorkspaceAccountingConnectionRow>(
          'accountingConnection',
          { shouldBypassPermissionChecks: true },
        );
        const rows = await this.findAll(repository);
        const chosen = rows.find((row) => row.recordId === id);

        if (chosen === undefined) {
          return refused(
            'ACCOUNTING_CONNECTION_NOT_FOUND',
            'اتصال حسابداری انتخاب‌شده پیدا نشد',
          );
        }

        if (chosen.isActive !== true) {
          return refused(
            'ACCOUNTING_CONNECTION_DEFAULT_MUST_BE_ACTIVE',
            'اتصال غیرفعال را نمی‌توان به‌عنوان پیش‌فرض فضای کاری تنظیم کرد',
          );
        }

        await this.clearDefaults(repository, rows, id, actor);
        await repository.update(
          { id },
          { isDefault: true, updatedBy: actor } as never,
        );
        const repaired = await this.enforceSingleActiveDefault(repository, actor);

        return {
          kind: 'OK' as const,
          connections: await this.findAll(repository),
          message: repaired
            ? 'مقصد پیش‌فرض تغییر کرد؛ وضعیت ناسازگار به یک پیش‌فرض فعال واحد بازگردانده شد'
            : 'مقصد پیش‌فرض فضای کاری تغییر کرد',
        };
      }),
    );
  }

  // Soft retire: isActive=false. History, mappings and settings stay on the row. If the
  // row was the workspace default, isDefault is cleared in the same locked transaction and
  // no other connection is auto-promoted.
  async deactivateConnection(
    recordId: string,
    authContext: WorkspaceAuthContext,
  ): Promise<AccountingConnectionOutcome> {
    const authority = await this.resolveAuthority(authContext);

    if (authority === null) {
      return refused(
        'ACCOUNTING_SETTINGS_FORBIDDEN',
        'بازنشسته‌کردن اتصال حسابداری فقط برای مدیر فضای کاری یا هویت برنامهٔ مجاز انجام می‌شود',
      );
    }

    const id = recordId.trim();

    if (id === '') {
      return refused('INVALID_INPUT', 'اتصال حسابداری را انتخاب کنید');
    }

    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = scope.getRepository<WorkspaceAccountingConnectionRow>(
          'accountingConnection',
          { shouldBypassPermissionChecks: true },
        );
        const rows = await this.findAll(repository);
        const chosen = rows.find((row) => row.recordId === id);

        if (chosen === undefined) {
          return refused(
            'ACCOUNTING_CONNECTION_NOT_FOUND',
            'اتصال حسابداری انتخاب‌شده پیدا نشد',
          );
        }

        if (chosen.isActive !== true) {
          return {
            kind: 'OK' as const,
            connections: rows,
            message: 'این اتصال از قبل بازنشسته است',
          };
        }

        const wasDefault = chosen.isDefault === true;

        await repository.update(
          { id },
          {
            isActive: false,
            // Retiring the default must not leave an inactive default badge, and must not
            // invent a replacement — the workspace stays without a default until set-default.
            ...(wasDefault ? { isDefault: false } : {}),
            updatedBy: actor,
          } as never,
        );
        const repaired = await this.enforceSingleActiveDefault(repository, actor);

        return {
          kind: 'OK' as const,
          connections: await this.findAll(repository),
          message: wasDefault
            ? repaired
              ? 'اتصال بازنشسته شد و پیش‌فرض فضای کاری برداشته شد؛ وضعیت ناسازگار نیز اصلاح شد'
              : 'اتصال بازنشسته شد و پیش‌فرض فضای کاری برداشته شد؛ مقصد پیش‌فرض دیگری خودکار انتخاب نشد'
            : 'اتصال حسابداری بازنشسته شد؛ سوابق و نگاشت‌ها حفظ شدند',
        };
      }),
    );
  }

  // Bring a retired connection back for new work. Reactivation never restores or invents
  // workspace default — that requires an explicit set-default after the row is active again.
  async reactivateConnection(
    recordId: string,
    authContext: WorkspaceAuthContext,
  ): Promise<AccountingConnectionOutcome> {
    const authority = await this.resolveAuthority(authContext);

    if (authority === null) {
      return refused(
        'ACCOUNTING_SETTINGS_FORBIDDEN',
        'فعال‌سازی مجدد اتصال حسابداری فقط برای مدیر فضای کاری یا هویت برنامهٔ مجاز انجام می‌شود',
      );
    }

    const id = recordId.trim();

    if (id === '') {
      return refused('INVALID_INPUT', 'اتصال حسابداری را انتخاب کنید');
    }

    const actor = this.actorFor(authContext);

    return this.inWorkspace(authContext, () =>
      this.runLocked(async (scope) => {
        const repository = scope.getRepository<WorkspaceAccountingConnectionRow>(
          'accountingConnection',
          { shouldBypassPermissionChecks: true },
        );
        const rows = await this.findAll(repository);
        const chosen = rows.find((row) => row.recordId === id);

        if (chosen === undefined) {
          return refused(
            'ACCOUNTING_CONNECTION_NOT_FOUND',
            'اتصال حسابداری انتخاب‌شده پیدا نشد',
          );
        }

        if (chosen.isActive === true) {
          return {
            kind: 'OK' as const,
            connections: rows,
            message: 'این اتصال از قبل فعال است',
          };
        }

        await repository.update(
          { id },
          {
            isActive: true,
            // Explicit false: a corrupt inactive+default row must not come back as default.
            isDefault: false,
            updatedBy: actor,
          } as never,
        );
        await this.enforceSingleActiveDefault(repository, actor);

        return {
          kind: 'OK' as const,
          connections: await this.findAll(repository),
          message:
            'اتصال دوباره فعال شد؛ برای استفاده به‌عنوان مقصد رسمی، پیش‌فرض فضای کاری را جداگانه تنظیم کنید',
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
      }, authContext, existing.id);

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

      const stored = await this.runLocked(async (scope) => {
        const transactionalRepository =
          scope.getRepository<WorkspaceAccountingConnectionRow>(
            'accountingConnection',
            { shouldBypassPermissionChecks: true },
          );

        const current = await transactionalRepository.findOne({
          where: { id: existing.id }, select: CONNECTION_COLUMNS,
        });
        if (current === null || readText(current.adapterId) !== readText(existing.adapterId) ||
          readText(current.baseUrl) !== readText(existing.baseUrl) ||
          readText(current.adapterVersion) !== readText(existing.adapterVersion) ||
          current.transportApproved !== existing.transportApproved ||
          current.isActive !== existing.isActive ||
          readText(current.moneyUnit) !== readText(existing.moneyUnit) ||
          readText(current.lastHealthCheckAt) !== readText(existing.lastHealthCheckAt) ||
          readText(current.lastHealthMessage) !== readText(existing.lastHealthMessage)) return false;

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
        return true;
      });

      if (!stored) return refused('ACCOUNTING_CONNECTION_CHANGED',
        'تنظیمات اتصال هنگام آزمایش تغییر کرد؛ آزمایش را دوباره انجام دهید.');
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

  private runLocked<T>(
    work: (scope: WorkspaceTransactionScope) => Promise<T>,
  ): Promise<T> {
    return this.workspaceOrmManager.runInWorkspaceTransaction(async (scope) => {
      await acquireAccountingConnectionExclusiveLock(scope);

      return work(scope);
    });
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

  private async clearDefaults(
    repository: WorkspaceRepository<WorkspaceAccountingConnectionRow>,
    rows: AccountingConnectionView[],
    keepRecordId: string,
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

  // Repairs corruption (two defaults, or an inactive default) without inventing a default
  // when none exists. Returning true means a repair write happened.
  private async enforceSingleActiveDefault(
    repository: WorkspaceRepository<WorkspaceAccountingConnectionRow>,
    actor: ActorMetadata,
  ): Promise<boolean> {
    const rows = await this.findAll(repository);
    const validDefaults = rows.filter((row) =>
      isValidWorkspaceDefaultConnection({
        recordId: row.recordId,
        isActive: row.isActive,
        isDefault: row.isDefault,
      }),
    );
    let repaired = false;

    for (const row of rows) {
      if (row.isDefault && row.isActive !== true) {
        await repository.update(
          { id: row.recordId },
          { isDefault: false, updatedBy: actor } as never,
        );
        repaired = true;
      }
    }

    if (validDefaults.length <= 1) {
      return repaired;
    }

    const keepId = validDefaults[0].recordId;

    for (const row of validDefaults.slice(1)) {
      await repository.update(
        { id: row.recordId },
        { isDefault: false, updatedBy: actor } as never,
      );
      repaired = true;
    }

    // keepId is already true; silence unused if the slice emptied nothing else.
    void keepId;

    return repaired;
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
