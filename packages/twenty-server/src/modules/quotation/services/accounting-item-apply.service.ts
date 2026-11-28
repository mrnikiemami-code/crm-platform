import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { QuotationPermissionService } from 'src/modules/quotation/services/quotation-permission.service';
import { acquireQuotationUnitCatalogReadLock } from 'src/modules/quotation/utils/quotation-unit-lock.util';

type Selection = { externalItemId: string; expectedRemoteVersion: string; internalItemId?: string; unitRecordId?: string; kind?: 'PRODUCT' | 'SERVICE' };
type PlanRow = {
  externalItemId: string; remoteVersion: string; action: 'CREATE_CATALOG_ITEM' | 'CREATE_LINK' | 'UPDATE_LINK_VERSION';
  internalItemId: string | null; expectedLinkId: string | null; expectedLinkVersion: string | null;
  code: string; name: string; secondaryName: string | null; priceMicros: string | null;
  unitRecordId: string | null; kind: 'PRODUCT' | 'SERVICE' | null;
  vendorUnitId: string | null; vendorUnitName: string | null; observation: Record<string, unknown> | null;
};
type Link = { id: string; connectionId: string; externalItemId: string; itemId: string | null; remoteVersion: string | null; syncStatus: string; observationJson: string | null; deletedAt: string | Date | null };
type Item = { id: string; sku: string | null; name: string; isActive: boolean; unitRecordId: string | null; kind: string; deletedAt: string | Date | null };
type Unit = { id: string; name: string; isActive: boolean; accountingCode: string | null };
type Price = { id: string; itemId: string; priceListId: string; unitPriceExact: string; validFrom: string | Date | null; validTo: string | Date | null; deletedAt: string | Date | null };
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128 && value === value.trim();
const nullableId = (value: unknown): value is string | null => value === null || id(value);
const stableId = (...parts: string[]): string => {
  const hex = createHash('sha256').update('quotation/accounting-import:' + JSON.stringify(parts)).digest('hex');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-5' + hex.slice(13, 16) + '-8' + hex.slice(17, 20) + '-' + hex.slice(20, 32);
};
const failure = (code: string, message: string) => ({ success: false as const, code, message });
const validPrice = (value: unknown): value is string => typeof value === 'string' && /^\d{1,24}\.\d{6}$/.test(value);
const dayOf = (value: string | Date | null) => value instanceof Date ? value.toISOString().slice(0, 10) : value?.slice(0, 10) ?? null;
class ItemApplyRefusal extends Error {
  constructor(readonly code: string) { super(code); }
}
const assert = (condition: unknown, code: string): void => { if (!condition) throw new ItemApplyRefusal(code); };

export const parseAccountingItemSelections = (value: unknown): Selection[] | null => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 25) return null;
  const selections: Selection[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const row = object(raw);
    if (!row || !id(row.externalItemId) || seen.has(row.externalItemId) || !id(row.expectedRemoteVersion) ||
      (row.internalItemId !== undefined && !id(row.internalItemId)) ||
      (row.unitRecordId !== undefined && !id(row.unitRecordId)) ||
      (row.kind !== undefined && row.kind !== 'PRODUCT' && row.kind !== 'SERVICE')) return null;
    seen.add(row.externalItemId);
    selections.push({ externalItemId: row.externalItemId, expectedRemoteVersion: row.expectedRemoteVersion,
      ...(id(row.internalItemId) ? { internalItemId: row.internalItemId } : {}),
      ...(id(row.unitRecordId) ? { unitRecordId: row.unitRecordId } : {}),
      ...(row.kind === 'PRODUCT' || row.kind === 'SERVICE' ? { kind: row.kind } : {}) });
  }
  return selections;
};

// Only the private worker prepares this plan; the authenticated caller cannot
// supply it directly. Independently bind all rows to the actual selections.
export const parseAccountingItemPlan = (value: unknown, connectionId: string, selections: Selection[], applyPrices: boolean, allowUpdate: boolean): PlanRow[] | null => {
  const plan = object(value);
  if (!plan || plan.connectionId !== connectionId || plan.applyPrices !== applyPrices ||
    !Array.isArray(plan.rows) || !Array.isArray(plan.refused) || plan.refused.length !== 0 || plan.rows.length !== selections.length) return null;
  const seen = new Set<string>();
  const rows: PlanRow[] = [];
  for (const raw of plan.rows) {
    const row = object(raw);
    if (!row || !id(row.externalItemId) || seen.has(row.externalItemId) || !id(row.remoteVersion) ||
      !nullableId(row.internalItemId) || !nullableId(row.expectedLinkId) || !nullableId(row.expectedLinkVersion) ||
      !nullableId(row.unitRecordId) || !id(row.code) || !text(row.name) || text(row.name).length > 500 ||
      (row.secondaryName !== null && typeof row.secondaryName !== 'string') ||
      (row.priceMicros !== null && !validPrice(row.priceMicros)) ||
      (row.vendorUnitId !== null && typeof row.vendorUnitId !== 'string') ||
      (row.vendorUnitName !== null && typeof row.vendorUnitName !== 'string') ||
      (row.observation !== null && (!object(row.observation) || JSON.stringify(row.observation).length > 200000))) return null;
    const selected = selections.find(entry => entry.externalItemId === row.externalItemId);
    if (!selected || selected.expectedRemoteVersion !== row.remoteVersion) return null;
    if (row.action === 'CREATE_CATALOG_ITEM') {
      if (row.internalItemId !== null || row.expectedLinkId !== null || row.expectedLinkVersion !== null ||
        !row.unitRecordId || selected.unitRecordId !== row.unitRecordId ||
        (row.kind !== 'PRODUCT' && row.kind !== 'SERVICE') || selected.kind !== row.kind) return null;
    } else if (row.action === 'CREATE_LINK') {
      if (!row.internalItemId || selected.internalItemId !== row.internalItemId || row.expectedLinkId !== null ||
        row.expectedLinkVersion !== null || row.unitRecordId !== (selected.unitRecordId ?? null)) return null;
    } else if (row.action === 'UPDATE_LINK_VERSION') {
      if (!allowUpdate || !row.internalItemId || selected.internalItemId !== row.internalItemId || !row.expectedLinkId || !row.expectedLinkVersion) return null;
    } else return null;
    seen.add(row.externalItemId);
    rows.push(row as unknown as PlanRow);
  }
  return rows;
};

@Injectable()
export class AccountingItemApplyService {
  constructor(private readonly orm: WorkspaceOrmManager, private readonly permissions: QuotationPermissionService) {}

  async apply(input: { connectionId: string; selections: Selection[]; applyPrices: boolean; allowUpdate: boolean; plan: unknown; authContext: WorkspaceAuthContext }) {
    const { connectionId, selections, applyPrices, allowUpdate, authContext } = input;
    if (authContext.type !== 'user' || await this.permissions.resolveSettingsAuthority(authContext, 'accountingConnection') === null) {
      return failure('FORBIDDEN', 'مجوز انتقال کالا وجود ندارد.');
    }
    const rows = parseAccountingItemPlan(input.plan, connectionId, selections, applyPrices, allowUpdate);
    if (!rows) return failure('ACCOUNTING_ITEM_PLAN_INVALID', 'اطلاعات انتقال تغییر کرده یا نیازمند تعیین واحد، نوع کالا یا رفع تعارض است.');
    try {
      const outcome = await this.orm.executeInWorkspaceContext(
        () => this.orm.runInWorkspaceTransaction(async scope => {
          await acquireQuotationUnitCatalogReadLock(scope);
          // A batch is a single transaction. Serialize source/target identities
          // in fixed order; re-read all identities and price state before writes.
          const keys = [...new Set(rows.flatMap(row => [
            JSON.stringify(['accounting-item-source', scope.workspaceId, connectionId, row.externalItemId]),
            JSON.stringify(['accounting-item-sku', scope.workspaceId, row.code]),
            JSON.stringify(['accounting-item-target', scope.workspaceId, row.internalItemId ?? stableId('item', connectionId, row.externalItemId)]),
          ]))].sort();
          for (const key of keys) await scope.executeRawQuery('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
          const connection = await scope.getRepository<{ id: string; isActive: boolean; adapterId: string }>('accountingConnection', { shouldBypassPermissionChecks: true }).findOne({ where: { id: connectionId } });
          assert(connection?.isActive === true && connection.adapterId === 'mock', 'ASAN_LIVE_IMPORT_NOT_APPROVED');
          const items = scope.getRepository<Item>('catalogItem', { shouldBypassPermissionChecks: true });
          const links = scope.getRepository<Link>('accountingItemLink', { shouldBypassPermissionChecks: true });
          const units = scope.getRepository<Unit>('quotationUnit', { shouldBypassPermissionChecks: true });
          const priceLists = applyPrices ? await scope.getRepository<{ id: string; currencyCode: string; isDefault: boolean }>('priceList', { shouldBypassPermissionChecks: true })
            .find({ where: { currencyCode: 'IRR', isDefault: true }, take: 2 }) : [];
          assert(!applyPrices || priceLists.length === 1, 'PRICE_LIST_REQUIRED');
          let createdItems = 0, createdLinks = 0, updatedLinks = 0, createdPrices = 0;
          const at = new Date().toISOString();
          for (const row of rows) {
            const existing = await links.find({ where: { connectionId, externalItemId: row.externalItemId }, withDeleted: true, take: 2 });
            const expected = existing[0];
            if (row.action === 'UPDATE_LINK_VERSION') {
              assert(existing.length === 1 && expected.id === row.expectedLinkId && !expected.deletedAt &&
                expected.itemId === row.internalItemId && expected.remoteVersion === row.expectedLinkVersion && expected.syncStatus === 'LINKED', 'ACCOUNTING_LINK_CONFLICT');
            } else assert(existing.length === 0, 'ACCOUNTING_LINK_CONFLICT');
            let itemId = row.internalItemId ?? stableId('item', connectionId, row.externalItemId);
            let unitRecordId = row.unitRecordId;
            if (row.action === 'CREATE_CATALOG_ITEM') {
              const conflicts = await items.find({ where: [{ id: itemId }, { sku: row.code }], withDeleted: true, take: 2 });
              assert(conflicts.length === 0, 'CATALOG_IDENTITY_CONFLICT');
            } else {
              const item = await items.findOne({ where: { id: itemId }, withDeleted: true });
              assert(item && !item.deletedAt && item.isActive === true && item.unitRecordId && (row.action !== 'CREATE_LINK' || item.sku === row.code), 'CATALOG_IDENTITY_CONFLICT');
              assert(!unitRecordId || unitRecordId === item?.unitRecordId, 'UNIT_MAPPING_REQUIRED');
              unitRecordId = item?.unitRecordId ?? null;
            }
            assert(unitRecordId, 'UNIT_MAPPING_REQUIRED');
            const unit = await units.findOne({ where: { id: unitRecordId! } });
            assert(unit?.isActive === true && !!unit.name.trim(), 'UNIT_MAPPING_REQUIRED');
            const reverse = await links.find({ where: { connectionId, itemId }, withDeleted: true, take: 2 });
            assert(row.action === 'UPDATE_LINK_VERSION' ? reverse.length === 1 && reverse[0].id === expected.id : reverse.length === 0, 'ACCOUNTING_LINK_CONFLICT');
            if (row.action === 'UPDATE_LINK_VERSION') {
              let old: Record<string, unknown> | null = null;
              try { old = object(JSON.parse(expected.observationJson ?? 'null')); } catch { /* review required */ }
              // A changed remote base unit is not silently mapped to the old CRM unit.
              assert(old && old.crmUnitRecordId === unitRecordId && old.vendorUnitId === row.vendorUnitId &&
                old.vendorUnitName === row.vendorUnitName, 'UNIT_MAPPING_REQUIRED');
            }
            if (row.action === 'CREATE_CATALOG_ITEM') {
              const inserted = await items.insert({ id: itemId, name: row.name, sku: row.code, kind: row.kind,
                unit: unit!.name, unitRecordId, secondaryName: row.secondaryName, isActive: true } as never);
              assert(inserted.identifiers[0]?.id === itemId, 'PERSISTENCE_FAILED');
              createdItems++;
            }
            // Existing CRM names, codes, descriptions and unit assignments stay CRM-owned.
            if (applyPrices && row.priceMicros !== null) {
              if (await this.applyPrice(scope, itemId, priceLists[0].id, row.priceMicros, at.slice(0, 10))) createdPrices++;
            }
            const observationJson = JSON.stringify({ version: '1', capturedAt: at, externalItemId: row.externalItemId,
              crmUnitRecordId: unitRecordId, vendorUnitId: row.vendorUnitId, vendorUnitName: row.vendorUnitName,
              vendorSecondaryUnitName: row.observation?.secondaryUnitName ?? null, observation: row.observation });
            const fields = { externalCode: row.code, remoteVersion: row.remoteVersion, syncStatus: 'LINKED',
              observationJson, observationVersion: '1', observedAt: at, lastSyncedAt: at };
            if (row.action === 'UPDATE_LINK_VERSION') {
              const changed = await links.update({ id: expected.id, remoteVersion: expected.remoteVersion }, fields as never);
              assert(changed.affected === 1, 'ACCOUNTING_LINK_CONFLICT');
              updatedLinks++;
            } else {
              const linkId = stableId('item-link', connectionId, row.externalItemId);
              const inserted = await links.insert({ id: linkId, connectionId, itemId, externalItemId: row.externalItemId,
                name: row.name + ' @ ' + connectionId.slice(0, 8), ...fields } as never);
              assert(inserted.identifiers[0]?.id === linkId, 'PERSISTENCE_FAILED');
              createdLinks++;
            }
          }
          return { createdItems, createdLinks, updatedLinks, createdPrices, refused: [] };
        }), authContext,
      );
      return { success: true, outcome };
    } catch (error) {
      return failure(error instanceof ItemApplyRefusal ? error.code : 'PERSISTENCE_FAILED', 'انتقال این دسته انجام نشد؛ هیچ ثبت ناقصی نباید باقی بماند.');
    }
  }

  private async applyPrice(scope: WorkspaceTransactionScope, itemId: string, priceListId: string, amount: string, day: string): Promise<boolean> {
    assert(validPrice(amount), 'INVALID_EXACT_AMOUNT');
    const repository = scope.getRepository<Price>('price', { shouldBypassPermissionChecks: true });
    const prices = await repository.find({ where: { itemId, priceListId }, take: 10001 });
    assert(prices.length <= 10000, 'PRICE_HISTORY_INCOMPLETE');
    const active = prices.filter(price => (!dayOf(price.validFrom) || dayOf(price.validFrom)! <= day) && (!dayOf(price.validTo) || dayOf(price.validTo)! >= day))
      .sort((a, b) => (dayOf(b.validFrom) ?? '').localeCompare(dayOf(a.validFrom) ?? ''));
    assert(active.length < 2 || dayOf(active[0].validFrom) !== dayOf(active[1].validFrom), 'PRICE_CONFLICT');
    if (active[0]?.unitPriceExact === amount) return false;
    const today = active.filter(price => dayOf(price.validFrom) === day);
    if (today.length === 1) {
      const changed = await repository.update({ id: today[0].id, unitPriceExact: today[0].unitPriceExact }, { unitPriceExact: amount });
      assert(changed.affected === 1, 'PRICE_CONFLICT');
    } else {
      const priceId = stableId('price', itemId, priceListId, day);
      const inserted = await repository.insert({ id: priceId, itemId, priceListId, unitPriceExact: amount, validFrom: day } as never);
      assert(inserted.identifiers[0]?.id === priceId, 'PERSISTENCE_FAILED');
    }
    return true;
  }
}
