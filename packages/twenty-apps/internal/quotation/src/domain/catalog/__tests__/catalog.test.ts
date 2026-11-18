import { describe, expect, it } from 'vitest';

import {
  validateCatalogItem,
  type CatalogItemKind,
} from 'src/domain/catalog/catalog-item';
import {
  ACCOUNTING_OWNED_FIELDS,
  DEFAULT_FIELD_OWNERSHIP_POLICY,
  findFieldOwnershipPolicyProblems,
  resolveFieldOutcomes,
  type FieldOwnershipPolicy,
  type FieldChange,
} from 'src/domain/catalog/field-ownership';
import {
  buildLinkKey,
  findDuplicateLinkKeys,
  hasRemoteVersionDrifted,
  type AccountingItemLink,
} from 'src/domain/catalog/item-link';

const item = (overrides: Partial<{
  id: string;
  kind: CatalogItemKind;
  name: string;
  sku: string | null;
  unit: string;
  isActive: boolean;
}> = {}) => ({
  id: 'item-1',
  kind: 'SERVICE' as CatalogItemKind,
  name: 'خدمت نصب',
  sku: null,
  unit: 'ساعت',
  isActive: true,
  ...overrides,
});

describe('catalog item validation', () => {
  it('accepts a service with no SKU', () => {
    const result = validateCatalogItem(item());

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value.name : '').toBe('خدمت نصب');
  });

  it('accepts a product with a SKU', () => {
    const result = validateCatalogItem(
      item({ kind: 'PRODUCT', sku: ' KT-6 ', name: 'کابل شبکه' }),
    );

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value.sku : null).toBe('KT-6');
  });

  it('refuses an item with no name or no unit', () => {
    expect(validateCatalogItem(item({ name: '   ' })).ok).toBe(false);
    expect(validateCatalogItem(item({ unit: '' })).ok).toBe(false);
  });

  it('refuses an empty-but-present SKU instead of treating it as absent', () => {
    // A blank string is a data-entry mistake, not "no SKU"; accepting it would make
    // the two cases indistinguishable when matching against accounting.
    const result = validateCatalogItem(item({ sku: '  ' }));

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.refusal.code).toBe('ITEM_SKU_INVALID');
  });

  it('does not treat the SKU as an identity', () => {
    // Two items may share a SKU; identity is the id. This test exists to make that
    // decision explicit rather than accidental.
    const first = validateCatalogItem(item({ sku: 'SAME' }));
    const second = validateCatalogItem(item({ id: 'item-2', sku: 'SAME' }));

    expect(first.ok && second.ok).toBe(true);
  });
});

describe('field ownership policy', () => {
  it('never lets the CRM own inventory', () => {
    const policy: FieldOwnershipPolicy = {
      ...DEFAULT_FIELD_OWNERSHIP_POLICY,
      inventoryQuantity: 'CRM',
    };

    expect(findFieldOwnershipPolicyProblems(policy)).toEqual([
      { field: 'inventoryQuantity', reason: 'ACCOUNTING_FIELD_CLAIMED_BY_CRM' },
    ]);
  });

  it('accepts the default policy', () => {
    expect(findFieldOwnershipPolicyProblems(DEFAULT_FIELD_OWNERSHIP_POLICY)).toEqual(
      [],
    );
    expect(ACCOUNTING_OWNED_FIELDS).toContain('inventoryQuantity');
  });
});

describe('field conflict resolution', () => {
  const policy = DEFAULT_FIELD_OWNERSHIP_POLICY;

  const change = (
    field: FieldChange['field'],
    crmValue: string | null,
    accountingValue: string | null,
  ): FieldChange => ({ field, crmValue, accountingValue });

  it('reports agreement without touching anything', () => {
    const outcomes = resolveFieldOutcomes({
      changes: [change('name', 'کابل', 'کابل')],
      policy,
      previouslySynced: { name: 'کابل' },
    });

    expect(outcomes).toEqual([{ kind: 'AGREE', field: 'name', value: 'کابل' }]);
  });

  it('applies the owner when only one side changed', () => {
    const outcomes = resolveFieldOutcomes({
      changes: [change('name', 'کابل کت ۶', 'کابل')],
      policy,
      previouslySynced: { name: 'کابل' },
    });

    expect(outcomes).toEqual([
      {
        kind: 'APPLY_OWNER',
        field: 'name',
        value: 'کابل کت ۶',
        owner: 'CRM',
        discardedValue: 'کابل',
      },
    ]);
  });

  it('never silently overwrites when both sides changed the same field', () => {
    // Both sides moved. "CRM owns name" must NOT mean the accounting edit is
    // dropped; it becomes a conflict a person resolves.
    const outcomes = resolveFieldOutcomes({
      changes: [change('name', 'کابل کت ۶', 'کابل شبکه')],
      policy,
      previouslySynced: { name: 'کابل' },
    });

    expect(outcomes).toEqual([
      {
        kind: 'CONFLICT',
        field: 'name',
        crmValue: 'کابل کت ۶',
        accountingValue: 'کابل شبکه',
      },
    ]);
  });

  it('hands an accounting-owned field to accounting when only accounting moved', () => {
    const outcomes = resolveFieldOutcomes({
      changes: [change('taxRate', '900', '1000')],
      policy,
      previouslySynced: { taxRate: '900' },
    });

    expect(outcomes).toEqual([
      {
        kind: 'APPLY_OWNER',
        field: 'taxRate',
        value: '1000',
        owner: 'ACCOUNTING',
        discardedValue: '900',
      },
    ]);
  });

  it('still surfaces a conflict for an accounting-owned field both sides moved', () => {
    const outcomes = resolveFieldOutcomes({
      changes: [change('taxRate', '1000', '900')],
      policy,
      previouslySynced: { taxRate: '500' },
    });

    expect(outcomes[0].kind).toBe('CONFLICT');
  });
});

describe('item links', () => {
  const link = (overrides: Partial<AccountingItemLink> = {}): AccountingItemLink => ({
    internalItemId: 'item-1',
    connectionId: 'conn-1',
    externalItemId: 'ext-9',
    externalCode: 'KT6',
    remoteVersion: 'v1',
    lastSyncedAt: '2026-11-18T10:00:00.000Z',
    syncStatus: 'LINKED',
    ...overrides,
  });

  it('scopes link identity by connection and item', () => {
    expect(buildLinkKey({ connectionId: 'c', internalItemId: 'i' })).toBe('c::i');
  });

  it('finds two links for the same item in one connection', () => {
    const duplicates = findDuplicateLinkKeys([
      { connectionId: 'conn-1', internalItemId: 'item-1' },
      { connectionId: 'conn-1', internalItemId: 'item-1' },
      { connectionId: 'conn-2', internalItemId: 'item-1' },
    ]);

    expect(duplicates).toEqual(['conn-1::item-1']);
  });

  it('detects that the remote moved under us', () => {
    expect(
      hasRemoteVersionDrifted({ link: link(), observedRemoteVersion: 'v2' }),
    ).toBe(true);
    expect(
      hasRemoteVersionDrifted({ link: link(), observedRemoteVersion: 'v1' }),
    ).toBe(false);
  });

  it('does not claim drift when no version was ever recorded', () => {
    expect(
      hasRemoteVersionDrifted({
        link: link({ remoteVersion: null }),
        observedRemoteVersion: 'v9',
      }),
    ).toBe(false);
  });
});
