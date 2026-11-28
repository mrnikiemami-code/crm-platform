import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import { acquireAccountingConnectionWorkLock } from 'src/modules/quotation/utils/accounting-connection-lock.util';

type PartyType = 'PERSON' | 'COMPANY';
type Request = { connectionId: string; partyType: PartyType; internalPartyId: string; expectedFingerprint?: string };
type Link = { id: string; connectionId: string; internalPartyId: string; partyType: PartyType; externalPartyId: string; externalCode: string | null; remoteVersion: string | null; sourceProfile: string | null; syncStatus: string; deletedAt?: string | Date | null };
type Operation = { id: string; connectionId: string; internalEntityId: string; kind: string; state: string; attempts: number; correlationId: string; payloadFingerprint: string; payloadSnapshot: string; externalDocumentId: string | null; deletedAt?: string | Date | null };
type Connection = { id: string; adapterId: string; adapterVersion: string; isActive: boolean };
type Profile = {
  partyType: PartyType; externalPartyId: string | null; fullName: string; mobile: string | null; nationalCode: string | null;
  legalNationalId: string | null; economicCode: string | null; firstPhone: string | null; secondPhone: string | null;
  fax: string | null; address: string | null; postalCode: string | null;
};
type Plan = { connectionId: string; partyType: PartyType; internalPartyId: string; adapterId: string; adapterVersion: string; mode: 'CREATE' | 'UPDATE'; operationId: string; expectedRemoteVersion: string | null; linkId: string | null; fingerprint: string; snapshot: string; profile: Profile; sourceProfile: string | null };
type Worker = (action: 'preview-party-push' | 'execute-party-push', body: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
const obj = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const ascii = (value: string) => value.replace(/[۰-۹٠-٩]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.includes(d) ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(d) : '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const nullable = (value: unknown) => text(value) || null;
const national = (value: unknown) => ascii(text(value)).replace(/[\s-]/g, '');
const mobile = (value: unknown) => /^(?:\+98|0098|98|0)?(9\d{9})$/.exec(ascii(text(value)).replace(/[\s()-]/g, ''))?.[1] ?? null;
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const stableId = (...values: string[]) => {
  const h = sha(JSON.stringify(values));
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-5' + h.slice(13, 16) + '-8' + h.slice(17, 20) + '-' + h.slice(20, 32);
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (code: string, message = 'عملیات ارسال مشتری انجام نشد.') => ({ success: false as const, code, message });
class Refusal extends Error { constructor(readonly code: string) { super(code); } }
const requireFact = (value: unknown, code: string): void => { if (!value) throw new Refusal(code); };

export const parsePartyOutboundRequest = (raw: unknown): Request | null => {
  const row = obj(raw);
  if (!row || !uuid.test(text(row.connectionId)) || !uuid.test(text(row.internalPartyId)) ||
      (row.partyType !== 'PERSON' && row.partyType !== 'COMPANY') ||
      (row.expectedFingerprint !== undefined && !/^[a-f0-9]{64}$/.test(text(row.expectedFingerprint)))) return null;
  return { connectionId: text(row.connectionId), partyType: row.partyType, internalPartyId: text(row.internalPartyId),
    ...(row.expectedFingerprint !== undefined ? { expectedFingerprint: text(row.expectedFingerprint) } : {}) };
};

// This maps existing native CRM fields; unsupported vendor-owned fields are
// never guessed, and empty CRM fields never authorize clearing a remote value.
export const buildPartyOutboundProfile = (kind: PartyType, row: Record<string, unknown>, externalPartyId: string | null): Profile | null => {
  const name = obj(row.name);
  const fullName = kind === 'PERSON' ? [text(name?.firstName), text(name?.lastName)].filter(Boolean).join(' ') : text(row.name);
  const rawNational = national(row.nationalCode);
  if (rawNational && !(kind === 'PERSON' ? /^\d{10}$/ : /^\d{11}$/).test(rawNational)) return null;
  const phone = mobile(kind === 'PERSON' ? obj(row.phones)?.primaryPhoneNumber : row.accountingMobile);
  if (!fullName || (!rawNational && !phone)) return null;
  const address = obj(kind === 'PERSON' ? row.accountingAddress : row.address);
  const street = [text(address?.addressStreet1), text(address?.addressStreet2), text(address?.addressCity), text(address?.addressState)].filter(Boolean).join('، ');
  return { partyType: kind, externalPartyId, fullName, mobile: phone ? '0' + phone : null,
    nationalCode: rawNational || null, legalNationalId: kind === 'COMPANY' ? rawNational || null : null,
    economicCode: nullable(row.economicCode), firstPhone: nullable(row.accountingPhone),
    secondPhone: nullable(row.accountingSecondPhone), fax: nullable(row.accountingFax),
    address: street || null, postalCode: nullable(address?.addressPostcode) };
};

@Injectable()
export class AccountingPartyOutboundService {
  constructor(private readonly orm: WorkspaceOrmManager, private readonly permissions: QuotationPermissionService) {}

  async run(request: Request, execute: boolean, authContext: WorkspaceAuthContext, worker: Worker) {
    if (authContext.type !== 'user' || await this.permissions.resolveSettingsAuthority(authContext, 'accountingConnection') === null) return fail('FORBIDDEN');
    const role = await this.permissions.resolveRoleId(authContext);
    if (!role) return fail('FORBIDDEN');
    if (execute && !request.expectedFingerprint) return fail('INVALID_INPUT', 'ابتدا پیش‌نمایش ارسال مشتری را تأیید کنید.');
    try {
      return await this.orm.executeInWorkspaceContext(async () => {
        // This outer transaction holds the retire/settings and per-customer
        // locks. The separate short claim transaction commits before dispatch.
        // Do not use the outer scope to insert the claim.
        return this.orm.runInWorkspaceTransaction(async outer => {
          await acquireAccountingConnectionWorkLock(outer);
          await outer.executeRawQuery('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
            [JSON.stringify(['accounting-party-customer', outer.workspaceId, request.partyType, request.internalPartyId])]);
          const initial = await this.plan(outer, request, role);
          const identityKeys = ([['nationalCode', initial.profile.nationalCode], ['economicCode', initial.profile.economicCode]] as const).flatMap(([field, value]) => value ? [JSON.stringify(['accounting-party-identity', outer.workspaceId, field, value])] : []).sort();
          for (const key of identityKeys) await outer.executeRawQuery('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
          const plan = await this.plan(outer, request, role);
          requireFact(initial.fingerprint === plan.fingerprint, 'RECONCILIATION_REQUIRED');
          const command = { operationId: plan.operationId, mode: plan.mode,
            expectedRemoteVersion: plan.expectedRemoteVersion, profile: plan.profile, sourceProfile: plan.sourceProfile };
          const preview = await worker('preview-party-push', { connectionId: plan.connectionId, command });
          if (preview?.success !== true) return fail(text(preview?.code) || 'ACCOUNTING_RUNTIME_UNAVAILABLE');
          if (!execute) return { success: true, preview: { mode: plan.mode, externalPartyId: plan.profile.externalPartyId,
            fullName: plan.profile.fullName, fingerprint: plan.fingerprint, canExecute: preview.canExecute === true && plan.adapterId === 'mock' } };
          if (plan.adapterId !== 'mock' || preview.canExecute !== true) return fail('ASAN_LIVE_WRITE_NOT_APPROVED');
          if (request.expectedFingerprint !== plan.fingerprint) return fail('RECONCILIATION_REQUIRED', 'اطلاعات مشتری یا مقصد تغییر کرده است؛ پیش‌نمایش جدید بگیرید.');
          await this.orm.runInWorkspaceTransaction(async claimScope => {
            const fresh = await this.plan(claimScope, request, role);
            requireFact(fresh.fingerprint === plan.fingerprint, 'RECONCILIATION_REQUIRED');
            const ledger = claimScope.getRepository<Operation>('accountingSyncOperation', { shouldBypassPermissionChecks: true });
            const existing = await ledger.find({ where: { connectionId: plan.connectionId, internalEntityId: plan.internalPartyId }, withDeleted: true, take: 1001 });
            requireFact(existing.length <= 1000 && !existing.some(op => ['PARTY_CREATE', 'PARTY_UPDATE'].includes(op.kind) &&
              (op.id === plan.operationId || ['IN_FLIGHT', 'MANUAL_EXPORT_REQUIRED', 'FAILED_RETRYABLE'].includes(op.state))), 'RECONCILIATION_REQUIRED');
            const inserted = await ledger.insert({ id: plan.operationId, name: 'ارسال مشتری ' + plan.internalPartyId,
              connectionId: plan.connectionId, kind: plan.mode === 'CREATE' ? 'PARTY_CREATE' : 'PARTY_UPDATE',
              internalEntityId: plan.internalPartyId, internalRevision: null, attempts: 1, state: 'IN_FLIGHT',
              correlationId: plan.operationId, payloadFingerprint: plan.fingerprint, payloadSnapshot: plan.snapshot,
              externalDocumentId: null, errorCode: null } as never);
            requireFact(inserted.identifiers[0]?.id === plan.operationId, 'RECONCILIATION_REQUIRED');
          });
          let result: Record<string, unknown> | null = null;
          try {
            // A second exact profile/link read after durable claim. Even a
            // pre-dispatch failure retains a non-replayable operation record.
            const fresh = await this.plan(outer, request, role);
            requireFact(fresh.fingerprint === plan.fingerprint, 'RECONCILIATION_REQUIRED');
            result = await worker('execute-party-push', { connectionId: plan.connectionId, command });
            const outcome = obj(result?.outcome);
            requireFact(result?.success === true && outcome && /^[1-9]\d*$/.test(text(outcome.externalPartyId)) &&
              text(outcome.remoteVersion) && text(outcome.externalCode) &&
              (plan.mode === 'CREATE' || outcome.externalPartyId === plan.profile.externalPartyId), 'RECONCILIATION_REQUIRED');
            const externalId = text(outcome?.externalPartyId);
            await this.orm.runInWorkspaceTransaction(async finishScope => {
              const latest = await this.plan(finishScope, request, role);
              requireFact(latest.fingerprint === plan.fingerprint, 'RECONCILIATION_REQUIRED');
              // Match the inbound mapper's source-identity lock before checking
              // or writing the reverse link. The outer customer lock is still held.
              await finishScope.executeRawQuery('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify(['accounting-party-source', finishScope.workspaceId, plan.connectionId, externalId])]);
              const links = finishScope.getRepository<Link>('accountingPartyLink', { shouldBypassPermissionChecks: true });
              const reverse = await links.find({ where: { connectionId: plan.connectionId, externalPartyId: externalId }, withDeleted: true, take: 2 });
              requireFact(plan.mode === 'CREATE' ? reverse.length === 0 : reverse.length === 1 && reverse[0].id === plan.linkId && !reverse[0].deletedAt, 'ACCOUNTING_PARTY_IDENTITY_CONFLICT');
              const data = { externalCode: text(outcome?.externalCode), remoteVersion: text(outcome?.remoteVersion),
                syncStatus: 'LINKED', lastSyncedAt: new Date().toISOString(),
                ...(typeof outcome?.sourceProfile === 'string' ? { sourceProfile: outcome.sourceProfile } : {}) };
              if (plan.linkId) {
                const updated = await links.update({ id: plan.linkId, remoteVersion: plan.expectedRemoteVersion }, data as never);
                requireFact(updated.affected === 1, 'RECONCILIATION_REQUIRED');
              } else {
                const linkId = stableId('quotation/accounting-party-outbound-link', plan.connectionId, externalId);
                const inserted = await links.insert({ id: linkId, name: 'مشتری حسابداری ' + externalId,
                  connectionId: plan.connectionId, externalPartyId: externalId, internalPartyId: plan.internalPartyId,
                  partyType: plan.partyType, ...data } as never);
                requireFact(inserted.identifiers[0]?.id === linkId, 'RECONCILIATION_REQUIRED');
              }
              await this.finish(finishScope, plan, 'SUCCEEDED', externalId, null);
            });
            return { success: true, outcome: { operationId: plan.operationId, externalPartyId: externalId } };
          } catch {
            try {
              // Never allow a caller or a second attempt to overwrite success.
              await this.orm.runInWorkspaceTransaction(scope => this.finish(scope, plan, 'MANUAL_EXPORT_REQUIRED',
                text(obj(result?.outcome)?.externalPartyId) || null, 'RECONCILIATION_REQUIRED'));
            } catch { /* durable IN_FLIGHT still prohibits replay */ }
            return fail('RECONCILIATION_REQUIRED', 'نتیجه قطعی ثبت مشتری تأیید نشد؛ ارسال مجدد ممنوع است.');
          }
        });
      }, authContext);
    } catch (error) { return fail(error instanceof Refusal ? error.code : 'ACCOUNTING_RUNTIME_UNAVAILABLE'); }
  }

  private async plan(scope: WorkspaceTransactionScope, request: Request, role: string): Promise<Plan> {
    const connection = await scope.getRepository<Connection>('accountingConnection', { shouldBypassPermissionChecks: true })
      .findOne({ where: { id: request.connectionId }, select: { id: true, adapterId: true, adapterVersion: true, isActive: true } });
    requireFact(connection?.isActive === true && !!connection.adapterVersion, 'CONNECTION_INACTIVE');
    const kind = request.partyType;
    const fields = { id: true, name: true, nationalCode: true, economicCode: true, accountingPhone: true,
      accountingSecondPhone: true, accountingFax: true, updatedAt: true,
      ...(kind === 'PERSON' ? { phones: true, accountingAddress: true } : { accountingMobile: true, address: true }) };
    const customer = await scope.getRepository<Record<string, unknown>>(kind === 'PERSON' ? 'person' : 'company', { unionOf: [role] })
      .findOne({ where: { id: request.internalPartyId }, select: fields });
    requireFact(customer, 'FORBIDDEN');
    const links = await scope.getRepository<Link>('accountingPartyLink', { shouldBypassPermissionChecks: true })
      .find({ where: { connectionId: request.connectionId, internalPartyId: request.internalPartyId, partyType: kind }, withDeleted: true, take: 2 });
    requireFact(links.length <= 1 && (!links[0] || (!links[0].deletedAt && links[0].syncStatus === 'LINKED' && links[0].externalPartyId && links[0].remoteVersion)), 'ACCOUNTING_PARTY_IDENTITY_CONFLICT');
    const link = links[0] ?? null;
    const profile = buildPartyOutboundProfile(kind, customer!, link?.externalPartyId ?? null);
    requireFact(profile, 'ASAN_CUSTOMER_LOOKUP_REQUIRED');
    // Strong identity collisions include soft-deleted records; disclose only
    // a conflict code, never another customer's identity to this caller.
    if (profile?.nationalCode) {
      const code = profile.nationalCode;
      const variants = [...new Set([code, code.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]), code.replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)])])];
      for (const object of ['person', 'company']) {
        const rows = await scope.getRepository<{ id: string; nationalCode: string }>(object, { shouldBypassPermissionChecks: true })
          .find({ where: variants.map(nationalCode => ({ nationalCode })), withDeleted: true, take: 3, select: { id: true } });
        requireFact(rows.length < 3 && rows.every(candidate => candidate.id === request.internalPartyId && object === (kind === 'PERSON' ? 'person' : 'company')), 'ACCOUNTING_PARTY_IDENTITY_CONFLICT');
      }
    }
    const mode = link ? 'UPDATE' as const : 'CREATE' as const;
    // No personal profile data in the accounting ledger snapshot.
    const snapshot = JSON.stringify({ version: 1, connectionId: request.connectionId, adapterId: connection!.adapterId,
      adapterVersion: connection!.adapterVersion, partyType: kind, internalPartyId: request.internalPartyId,
      mode, linkId: link?.id ?? null, expectedRemoteVersion: link?.remoteVersion ?? null,
      profileDigest: sha(JSON.stringify(profile)), sourceProfileDigest: sha(link?.sourceProfile ?? '') });
    const fingerprint = sha(snapshot);
    const operationId = stableId('quotation/party-outbound-v1', request.connectionId, kind, request.internalPartyId, mode,
      mode === 'CREATE' ? 'once' : fingerprint);
    return { connectionId: request.connectionId, partyType: kind, internalPartyId: request.internalPartyId,
      adapterId: connection!.adapterId, adapterVersion: connection!.adapterVersion, mode, operationId,
      expectedRemoteVersion: link?.remoteVersion ?? null, linkId: link?.id ?? null,
      fingerprint, snapshot, profile: profile!, sourceProfile: link?.sourceProfile ?? null };
  }

  private async finish(scope: WorkspaceTransactionScope, plan: Plan, state: 'SUCCEEDED' | 'MANUAL_EXPORT_REQUIRED', externalDocumentId: string | null, errorCode: string | null) {
    const result = await scope.getRepository<Operation>('accountingSyncOperation', { shouldBypassPermissionChecks: true })
      .update({ id: plan.operationId, connectionId: plan.connectionId, state: 'IN_FLIGHT', attempts: 1, payloadFingerprint: plan.fingerprint },
        { state, externalDocumentId, errorCode } as never);
    requireFact(result.affected === 1, 'RECONCILIATION_REQUIRED');
  }
}
