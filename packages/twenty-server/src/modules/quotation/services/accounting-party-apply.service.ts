import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type ObjectRecord } from 'twenty-shared/types';

import { CommonCreateOneQueryRunnerService } from 'src/engine/api/common/common-query-runners/common-create-one-query-runner.service';
import { CommonFindOneQueryRunnerService } from 'src/engine/api/common/common-query-runners/common-find-one-query-runner.service';
import { CommonUpdateOneQueryRunnerService } from 'src/engine/api/common/common-query-runners/common-update-one-query-runner.service';
import { CommonQueryRunnerException, CommonQueryRunnerExceptionCode } from 'src/engine/api/common/common-query-runners/errors/common-query-runner.exception';
import { type CommonBaseQueryRunnerContext } from 'src/engine/api/common/types/common-base-query-runner-context.type';
import { type FlatApplication } from 'src/engine/core-modules/application/types/flat-application.type';
import { withWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { buildObjectIdByNameMaps } from 'src/engine/metadata-modules/flat-object-metadata/utils/build-object-id-by-name-maps.util';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { AccountingPartyWriteGuardException, ACCOUNTING_PARTY_CUSTOMER_FIELDS, withAccountingPartyWriteScope } from 'src/modules/quotation/services/accounting-party-write-guard.service';
import { PermissionsException } from 'src/engine/metadata-modules/permissions/permissions.exception';
import { TwentyOrmException } from 'src/engine/twenty-orm/exceptions/twenty-orm.exception';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';

const APP_ID = 'e7bcb5ba-01f9-57f2-80df-fb6f596ba1fb';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUSTOMER_FIELDS = {
  PERSON: ACCOUNTING_PARTY_CUSTOMER_FIELDS.person,
  COMPANY: ACCOUNTING_PARTY_CUSTOMER_FIELDS.company,
};
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const id = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const timestamp = (value: unknown): number => value instanceof Date ? value.valueOf() : typeof value === 'string' ? Date.parse(value) : NaN;
const nullableText = (value: unknown): value is string | null => value === null || typeof value === 'string';
const stableId = (namespace: string, connectionId: string, externalPartyId: string): string => {
  const hex = createHash('sha256').update(namespace + JSON.stringify([connectionId, externalPartyId])).digest('hex');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-5' + hex.slice(13, 16) + '-8' + hex.slice(17, 20) + '-' + hex.slice(20, 32);
};
type PartyKind = 'PERSON' | 'COMPANY';
type Refusal = { externalPartyId: string; code: string; detail: string };
type Selection = { externalPartyId: string; createNew: boolean; internalPartyId?: string; partyType?: PartyKind };
type Write = {
  externalPartyId: string; partyType: PartyKind; internalPartyId: string; createCustomer: boolean;
  expectedCustomerUpdatedAt: string | null; customerFields: Record<string, unknown>;
  existingLinkId: string | null; linkId: string; expectedRemoteVersion: string | null;
  externalCode: string; remoteVersion: string | null; sourceProfile: string | null; name: string;
  alreadySynchronized: boolean;
};
type Plan = { rows: Write[]; refused: Refusal[] };
const failure = (code: string) => ({ success: false as const, code, message: 'ثبت مشتریان حسابداری انجام نشد.' });

class RowFailure extends Error {
  constructor(readonly code: string, readonly stage: string) { super(stage); }
}

export const parseAccountingPartySelections = (value: unknown): Selection[] | null => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 25) return null;
  const rows: Selection[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const row = record(entry);
    if (!row || !text(row.externalPartyId) || row.externalPartyId !== row.externalPartyId.trim() ||
        row.externalPartyId.length > 512 || seen.has(row.externalPartyId)) return null;
    seen.add(row.externalPartyId);
    if (row.createNew === true) {
      rows.push({ externalPartyId: row.externalPartyId, createNew: true });
    } else if (id(row.internalPartyId) && (row.partyType === 'PERSON' || row.partyType === 'COMPANY')) {
      rows.push({ externalPartyId: row.externalPartyId, createNew: false, internalPartyId: row.internalPartyId, partyType: row.partyType });
    } else return null;
  }
  return rows;
};

// Only a plan returned by the fixed, installed private reader is accepted. No
// browser can submit a plan or a raw GraphQL/SQL mutation. Validate the entire
// envelope before any record write and reconstruct all link fields on the server.
export const parseAccountingPartyPlan = (value: unknown, connectionId: string, selections: Selection[], allowUpdate: boolean): Plan | null => {
  const input = record(value);
  if (!input || !Array.isArray(input.rows) || !Array.isArray(input.refused) ||
      input.rows.length + input.refused.length !== selections.length) return null;
  const requested = new Map(selections.map((row) => [row.externalPartyId, row]));
  const seen = new Set<string>();
  const claimed = new Set<string>();
  const rows: Write[] = [];
  const refused: Refusal[] = [];
  for (const entry of input.rows) {
    const row = record(entry);
    if (!row || !text(row.externalPartyId) || seen.has(row.externalPartyId)) return null;
    const selection = requested.get(row.externalPartyId);
    if (!selection || (row.partyType !== 'PERSON' && row.partyType !== 'COMPANY') ||
        !id(row.internalPartyId) || !id(row.linkId) || typeof row.createCustomer !== 'boolean' ||
        typeof row.alreadySynchronized !== 'boolean' || !nullableText(row.expectedCustomerUpdatedAt) ||
        !nullableText(row.expectedRemoteVersion) || !nullableText(row.remoteVersion) ||
        !nullableText(row.sourceProfile) || typeof row.externalCode !== 'string' || !text(row.name) ||
        (row.existingLinkId !== null && (!id(row.existingLinkId) || row.existingLinkId !== row.linkId))) return null;
    if (!selection.createNew && (row.createCustomer || row.internalPartyId !== selection.internalPartyId || row.partyType !== selection.partyType)) return null;
    if (row.existingLinkId !== null && (!allowUpdate || !selection.createNew || row.createCustomer)) return null;
    if (row.existingLinkId === null && row.linkId !== stableId('quotation/accounting-party-link:', connectionId, row.externalPartyId)) return null;
    if (row.createCustomer && (row.internalPartyId !== stableId('quotation/accounting-customer:', connectionId, row.externalPartyId) || row.alreadySynchronized)) return null;
    if (!row.createCustomer && (!text(row.expectedCustomerUpdatedAt) || !Number.isFinite(Date.parse(row.expectedCustomerUpdatedAt)))) return null;
    const fields = record(row.customerFields);
    if (!fields || Object.keys(fields).some((key) => !CUSTOMER_FIELDS[row.partyType as PartyKind].has(key)) ||
        (row.createCustomer && !Object.prototype.hasOwnProperty.call(fields, 'name')) ||
        (row.alreadySynchronized && (row.existingLinkId === null || Object.keys(fields).length !== 0))) return null;
    if (row.sourceProfile !== null) {
      try { if (!record(JSON.parse(row.sourceProfile))) return null; } catch { return null; }
    }
    const identity = row.partyType + ':' + row.internalPartyId;
    if (claimed.has(identity)) return null;
    claimed.add(identity);
    seen.add(row.externalPartyId);
    rows.push({ externalPartyId: row.externalPartyId, partyType: row.partyType, internalPartyId: row.internalPartyId,
      createCustomer: row.createCustomer, expectedCustomerUpdatedAt: row.expectedCustomerUpdatedAt, customerFields: fields,
      existingLinkId: row.existingLinkId as string | null, linkId: row.linkId, expectedRemoteVersion: row.expectedRemoteVersion,
      externalCode: row.externalCode, remoteVersion: row.remoteVersion, sourceProfile: row.sourceProfile, name: row.name,
      alreadySynchronized: row.alreadySynchronized });
  }
  for (const entry of input.refused) {
    const row = record(entry);
    if (!row || !text(row.externalPartyId) || !requested.has(row.externalPartyId) || seen.has(row.externalPartyId) || !text(row.code)) return null;
    seen.add(row.externalPartyId);
    // The worker's vendor/GraphQL error text is never exposed to the browser.
    const code = ['ALREADY_SUCCEEDED', 'INVALID_INPUT', 'FORBIDDEN', 'QUERY_ERROR', 'CRM_CUSTOMER_DELETED'].includes(row.code) ? row.code : 'QUERY_ERROR';
    refused.push({ externalPartyId: row.externalPartyId, code, detail: code === 'CRM_CUSTOMER_DELETED' ? 'مشتری در CRM حذف شده است؛ ابتدا در CRM بررسی شود.' : 'Customer identity or plan not confirmed' });
  }
  return { rows, refused };
};

@Injectable()
export class AccountingPartyApplyService {
  constructor(
    private readonly cache: WorkspaceCacheService,
    private readonly orm: WorkspaceOrmManager,
    private readonly permissions: QuotationPermissionService,
    private readonly findOne: CommonFindOneQueryRunnerService,
    private readonly createOne: CommonCreateOneQueryRunnerService,
    private readonly updateOne: CommonUpdateOneQueryRunnerService,
  ) {}

  async apply(input: {
    connectionId: string; selections: Selection[]; allowUpdate: boolean; plan: unknown;
    authContext: WorkspaceAuthContext; app: FlatApplication;
  }) {
    const { connectionId, selections, allowUpdate, authContext, app } = input;
    if (!id(connectionId) || authContext.type !== 'user' || app.universalIdentifier !== APP_ID ||
        !app.defaultRoleId || (authContext.application && authContext.application.id !== app.id) ||
        (authContext.viaApplication && authContext.viaApplication.id !== app.id) ||
        await this.permissions.resolveSettingsAuthority(authContext, 'accountingConnection') === null) return failure('FORBIDDEN');
    const userRoleId = await this.permissions.resolveRoleId(authContext);
    if (!userRoleId) return failure('FORBIDDEN');
    const plan = parseAccountingPartyPlan(input.plan, connectionId, selections, allowUpdate);
    if (!plan) return failure('ACCOUNTING_PARTY_PLAN_INVALID');

    // The original authenticated user is still in-process. Retain the installed
    // application's role as an additional restriction, not as a substitute.
    const delegated: Extract<WorkspaceAuthContext, { type: 'user' }> = { ...authContext, application: app };
    const roles = [...new Set([userRoleId, app.defaultRoleId])];
    const { flatObjectMetadataMaps, flatFieldMetadataMapsOrm, flatIndexMaps } = await this.cache.getOrRecompute(authContext.workspace.id, [
      'flatObjectMetadataMaps', 'flatFieldMetadataMapsOrm', 'flatIndexMaps',
    ]);
    const { idByNameSingular } = buildObjectIdByNameMaps(flatObjectMetadataMaps);
    const context = (objectName: 'person' | 'company' | 'accountingPartyLink'): CommonBaseQueryRunnerContext => {
      const metadata = Object.values(flatObjectMetadataMaps.byUniversalIdentifier).find((entry) => entry?.nameSingular === objectName);
      if (!metadata) throw new RowFailure('QUERY_ERROR', 'METADATA');
      return { authContext: delegated, flatObjectMetadata: metadata, flatObjectMetadataMaps,
        flatFieldMetadataMaps: flatFieldMetadataMapsOrm, flatIndexMaps, objectIdByNameSingular: idByNameSingular,
        rolePermissionConfig: { intersectionOf: roles } };
    };
    const person = context('person'), company = context('company'), link = context('accountingPartyLink');
    let createdParties = 0, createdLinks = 0, updatedLinks = 0;
    const refused = [...plan.refused];

    for (const row of plan.rows) {
      let stage = 'TRANSACTION';
      try {
        const result = await withWorkspaceAuthContext(delegated, () => this.orm.executeInWorkspaceContext(
          () => this.orm.runInWorkspaceTransaction(async (transactionScope) => {
            // Fixed lexical order avoids lock inversion. Scope keys by workspace,
            // connection/vendor identity and CRM identity. Locks never grant permissions.
            const identityKeys = ['nationalCode', 'economicCode'].flatMap((field) => {
              const value = row.customerFields[field];
              return typeof value === 'string' && value.trim() !== '' ? [JSON.stringify(['accounting-party-identity', authContext.workspace.id, field, value])] : [];
            });
            const lockKeys = [
              ...identityKeys,
              JSON.stringify(['accounting-party-source', authContext.workspace.id, connectionId, row.externalPartyId]),
              JSON.stringify(['accounting-party-customer', authContext.workspace.id, row.partyType, row.internalPartyId]),
            ].sort();
            for (const key of lockKeys) await transactionScope.executeRawQuery('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
            const customerObject = row.partyType === 'PERSON' ? 'person' : 'company';
            const customerContext = { ...(customerObject === 'person' ? person : company), transactionScope };
            const linkContext = { ...link, transactionScope };

            stage = 'MAPPING_READ';
            const findLink = async (filter: { connectionId: { eq: string }; externalPartyId?: { eq: string }; internalPartyId?: { eq: string }; partyType?: { eq: PartyKind }; deletedAt?: { is: 'NOT_NULL' } }) => {
              try {
                return (await this.findOne.execute({ filter, selectedFields: { id: true, externalPartyId: true, internalPartyId: true, partyType: true, remoteVersion: true } }, linkContext)).results;
              } catch (error) {
                if (error instanceof CommonQueryRunnerException && error.code === CommonQueryRunnerExceptionCode.RECORD_NOT_FOUND) return null;
                throw error;
              }
            };
            const deletedMapping = await findLink({ connectionId: { eq: connectionId }, externalPartyId: { eq: row.externalPartyId }, deletedAt: { is: 'NOT_NULL' } });
            if (deletedMapping) throw new RowFailure('ACCOUNTING_PARTY_MAPPING_DELETED', stage);
            const current = await findLink({ connectionId: { eq: connectionId }, externalPartyId: { eq: row.externalPartyId } });
            if (row.existingLinkId === null ? current !== null :
                !current || current.id !== row.existingLinkId || current.internalPartyId !== row.internalPartyId ||
                current.partyType !== row.partyType || (current.remoteVersion ?? null) !== row.expectedRemoteVersion) {
              throw new RowFailure('ACCOUNTING_PARTY_PLAN_STALE', stage);
            }
            const other = await findLink({ connectionId: { eq: connectionId }, internalPartyId: { eq: row.internalPartyId }, partyType: { eq: row.partyType } });
            if (other && other.externalPartyId !== row.externalPartyId) throw new RowFailure('INVALID_INPUT', stage);

            // Recheck strong identifiers under the same transaction after locking.
            // Both active and soft-deleted customers occupy identity keys.
            stage = 'CUSTOMER_IDENTITY_RECHECK';
            const identityClauses = ['nationalCode', 'economicCode'].flatMap((field) => {
              const value = row.customerFields[field];
              if (typeof value !== 'string' || !value.trim()) return [];
              const variants = [...new Set([value, value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]), value.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])])];
              return [{ [field]: { in: variants } }];
            });
            for (const candidateContext of [{ ...person, transactionScope }, { ...company, transactionScope }]) {
              const sameKind = candidateContext.flatObjectMetadata.nameSingular === customerObject;
              const clauses = [...identityClauses, ...(sameKind ? [{ id: { eq: row.internalPartyId } }] : [])];
              if (!clauses.length) continue;
              try {
                const deleted = await this.findOne.execute({ filter: { and: [{ or: clauses }, { deletedAt: { is: 'NOT_NULL' } }] }, selectedFields: { id: true } }, candidateContext);
                if (deleted.results.id) throw new RowFailure('CRM_CUSTOMER_DELETED', stage);
              } catch (error) {
                if (!(error instanceof CommonQueryRunnerException && error.code === CommonQueryRunnerExceptionCode.RECORD_NOT_FOUND)) throw error;
              }
              if (identityClauses.length === 0 && !row.createCustomer) continue;
              // The target itself is allowed for updates; every other active
              // identity hit is a conflict, not authorization to merge records.
              const activeFilter = { and: [{ or: clauses }, ...(sameKind && !row.createCustomer ? [{ id: { neq: row.internalPartyId } }] : [])] };
              try {
                const existing = await this.findOne.execute({ filter: activeFilter, selectedFields: { id: true } }, candidateContext);
                if (existing.results.id) throw new RowFailure('ACCOUNTING_PARTY_PLAN_STALE', stage);
              } catch (error) {
                if (!(error instanceof CommonQueryRunnerException && error.code === CommonQueryRunnerExceptionCode.RECORD_NOT_FOUND)) throw error;
              }
            }
            let created = false;
            if (row.createCustomer) {
              stage = 'CUSTOMER_CREATE';
              const result = await withAccountingPartyWriteScope({ authContext: delegated, object: customerObject, action: 'createOne', recordId: row.internalPartyId },
                () => this.createOne.execute({ data: { ...row.customerFields, id: row.internalPartyId } as Partial<ObjectRecord>, selectedFields: { id: true } }, customerContext));
              if (result.results.id !== row.internalPartyId) throw new RowFailure('QUERY_ERROR', stage);
              created = true;
            } else {
              stage = 'CUSTOMER_READ';
              const visible = await this.findOne.execute({ filter: { id: { eq: row.internalPartyId } }, selectedFields: { id: true, updatedAt: true } }, customerContext);
              if (visible.results.id !== row.internalPartyId) throw new RowFailure('FORBIDDEN', stage);
              if (timestamp(visible.results.updatedAt) !== timestamp(row.expectedCustomerUpdatedAt)) {
                throw new RowFailure('ACCOUNTING_PARTY_PLAN_STALE', stage);
              }
              if (row.alreadySynchronized) return { created: false, link: 'NONE' as const };
              if (Object.keys(row.customerFields).length > 0) {
                stage = 'CUSTOMER_UPDATE';
                const result = await withAccountingPartyWriteScope({ authContext: delegated, object: customerObject, action: 'updateOne', recordId: row.internalPartyId },
                  () => this.updateOne.execute({ id: row.internalPartyId, data: row.customerFields as Partial<ObjectRecord>, selectedFields: { id: true } }, customerContext));
                if (result.results.id !== row.internalPartyId) throw new RowFailure('QUERY_ERROR', stage);
              }
            }

            const data = { externalCode: row.externalCode, remoteVersion: row.remoteVersion,
              ...(row.sourceProfile === null ? {} : { sourceProfile: row.sourceProfile }),
              lastSyncedAt: new Date().toISOString(), syncStatus: 'LINKED', partyType: row.partyType, internalPartyId: row.internalPartyId };
            stage = 'MAPPING_WRITE';
            if (row.existingLinkId !== null) {
              const result = await this.updateOne.execute({ id: row.existingLinkId, data, selectedFields: { id: true } }, linkContext);
              if (result.results.id !== row.existingLinkId) throw new RowFailure('QUERY_ERROR', stage);
              return { created, link: 'UPDATED' as const };
            }
            const result = await this.createOne.execute({ data: { ...data, id: row.linkId, name: row.name + ' @ ' + connectionId.slice(0, 8), externalPartyId: row.externalPartyId, connectionId }, selectedFields: { id: true } }, linkContext);
            if (result.results.id !== row.linkId) throw new RowFailure('QUERY_ERROR', stage);
            return { created, link: 'CREATED' as const };
          }), delegated,
        ));
        if (result.created) createdParties++;
        if (result.link === 'CREATED') createdLinks++;
        if (result.link === 'UPDATED') updatedLinks++;
        if (result.link === 'NONE') refused.push({ externalPartyId: row.externalPartyId, code: 'ALREADY_SUCCEEDED', detail: 'CRM customer already synchronized' });
      } catch (error) {
        // Stable stage/code, no JWT, personal information, vendor body or query string.
        const rawCode = record(error)?.code;
        const code = error instanceof RowFailure ? error.code :
          rawCode === 'DUPLICATE_ENTRY_DETECTED' || rawCode === '23505' ? 'ACCOUNTING_PARTY_IDENTITY_CONFLICT' :
          rawCode === 'FORBIDDEN' || rawCode === 'PERMISSION_DENIED' || rawCode === 'RECORD_NOT_FOUND' || rawCode === 'RLS_VALIDATION_FAILED' ? 'FORBIDDEN' : 'QUERY_ERROR';
        const reason = error instanceof AccountingPartyWriteGuardException ? 'GUARD_' + error.reason :
          error instanceof RowFailure ? error.code :
          error instanceof PermissionsException ? (
            error.message.includes('not writable through the API') ? 'ORM_METADATA_WRITABILITY' :
            error.message.includes('no permission to write field') ? 'ORM_FIELD_WRITE_DENIED' :
            error.message.includes('no permission to read field') ? 'ORM_FIELD_READ_DENIED' :
            error.message.includes('attached to is not writable') ? 'ORM_PARENT_WRITE_DENIED' : 'ORM_PERMISSION_DENIED'
          ) : error instanceof TwentyOrmException ? 'ORM_' + error.code :
          error instanceof CommonQueryRunnerException ? 'RUNNER_' + error.code : 'UNCLASSIFIED';
        refused.push({ externalPartyId: row.externalPartyId, code, detail: 'CRM synchronization not confirmed: ' + (error instanceof RowFailure ? error.stage : stage) + ': ' + reason });
      }
    }
    return { success: true as const, outcome: { createdParties, createdLinks, updatedLinks, refused } };
  }
}
