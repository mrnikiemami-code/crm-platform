import { Injectable } from '@nestjs/common';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import { acquireAccountingConnectionWorkLock } from 'src/modules/quotation/utils/accounting-connection-lock.util';

type FinanceRequest = {
  connectionId: string;
  partyType: 'PERSON' | 'COMPANY';
  internalPartyId: string;
  report: 'SUMMARY' | 'CARDEX' | 'PROFORMAS';
  count?: number;
  from?: string;
  to?: string;
};
type Link = { id: string; externalPartyId: string; internalPartyId: string; partyType: string; syncStatus: string; remoteVersion: string | null; deletedAt?: string | Date | null };
type Worker = (command: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const exactLong = (value: unknown): value is string => typeof value === 'string' &&
  /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
const dateMs = (value: unknown): number | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
};
const failure = (code: string) => ({ success: false as const, code, message: 'گزارش مالی مشتری در دسترس نیست یا مجوز آن تأیید نشده است.' });

export const parseCustomerFinanceRequest = (raw: unknown): FinanceRequest | null => {
  const row = object(raw);
  if (!row || !uuid(row.connectionId) || !uuid(row.internalPartyId) ||
      (row.partyType !== 'PERSON' && row.partyType !== 'COMPANY') ||
      (row.report !== 'SUMMARY' && row.report !== 'CARDEX' && row.report !== 'PROFORMAS')) return null;
  if (row.report === 'SUMMARY') {
    if (row.from !== undefined || row.to !== undefined || row.count !== undefined) return null;
    return { connectionId: row.connectionId, internalPartyId: row.internalPartyId, partyType: row.partyType, report: row.report };
  }
  if (row.report === 'PROFORMAS') {
    if (row.from !== undefined || row.to !== undefined || typeof row.count !== 'number' ||
        !Number.isSafeInteger(row.count) || row.count < 1 || row.count > 100) return null;
    return { connectionId: row.connectionId, internalPartyId: row.internalPartyId, partyType: row.partyType, report: row.report, count: row.count };
  }
  if (row.count !== undefined) return null;
  const start = dateMs(row.from), end = dateMs(row.to);
  if (start === null || end === null || start < 0 || end < start || end - start >= 93 * 86400000) return null;
  return { connectionId: row.connectionId, internalPartyId: row.internalPartyId, partyType: row.partyType,
    report: row.report, from: row.from as string, to: row.to as string };
};

@Injectable()
export class AccountingCustomerFinanceService {
  constructor(private readonly orm: WorkspaceOrmManager, private readonly permissions: QuotationPermissionService) {}

  async read(input: FinanceRequest, auth: WorkspaceAuthContext, worker: Worker) {
    // Conservative first-release policy: a real user with settings authority
    // AND native read visibility of this person/company. No API/app-token access.
    if (auth.type !== 'user' || await this.permissions.resolveSettingsAuthority(auth, 'accountingConnection') !== 'SETTINGS_ROLE') return failure('FORBIDDEN');
    const role = await this.permissions.resolveRoleId(auth);
    if (!role) return failure('FORBIDDEN');
    try {
      return await this.orm.executeInWorkspaceContext(() => this.orm.runInWorkspaceTransaction(async scope => {
        await acquireAccountingConnectionWorkLock(scope);
        const visible = await scope.getRepository<{ id: string }>(input.partyType === 'PERSON' ? 'person' : 'company', { unionOf: [role] })
          .findOne({ where: { id: input.internalPartyId }, select: { id: true } });
        if (!visible) return failure('FORBIDDEN');
        const destination = await scope.getRepository<{ id: string; isActive: boolean; adapterId: string; datasetBindingId: string | null }>('accountingConnection', { shouldBypassPermissionChecks: true })
          .findOne({ where: { id: input.connectionId, isActive: true }, select: { id: true, isActive: true, adapterId: true, datasetBindingId: true } });
        if (!destination || destination.isActive !== true || destination.adapterId !== 'asan' || !destination.datasetBindingId) return failure('ASAN_TRANSPORT_UNAVAILABLE');
        const links = scope.getRepository<Link>('accountingPartyLink', { shouldBypassPermissionChecks: true });
        const forward = await links.find({ where: { connectionId: input.connectionId, partyType: input.partyType, internalPartyId: input.internalPartyId }, withDeleted: true, take: 2 });
        if (forward.length !== 1 || forward[0].deletedAt || forward[0].syncStatus !== 'LINKED' ||
            !forward[0].remoteVersion || !exactLong(forward[0].externalPartyId)) return failure('ACCOUNTING_PARTY_IDENTITY_CONFLICT');
        const link = forward[0];
        // Share the inbound identity lock before validating the reverse link.
        await scope.executeRawQuery('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [JSON.stringify(['accounting-party-source', scope.workspaceId, input.connectionId, link.externalPartyId])]);
        const current = await links.find({ where: { connectionId: input.connectionId, partyType: input.partyType, internalPartyId: input.internalPartyId }, withDeleted: true, take: 2 });
        const reverse = await links.find({ where: { connectionId: input.connectionId, externalPartyId: link.externalPartyId }, withDeleted: true, take: 2 });
        if (current.length !== 1 || reverse.length !== 1 || current[0].id !== link.id ||
            current[0].remoteVersion !== link.remoteVersion || current[0].externalPartyId !== link.externalPartyId ||
            current[0].deletedAt || current[0].syncStatus !== 'LINKED' ||
            reverse[0].id !== link.id || reverse[0].deletedAt || reverse[0].syncStatus !== 'LINKED' ||
            reverse[0].partyType !== input.partyType || reverse[0].internalPartyId !== input.internalPartyId) return failure('ACCOUNTING_PARTY_IDENTITY_CONFLICT');
        // Only the validated link can supply the vendor identity. Never accept
        // a caller-provided external customer ID, URL or report query.
        const response = await worker({ connectionId: input.connectionId, externalPartyId: link.externalPartyId,
          report: input.report, ...(input.report === 'CARDEX' ? { from: input.from, to: input.to } : {}),
          ...(input.report === 'PROFORMAS' ? { count: input.count } : {}) });
        if (!response || response.success !== true) return failure(typeof response?.code === 'string' ? response.code : 'ACCOUNTING_RUNTIME_UNAVAILABLE');
        const report = object(response.observation);
        if (!report || report.customerExternalId !== link.externalPartyId || report.report !== input.report ||
            report.connectionId !== input.connectionId || report.adapterId !== 'asan' || report.certified !== false ||
            (input.report === 'CARDEX' && (report.from !== input.from || report.to !== input.to || !Array.isArray(report.rows) || report.rows.length > 500)) ||
            (input.report === 'PROFORMAS' && (report.count !== input.count || !Array.isArray(report.rows) || report.rows.length > (input.count ?? 0)))) return failure('ASAN_INCOMPLETE_DATASET');
        return { success: true, observation: report };
      }), auth);
    } catch {
      return failure('ACCOUNTING_RUNTIME_UNAVAILABLE');
    }
  }
}
