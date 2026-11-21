import { describe, expect, it } from 'vitest';

import { type RemoteCatalogItem, type RemoteParty } from 'src/domain/accounting/adapter-contract';
import {
  planItemImport,
  planPartyImport,
  resolveItemApplyPlan,
  type ExistingItemLink,
  type ExistingPartyLink,
} from 'src/domain/accounting/import-plan';

const item = (
  overrides: Partial<RemoteCatalogItem> & { externalItemId: string },
): RemoteCatalogItem => ({
  code: overrides.externalItemId,
  name: `item ${overrides.externalItemId}`,
  secondaryName: null,
  sellPriceUnits: 1000,
  salesPriceUnits: [],
  stock: null,
  remoteVersion: 'v1',
  isActive: true,
  ...overrides,
});

const party = (
  overrides: Partial<RemoteParty> & { externalPartyId: string },
): RemoteParty => ({
  code: overrides.externalPartyId,
  fullName: `party ${overrides.externalPartyId}`,
  mobile: null,
  nationalCode: null,
  remoteVersion: 'p1',
  ...overrides,
});

const link = (
  overrides: Partial<ExistingItemLink> & { linkId: string },
): ExistingItemLink => ({
  externalItemId: null,
  internalItemId: null,
  remoteVersion: 'v1',
  syncStatus: 'LINKED',
  ...overrides,
});

describe('item import preview', () => {
  it('plans a create for an unknown remote item and converts its price', () => {
    const preview = planItemImport({
      remoteItems: [item({ externalItemId: '1001', sellPriceUnits: 450_000 })],
      links: [],
      crmItems: [],
      moneyUnit: 'RIAL',
    });

    expect(preview.rows[0]).toMatchObject({
      decision: 'CREATE',
      priceMicros: '450000.000000',
      priceUnits: 450_000,
    });
    expect(preview.summary.CREATE).toBe(1);
  });

  it('does not convert a price while the unit is unconfirmed, and warns', () => {
    const preview = planItemImport({
      remoteItems: [item({ externalItemId: '1001' })],
      links: [],
      crmItems: [],
      moneyUnit: 'UNCONFIRMED',
    });

    expect(preview.rows[0].priceMicros).toBeNull();
    expect(preview.rows[0].planPrice).toContain('قابل تبدیل نیست');
    expect(preview.rows[0].warnings).toContain('PRICE_UNIT_UNCONFIRMED');
  });

  it('reports an already-linked item as in sync instead of creating it again', () => {
    const preview = planItemImport({
      remoteItems: [item({ externalItemId: '1001' })],
      links: [link({ linkId: 'l1', externalItemId: '1001', internalItemId: 'crm-1' })],
      crmItems: [],
      moneyUnit: 'RIAL',
    });

    expect(preview.rows[0]).toMatchObject({
      decision: 'IN_SYNC',
      existingLinkId: 'l1',
      suggestedInternalItemId: 'crm-1',
    });
  });

  it('detects a remote change from the version marker', () => {
    const preview = planItemImport({
      remoteItems: [item({ externalItemId: '1001', remoteVersion: 'v2' })],
      links: [link({ linkId: 'l1', externalItemId: '1001', internalItemId: 'crm-1' })],
      crmItems: [],
      moneyUnit: 'RIAL',
    });

    expect(preview.rows[0].decision).toBe('REMOTE_CHANGED');
  });

  it('suggests a single CRM item sharing the SKU, and never links silently', () => {
    const preview = planItemImport({
      remoteItems: [item({ externalItemId: '1001', code: 'SKU-1' })],
      links: [],
      crmItems: [{ id: 'crm-1', name: 'کالای من', sku: 'SKU-1' }],
      moneyUnit: 'RIAL',
    });

    expect(preview.rows[0]).toMatchObject({
      decision: 'LINK_SUGGESTED',
      suggestedInternalItemId: 'crm-1',
      existingLinkId: null,
    });
  });

  it('marks a shared SKU as ambiguous rather than picking one', () => {
    const preview = planItemImport({
      remoteItems: [item({ externalItemId: '1001', code: 'SKU-1' })],
      links: [],
      crmItems: [
        { id: 'crm-1', name: 'الف', sku: 'SKU-1' },
        { id: 'crm-2', name: 'ب', sku: 'SKU-1' },
      ],
      moneyUnit: 'RIAL',
    });

    expect(preview.rows[0].decision).toBe('LINK_AMBIGUOUS');
    expect(preview.rows[0].suggestedInternalItemId).toBeNull();
  });

  it('refuses to link a vendor code that appears twice', () => {
    const preview = planItemImport({
      remoteItems: [
        item({ externalItemId: '1001', code: 'DUP' }),
        item({ externalItemId: '1002', code: 'DUP' }),
      ],
      links: [link({ linkId: 'l1', externalItemId: '1001', internalItemId: 'crm-1' })],
      crmItems: [],
      moneyUnit: 'RIAL',
    });

    expect(preview.rows.map((row) => row.decision)).toEqual([
      'DUPLICATE_REMOTE_CODE',
      'DUPLICATE_REMOTE_CODE',
    ]);
    expect(preview.summary.DUPLICATE_REMOTE_CODE).toBe(2);
  });

  it('warns when two remote items share a name, without treating it as identity', () => {
    const preview = planItemImport({
      remoteItems: [
        item({ externalItemId: '1001', name: 'کابل شبکه' }),
        item({ externalItemId: '1002', name: 'کابل  شبکه' }),
      ],
      links: [],
      crmItems: [],
      moneyUnit: 'RIAL',
    });

    expect(preview.rows.every((row) => row.warnings.includes('DUPLICATE_REMOTE_NAME'))).toBe(
      true,
    );
    expect(preview.rows.every((row) => row.decision === 'CREATE')).toBe(true);
  });
});

describe('item apply plan', () => {
  const preview = planItemImport({
    remoteItems: [
      item({ externalItemId: '1001', code: 'A', remoteVersion: 'v2', sellPriceUnits: 1500 }),
      item({ externalItemId: '1002', code: 'B' }),
      item({ externalItemId: '1003', code: 'C', remoteVersion: 'v2' }),
      item({ externalItemId: '1004', code: 'D', sellPriceUnits: 1000 }),
    ],
    links: [
      link({ linkId: 'l2', externalItemId: '1002', internalItemId: 'crm-2' }),
      link({ linkId: 'l3', externalItemId: '1003', internalItemId: 'crm-3' }),
    ],
    crmItems: [{ id: 'crm-1', name: 'کالای من', sku: 'A' }],
    moneyUnit: 'RIAL',
  });

  it('turns a confirmed suggestion and a confirmed create into writes', () => {
    const plan = resolveItemApplyPlan({
      preview,
      selections: [{ externalItemId: '1001' }, { externalItemId: '1004' }],
      allowRemoteVersionUpdate: false,
    });

    expect(plan.refused).toEqual([]);
    expect(plan.rows.map((row) => row.action)).toEqual([
      'CREATE_LINK',
      'CREATE_CATALOG_ITEM',
    ]);
    expect(plan.rows[0].internalItemId).toBe('crm-1');
    expect(plan.rows[1].priceMicros).toBe('1000.000000');
  });

  it('refuses a remote change unless the version update is explicitly confirmed', () => {
    const plan = resolveItemApplyPlan({
      preview,
      selections: [{ externalItemId: '1003' }],
      allowRemoteVersionUpdate: false,
    });

    expect(plan.rows).toEqual([]);
    expect(plan.refused[0].detail).toContain('confirm the version update');
  });

  it('updates the link version only after confirmation', () => {
    const plan = resolveItemApplyPlan({
      preview,
      selections: [{ externalItemId: '1003' }],
      allowRemoteVersionUpdate: true,
    });

    expect(plan.rows[0]).toMatchObject({
      action: 'UPDATE_LINK_VERSION',
      internalItemId: 'crm-3',
      remoteVersion: 'v2',
    });
  });

  it('refuses an in-sync row instead of reporting a no-op as success', () => {
    const inSyncPreview = planItemImport({
      remoteItems: [item({ externalItemId: '1001' })],
      links: [link({ linkId: 'l1', externalItemId: '1001', internalItemId: 'crm-1' })],
      crmItems: [],
      moneyUnit: 'RIAL',
    });

    const plan = resolveItemApplyPlan({
      preview: inSyncPreview,
      selections: [{ externalItemId: '1001' }],
      allowRemoteVersionUpdate: false,
    });

    expect(plan.rows).toEqual([]);
    expect(plan.refused[0].detail).toBe('already linked and unchanged');
  });
});

describe('party import preview', () => {
  const partyLink = (
    overrides: Partial<ExistingPartyLink> & { linkId: string },
  ): ExistingPartyLink => ({
    externalPartyId: null,
    internalPartyId: null,
    remoteVersion: 'p1',
    syncStatus: 'LINKED',
    ...overrides,
  });

  it('needs an explicit CRM record for an unknown customer', () => {
    const preview = planPartyImport({
      remoteParties: [party({ externalPartyId: '101' })],
      links: [],
      crmParties: [],
    });

    expect(preview.rows[0].decision).toBe('NEEDS_CRM_RECORD');
    expect(preview.rows[0].warnings).toContain('NO_CRM_CANDIDATE');
  });

  it('suggests a single CRM party matching the national code', () => {
    const preview = planPartyImport({
      remoteParties: [party({ externalPartyId: '101', nationalCode: '12345' })],
      links: [],
      crmParties: [{ id: 'p-1', name: 'شرکت الف', nationalCode: '12345' }],
    });

    expect(preview.rows[0]).toMatchObject({
      decision: 'LINK_SUGGESTED',
      suggestedInternalPartyId: 'p-1',
    });
  });

  it('reports an ambiguous national-code match without choosing', () => {
    const preview = planPartyImport({
      remoteParties: [party({ externalPartyId: '101', nationalCode: '12345' })],
      links: [],
      crmParties: [
        { id: 'p-1', name: 'الف', nationalCode: '12345' },
        { id: 'p-2', name: 'ب', nationalCode: '12345' },
      ],
    });

    expect(preview.rows[0].decision).toBe('AMBIGUOUS_CRM_MATCH');
  });

  it('reports an already-linked party as in sync', () => {
    const preview = planPartyImport({
      remoteParties: [party({ externalPartyId: '101' })],
      links: [
        partyLink({
          linkId: 'pl-1',
          externalPartyId: '101',
          internalPartyId: 'p-1',
        }),
      ],
      crmParties: [],
    });

    expect(preview.rows[0]).toMatchObject({
      decision: 'IN_SYNC',
      existingLinkId: 'pl-1',
      suggestedInternalPartyId: 'p-1',
    });
  });

  it('flags a duplicate remote customer id and a duplicate national code', () => {
    const preview = planPartyImport({
      remoteParties: [
        party({ externalPartyId: '101', nationalCode: '999' }),
        party({ externalPartyId: '101', nationalCode: '999' }),
      ],
      links: [],
      crmParties: [],
    });

    expect(preview.rows.every((row) => row.decision === 'DUPLICATE_REMOTE_CODE')).toBe(
      true,
    );
  });
});
