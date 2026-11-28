import { describe, expect, it, vi } from 'vitest';

import { MockAccountingAdapter } from 'src/domain/accounting/adapters/mock/mock-adapter';
import { MOCK_CATALOG_ITEMS } from 'src/domain/accounting/adapters/mock/mock-dataset';
import { planItemImport, planPartyImport } from 'src/domain/accounting/import-plan';
import {
  applyItemImport,
  applyPartyImport,
  loadItemLinks,
  loadPartyLinks,
  previewItemImport,
  previewPartyImport,
} from 'src/services/accounting-import.service';

const edges = (root: string, rows: Record<string, unknown>[]) => ({
  [root]: { edges: rows.map((node) => ({ node })) },
});

const itemLinkNode = (overrides: Record<string, unknown> = {}) => ({
  id: 'link-1',
  externalItemId: '1001',
  remoteVersion: 'mock-cat6-v1',
  syncStatus: 'LINKED',
  item: { id: 'crm-1' },
  ...overrides,
});

const partyLinkNode = (overrides: Record<string, unknown> = {}) => ({
  id: 'party-link-1',
  externalPartyId: '101',
  remoteVersion: 'mock-party-1',
  syncStatus: 'LINKED',
  partyType: 'COMPANY',
  internalPartyId: 'company-1',
  ...overrides,
});

const fakeExecute = (
  handler: (query: string) => Record<string, unknown>,
) => vi.fn(async (query: string) => handler(query));

describe('link loading', () => {
  it('reads item links scoped to the connection', async () => {
    const execute = fakeExecute((query) => {
      expect(query).toContain('accountingItemLinks');
      expect(query).toContain('conn-1');

      return edges('accountingItemLinks', [itemLinkNode(), itemLinkNode({ id: '' })]);
    });

    const links = await loadItemLinks('conn-1', { execute });

    expect(links).toEqual([
      {
        linkId: 'link-1',
        externalItemId: '1001',
        internalItemId: 'crm-1',
        remoteVersion: 'mock-cat6-v1',
        syncStatus: 'LINKED',
      },
    ]);
  });

  it('reads party links including the text party id', async () => {
    const links = await loadPartyLinks('conn-1', {
      execute: fakeExecute(() => edges('accountingPartyLinks', [partyLinkNode()])),
    });

    expect(links[0]).toMatchObject({
      linkId: 'party-link-1',
      externalPartyId: '101',
      internalPartyId: 'company-1',
    });
  });
});

describe('item import preview', () => {
  it('previews the mock catalog without writing anything', async () => {
    const execute = fakeExecute((query) =>
      query.includes('accountingItemLinks')
        ? edges('accountingItemLinks', [])
        : edges('catalogItems', [{ id: 'crm-1', name: 'کالای من', sku: '1001' }]),
    );

    const preview = await previewItemImport(
      { connectionId: 'conn-1', adapter: new MockAccountingAdapter(), moneyUnit: 'RIAL' },
      { execute },
    );

    expect(preview.ok).toBe(true);

    if (!preview.ok) {
      return;
    }

    // The mock dataset is the repeatable UAT fixture: every catalog shape the screens must
    // explain (duplicate code, non-numeric id, inactive item) is present in it.
    expect(preview.value.totalRemoteItems).toBe(MOCK_CATALOG_ITEMS.length);
    expect(preview.value.summary.CREATE).toBeGreaterThan(0);
    expect(preview.value.summary.DUPLICATE_REMOTE_CODE).toBeGreaterThan(0);
    expect(
      preview.value.rows.some((row) =>
        row.warnings.includes('REMOTE_ID_NOT_NUMERIC'),
      ),
    ).toBe(true);
    expect(
      preview.value.rows.some((row) =>
        row.warnings.includes('REMOTE_ITEM_INACTIVE'),
      ),
    ).toBe(true);
    expect(execute.mock.calls.every(([query]) => !/mutation/.test(query))).toBe(true);
  });

  it('propagates a vendor read failure instead of previewing an empty catalog', async () => {
    const failing = new MockAccountingAdapter({ items: [] });
    failing.listItems = async () => ({
      ok: false,
      refusal: { code: 'TRANSPORT_ERROR', detail: 'down' },
    });

    const preview = await previewItemImport(
      { connectionId: 'conn-1', adapter: failing, moneyUnit: 'RIAL' },
      { execute: async () => ({}) },
    );

    expect(preview).toMatchObject({ ok: false, refusal: { code: 'TRANSPORT_ERROR' } });
  });
});

describe('item import apply', () => {
  const preview = planItemImport({
    remoteItems: [
      {
        externalItemId: '2001',
        code: '2001',
        name: 'کالای جدید',
        secondaryName: 'توضیح',
        sellPriceUnits: 1_500_000,
        salesPriceUnits: [],
        stock: null,
        remoteVersion: 'v1',
        isActive: true,
      },
    ],
    links: [],
    crmItems: [],
    moneyUnit: 'RIAL',
  });

  it('creates the CRM item, its link and its price in one confirmed pass', async () => {
    const writes: string[] = [];
    const execute = fakeExecute((query) => {
      if (query.includes('priceLists')) {
        return edges('priceLists', [{ id: 'pl-1' }]);
      }

      if (query.includes('QuotationUnitById')) {
        return {
          quotationUnit: {
            id: 'unit-1',
            name: 'عدد',
            isActive: true,
            code: 'UNIT_1',
            accountingCode: '100',
          },
        };
      }

      if (query.includes('createCatalogItem')) {
        writes.push('catalogItem');

        return { createCatalogItem: { id: 'crm-new' } };
      }

      if (query.includes('createAccountingItemLink')) {
        writes.push('link');

        return { createAccountingItemLink: { id: 'link-new' } };
      }

      if (query.includes('AccountingItemPrices')) return edges('prices', []);
      if (query.includes('createPrice')) {
        writes.push('price');

        return { createPrice: { id: 'price-new' } };
      }

      return {};
    });

    const outcome = await applyItemImport(
      {
        connectionId: 'conn-1',
        preview,
        selections: [{ externalItemId: '2001', unitRecordId: 'unit-1' }],
        allowRemoteVersionUpdate: false,
        applyPrices: true,
      },
      { execute },
    );

    expect(outcome).toMatchObject({
      createdItems: 1,
      createdLinks: 1,
      createdPrices: 1,
      updatedLinks: 0,
      refused: [],
    });
    expect(writes).toEqual(['catalogItem', 'price', 'link']);
  });

  it('does not create a price when no price list exists', async () => {
    const execute = fakeExecute((query) => {
      if (query.includes('priceLists')) {
        return edges('priceLists', []);
      }

      if (query.includes('QuotationUnitById')) {
        return {
          quotationUnit: {
            id: 'unit-1',
            name: 'عدد',
            isActive: true,
            code: 'UNIT_1',
            accountingCode: '100',
          },
        };
      }

      if (query.includes('createCatalogItem')) {
        return { createCatalogItem: { id: 'crm-new' } };
      }

      return {};
    });

    const outcome = await applyItemImport(
      {
        connectionId: 'conn-1',
        preview,
        selections: [{ externalItemId: '2001', unitRecordId: 'unit-1' }],
        allowRemoteVersionUpdate: false,
        applyPrices: true,
      },
      { execute },
    );

    expect(outcome.createdPrices).toBe(0);
    expect(outcome.createdItems).toBe(0);
    expect(outcome.refused).toHaveLength(1);
  });

  it('refuses an unconfirmed unit row instead of writing a converted price', async () => {
    const unconfirmed = planItemImport({
      remoteItems: [
        {
          externalItemId: '2001',
          code: '2001',
          name: 'کالای جدید',
          secondaryName: null,
          sellPriceUnits: 1_500_000,
          salesPriceUnits: [],
          stock: null,
          remoteVersion: 'v1',
          isActive: true,
        },
      ],
      links: [],
      crmItems: [],
      moneyUnit: 'UNCONFIRMED',
    });

    const outcome = await applyItemImport(
      {
        connectionId: 'conn-1',
        preview: unconfirmed,
        selections: [{ externalItemId: '2001', unitRecordId: 'unit-1' }],
        allowRemoteVersionUpdate: false,
        applyPrices: true,
      },
      {
        execute: fakeExecute((query) => {
          if (query.includes('priceLists')) {
            return edges('priceLists', [{ id: 'pl-1' }]);
          }

          if (query.includes('QuotationUnitById')) {
            return {
              quotationUnit: {
                id: 'unit-1',
                name: 'عدد',
                isActive: true,
                code: 'UNIT_1',
                accountingCode: '100',
              },
            };
          }

          return query.includes('createCatalogItem')
            ? { createCatalogItem: { id: 'crm-new' } }
            : { createAccountingItemLink: { id: 'link-new' } };
        }),
      },
    );

    // The catalog item and link are still created; the amount is not invented.
    expect(outcome.createdItems).toBe(1);
    expect(outcome.createdPrices).toBe(0);
  });

  it('updates a changed link version only when explicitly allowed', async () => {
    const changed = planItemImport({
      remoteItems: [
        {
          externalItemId: '2001',
          code: '2001',
          name: 'کالا',
          secondaryName: null,
          sellPriceUnits: 1,
          salesPriceUnits: [],
          stock: null,
          remoteVersion: 'v2',
          isActive: true,
        },
      ],
      links: [
        {
          linkId: 'link-1',
          externalItemId: '2001',
          internalItemId: 'crm-1',
          remoteVersion: 'v1',
          syncStatus: 'LINKED',
        },
      ],
      crmItems: [],
      moneyUnit: 'RIAL',
    });

    const refused = await applyItemImport(
      {
        connectionId: 'conn-1',
        preview: changed,
        selections: [{ externalItemId: '2001' }],
        allowRemoteVersionUpdate: false,
        applyPrices: false,
      },
      { execute: async () => ({}) },
    );

    expect(refused.updatedLinks).toBe(0);
    expect(refused.refused[0].detail).toContain('confirm the version update');

    const execute = fakeExecute((query) => {
      if (query.includes('CatalogItemById')) return { catalogItem: { id: 'crm-1', name: 'نام قبلی', sku: '2001' } };
      if (query.includes('updateCatalogItem')) return { updateCatalogItem: { id: 'crm-1' } };
      expect(query).toContain('updateAccountingItemLink');

      return { updateAccountingItemLink: { id: 'link-1' } };
    });

    const updated = await applyItemImport(
      {
        connectionId: 'conn-1',
        preview: changed,
        selections: [{ externalItemId: '2001' }],
        allowRemoteVersionUpdate: true,
        applyPrices: false,
      },
      { execute },
    );

    expect(updated.updatedLinks).toBe(1);
  });
});

describe('party import', () => {
  it('previews duplicate remote customers and needs an explicit CRM record', async () => {
    const adapter = new MockAccountingAdapter();
    const preview = await previewPartyImport(
      { connectionId: 'conn-1', adapter },
      { execute: async () => ({ ...edges('accountingPartyLinks', []), ...edges('people', []), ...edges('companies', []) }) },
    );

    expect(preview.ok).toBe(true);

    if (!preview.ok) {
      return;
    }

    // Two parties share vendor id 101, so neither may be linked implicitly.
    expect(preview.value.rows[0]).toMatchObject({
      externalPartyId: '101',
      decision: 'DUPLICATE_REMOTE_CODE',
    });
    // And at least one unambiguous remote party still waits for a person to choose a CRM
    // record rather than being matched by name.
    expect(
      preview.value.rows.some((row) => row.decision === 'NEEDS_CRM_RECORD'),
    ).toBe(true);
    expect(
      preview.value.rows.some((row) =>
        row.warnings.includes('DUPLICATE_REMOTE_NATIONAL_CODE'),
      ),
    ).toBe(true);
  });

  it('creates a link for an explicit CRM party and refuses to duplicate it', async () => {
    let linkExists = false;
    const remoteParties = [{ externalPartyId: '101', code: '101', fullName: 'شرکت الف', mobile: null, nationalCode: null, remoteVersion: 'v1' }];
    const execute = fakeExecute((query) => {
      if (query.includes('createAccountingPartyLink')) {
        linkExists = true;

        return { createAccountingPartyLink: { id: 'pl-new' } };
      }

      if (query.includes('AccountingPartyIdentities')) return { ...edges('people', []), ...edges('companies', [{ id: 'company-1', name: 'شرکت الف', nationalCode: null }]) };
      if (query.includes('CustomerCompanies')) return edges('companies', [{ id: 'company-1', name: 'شرکت الف' }]);
      return edges(
        'accountingPartyLinks',
        linkExists ? [partyLinkNode({ id: 'pl-new', externalPartyId: '101' })] : [],
      );
    });

    const first = await applyPartyImport(
      {
        connectionId: 'conn-1',
        selections: [
          { externalPartyId: '101', internalPartyId: 'company-1', partyType: 'COMPANY' },
        ],
        allowRemoteVersionUpdate: false,
        remoteParties,
      },
      { execute },
    );

    expect(first).toMatchObject({ createdLinks: 1, updatedLinks: 0, refused: [] });

    const second = await applyPartyImport(
      {
        connectionId: 'conn-1',
        selections: [
          { externalPartyId: '101', internalPartyId: 'company-1', partyType: 'COMPANY' },
        ],
        allowRemoteVersionUpdate: false,
        remoteParties,
      },
      { execute },
    );

    expect(second.createdLinks).toBe(0);
    expect(second.refused[0].code).toBe('ALREADY_SUCCEEDED');
  });
});

describe('party preview planning', () => {
  it('does not invent a CRM match from a name', () => {
    const preview = planPartyImport({
      remoteParties: [
        {
          externalPartyId: '101',
          code: '101',
          fullName: 'شرکت الف',
          mobile: null,
          nationalCode: null,
          remoteVersion: 'p1',
        },
      ],
      links: [],
      crmParties: [{ id: 'company-1', name: 'شرکت الف', nationalCode: null }],
    });

    expect(preview.rows[0].decision).toBe('NEEDS_CRM_RECORD');
  });
});
