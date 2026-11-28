import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import { acquireAccountingConnectionWorkLock, acquireAccountingQuotationWorkLock } from 'src/modules/quotation/utils/accounting-connection-lock.util';

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
  /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= BigInt('9223372036854775807');
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
        // Durable intent precedes the vendor read. An unavailable audit store
        // blocks access. A separate transaction commits it while the outer
        // workspace/source lock is still held; no financial contents are logged.
        const requestId = randomUUID();
        const audit = (phase: 'REQUESTED' | 'COMPLETED', outcomeCode: string) =>
          this.appendAccessEvent(requestId, auth.userWorkspaceId, { connectionId: input.connectionId, subjectType: input.partyType, subjectId: input.internalPartyId, report: input.report }, phase, outcomeCode);
        await audit('REQUESTED', 'AUTHORIZED');
        let response: Record<string, unknown> | null = null;
        try {
          response = await worker({ connectionId: input.connectionId, externalPartyId: link.externalPartyId,
            report: input.report, ...(input.report === 'CARDEX' ? { from: input.from, to: input.to } : {}),
            ...(input.report === 'PROFORMAS' ? { count: input.count } : {}) });
        } catch {
          await audit('COMPLETED', 'ACCOUNTING_RUNTIME_UNAVAILABLE');
          return failure('ACCOUNTING_RUNTIME_UNAVAILABLE');
        }
        if (!response || response.success !== true) {
          const code = typeof response?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(response.code)
            ? response.code : 'ACCOUNTING_RUNTIME_UNAVAILABLE';
          await audit('COMPLETED', code);
          return failure(code);
        }
        const report = object(response.observation);
        if (!report || report.customerExternalId !== link.externalPartyId || report.report !== input.report ||
            report.connectionId !== input.connectionId || report.adapterId !== 'asan' || report.certified !== false ||
            (input.report === 'CARDEX' && (report.from !== input.from || report.to !== input.to || !Array.isArray(report.rows) || report.rows.length > 500)) ||
            (input.report === 'PROFORMAS' && (report.count !== input.count || !Array.isArray(report.rows) || report.rows.length > (input.count ?? 0)))) {
          await audit('COMPLETED', 'ASAN_INCOMPLETE_DATASET');
          return failure('ASAN_INCOMPLETE_DATASET');
        }
        await audit('COMPLETED', 'OBSERVATION_RETURNED');
        return { success: true, observation: report };
      }), auth);
    } catch {
      return failure('ACCOUNTING_RUNTIME_UNAVAILABLE');
    }
  }

  // Observe, never settle. G2 has not certified the vendor's financial
  // interpretation; a bounded report is not proof of the payable amount.
  async reconcile(input: { connectionId: string; quotationId: string; operationId: string }, auth: WorkspaceAuthContext, worker: Worker) {
    if (!uuid(input.connectionId) || !uuid(input.quotationId) || !uuid(input.operationId)) return failure('INVALID_INPUT');
    if (auth.type !== 'user' || await this.permissions.resolveSettingsAuthority(auth, 'accountingConnection') !== 'SETTINGS_ROLE') return failure('FORBIDDEN');
    const role = await this.permissions.resolveRoleId(auth);
    if (!role) return failure('FORBIDDEN');
    type Claim = { id: string; connectionId: string; internalEntityId: string; internalRevision: number; kind: string; correlationId: string; state: string; attempts: number; payloadFingerprint: string; payloadSnapshot: string; externalDocumentId: string | null; deletedAt?: string | Date | null };
    try {
      return await this.orm.executeInWorkspaceContext(() => this.orm.runInWorkspaceTransaction(async scope => {
        await acquireAccountingConnectionWorkLock(scope);
        await acquireAccountingQuotationWorkLock(scope, input.connectionId, input.quotationId);
        const visible = await scope.getRepository<{ id: string }>('quotation', { unionOf: [role] })
          .findOne({ where: { id: input.quotationId }, select: { id: true } });
        if (!visible) return failure('FORBIDDEN');
        const destination = await scope.getRepository<{ id: string; isActive: boolean; adapterId: string; datasetBindingId: string | null }>('accountingConnection', { shouldBypassPermissionChecks: true })
          .findOne({ where: { id: input.connectionId, isActive: true }, select: { id: true, isActive: true, adapterId: true, datasetBindingId: true } });
        if (!destination?.isActive || destination.adapterId !== 'asan' || !destination.datasetBindingId) return failure('ASAN_TRANSPORT_UNAVAILABLE');
        const ledger = scope.getRepository<Claim>('accountingSyncOperation', { shouldBypassPermissionChecks: true });
        const readClaim = async () => {
          const rows = await ledger.find({ where: { id: input.operationId, connectionId: input.connectionId }, withDeleted: true, take: 2 });
          const claim = rows[0];
          if (rows.length !== 1 || !claim || claim.deletedAt || claim.id !== input.operationId ||
              claim.connectionId !== input.connectionId || claim.internalEntityId !== input.quotationId ||
              claim.kind !== 'QUOTATION_REVISION_PUSH' || claim.correlationId !== input.operationId ||
              !Number.isSafeInteger(claim.internalRevision) || claim.internalRevision < 1 ||
              claim.attempts !== 1 || !['IN_FLIGHT', 'MANUAL_EXPORT_REQUIRED'].includes(claim.state) ||
              typeof claim.payloadSnapshot !== 'string' || !claim.payloadSnapshot ||
              !/^[a-f0-9]{64}$/.test(claim.payloadFingerprint) ||
              createHash('sha256').update(claim.payloadSnapshot).digest('hex') !== claim.payloadFingerprint) return null;
          return claim;
        };
        const before = await readClaim();
        if (!before) return failure('RECONCILIATION_REQUIRED');
        const requestId = randomUUID();
        const subject = { connectionId: input.connectionId, subjectType: 'QUOTATION', subjectId: input.quotationId, report: 'RECONCILIATION', operationId: input.operationId };
        const audit = (phase: 'REQUESTED' | 'COMPLETED', code: string, evidence?: string) =>
          this.appendAccessEvent(requestId, auth.userWorkspaceId, subject, phase, code, evidence);
        await audit('REQUESTED', 'AUTHORIZED');
        let reply: Record<string, unknown> | null = null;
        try { reply = await worker({ connectionId: input.connectionId, quotationId: input.quotationId, operationId: input.operationId }); }
        catch { /* log a bounded outcome below */ }
        const after = await readClaim();
        const observation = object(reply?.observation);
        const status = observation?.status;
        const remoteId = observation?.externalDocumentId;
        const equal = observation?.priceFieldsEqual;
        const count = observation?.reportCount;
        const validStatus = status === 'IDENTITY_NOT_OBSERVED' || status === 'IDENTITY_CONFLICT' || status === 'DETAIL_MISMATCH' || status === 'DETAILS_OBSERVED';
        const validObservation = validStatus && observation?.fiscalConfirmed === false && observation.replayAllowed === false &&
          typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 && count <= 100 &&
          (status === 'DETAILS_OBSERVED' ? exactLong(remoteId) && typeof equal === 'boolean' :
            status === 'DETAIL_MISMATCH' ? exactLong(remoteId) && equal === null : remoteId === null && equal === null);
        if (!after || after.state !== before.state || after.payloadFingerprint !== before.payloadFingerprint ||
            after.internalRevision !== before.internalRevision || after.externalDocumentId !== before.externalDocumentId ||
            reply?.success !== true || !validObservation) {
          await audit('COMPLETED', 'RECONCILIATION_REQUIRED');
          return failure('RECONCILIATION_REQUIRED');
        }
        const evidence = {
          status, externalDocumentId: remoteId, priceFieldsEqual: equal, reportCount: count,
          fiscalConfirmed: false, replayAllowed: false, claimState: before.state,
          payloadFingerprint: before.payloadFingerprint, revision: before.internalRevision,
          observedAt: new Date().toISOString(),
        };
        await audit('COMPLETED', 'RECONCILIATION_OBSERVED', JSON.stringify(evidence));
        return { success: true, observation: evidence };
      }), auth);
    } catch { return failure('ACCOUNTING_RUNTIME_UNAVAILABLE'); }
  }

  private async appendAccessEvent(requestId: string, actorWorkspaceId: string, input: { connectionId: string; subjectType: string; subjectId: string; report: string; operationId?: string },
    phase: 'REQUESTED' | 'COMPLETED', outcomeCode: string, evidenceJson?: string): Promise<void> {
    if (!actorWorkspaceId) throw new Error('Missing finance audit actor');
    const id = randomUUID();
    await this.orm.runInWorkspaceTransaction(async scope => {
      const result = await scope.getRepository<Record<string, unknown>>('accountingFinanceAccess', { shouldBypassPermissionChecks: true }, { shouldSkipEventEmission: true })
        .insert({ id, name: input.report + ' ' + phase, requestId, actorWorkspaceId, connectionId: input.connectionId,
          subjectType: input.subjectType, subjectId: input.subjectId, reportType: input.report, phase, outcomeCode,
          operationId: input.operationId ?? null, evidenceJson: evidenceJson ?? null });
      if (result.identifiers.length !== 1 || result.identifiers[0]?.id !== id) throw new Error('Finance audit insert not confirmed');
    });
  }
}
