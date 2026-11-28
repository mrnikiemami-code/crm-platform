import { describe, expect, it, vi } from 'vitest';

import {
  persistCatalogItem,
  persistDraftQuotation,
} from 'src/services/quotation-persist.service';
import { type AtomicSaveRequest } from 'src/data/atomic-draft-save-api';

// A save verifies the customer round-trip before it hands the plan to the atomic
// endpoint, so every mock that reaches a write has to answer that lookup like a
// real workspace.
const answerCustomerLookup = (
  query: string,
): Record<string, unknown> | null => {
  if (query.includes('query CustomerCompanies')) {
    return {
      companies: {
        edges: [{ node: { id: 'company-1', name: 'شرکت تست' } }],
        pageInfo: { hasNextPage: false },
      },
    };
  }

  if (query.includes('query CustomerPeople')) {
    return {
      people: {
        edges: [
          { node: { id: 'person-1', name: { firstName: 'سارا', lastName: 'تستی' } } },
        ],
        pageInfo: { hasNextPage: false },
      },
    };
  }

  return null;
};

const companyDraftInput = () => ({
  quotationId: null as string | null,
  expectedVersion: null as number | null,
  status: 'DRAFT' as const,
  customerType: 'COMPANY' as const,
  personId: null,
  companyId: 'company-1',
  name: 'پیش‌نویس تست',
  paymentTerms: null,
  taxPolicy: 'IR_VAT_9',
  documentDiscount: { kind: 'NONE' as const },
  displayMoneyUnit: 'TOMAN' as const,
  lines: [
    {
      clientLineId: '1',
      catalogItemId: null,
      kind: 'PRODUCT' as const,
      name: 'کالا',
      description: null,
      unit: 'عدد',
      quantityText: '3',
      unitPriceText: '2000',
      moneyUnit: 'TOMAN' as const,
      discount: { kind: 'NONE' as const },
    },
    {
      clientLineId: '2',
      catalogItemId: null,
      kind: 'SERVICE' as const,
      name: 'خدمت',
      description: null,
      unit: 'ساعت',
      quantityText: '1',
      unitPriceText: '500',
      moneyUnit: 'TOMAN' as const,
      discount: { kind: 'RATE' as const, percentText: '10' },
    },
  ],
});

const customerOnlyExecute = () =>
  vi.fn(async (query: string) => {
    const answer = answerCustomerLookup(query);

    if (answer !== null) {
      return answer;
    }

    throw new Error(`unexpected query: ${query.slice(0, 80)}`);
  });

describe('quotation-persist.service', () => {
  it('creates a catalog item through GraphQL when installed', async () => {
    const execute = vi.fn(async (query: string) => {
      if (query.includes('createCatalogItem')) {
        return { createCatalogItem: { id: 'item-1' } };
      }

      if (query.includes('DefaultPriceList') || query.includes('IrrPriceList')) {
        return { priceLists: { edges: [{ node: { id: 'list-1' } }] } };
      }

      if (query.includes('createPrice')) {
        return { createPrice: { id: 'price-1' } };
      }

      throw new Error(`unexpected query: ${query.slice(0, 80)}`);
    });

    const result = await persistCatalogItem(
      {
        id: null,
        kind: 'PRODUCT',
        name: 'کالای تست',
        sku: 'SKU-1',
        unit: 'عدد',
        unitRecordId: 'unit-1',
        secondaryName: null,
        description: null,
        isActive: true,
        defaultUnitPriceText: '1000',
        moneyUnit: 'TOMAN',
      },
      { execute },
    );

    expect(result.kind).toBe('SAVED');
    if (result.kind !== 'SAVED') {
      return;
    }

    expect(result.itemId).toBe('item-1');
    expect(execute).toHaveBeenCalled();
  });

  it('sends a new multi-line draft as one atomic request', async () => {
    const execute = customerOnlyExecute();
    const saveDraftAtomically = vi.fn(async (_request: AtomicSaveRequest) => ({
      kind: 'SAVED' as const,
      quotationId: 'q-new',
      version: 1,
    }));

    const result = await persistDraftQuotation(companyDraftInput(), {
      execute,
      saveDraftAtomically,
    });

    expect(result.kind).toBe('SAVED');
    if (result.kind !== 'SAVED') {
      return;
    }

    expect(result.quotationId).toBe('q-new');
    expect(result.version).toBe(1);
    expect(saveDraftAtomically).toHaveBeenCalledTimes(1);

    const request = saveDraftAtomically.mock.calls[0][0];

    expect(request.quotationId).toBeNull();
    expect(request.expectedVersion).toBeNull();
    expect(request.header.name).toBe('پیش‌نویس تست');
    expect(request.header.customerType).toBe('COMPANY');
    expect(request.header.companyId).toBe('company-1');
    expect(request.header.personId).toBeNull();
    expect(request.header.currencyCode).toBe('IRR');
    expect(request.header.taxPolicy).toBe('IR_VAT_9');
    expect(request.header.totalExact).toMatch(/^\d+\.\d{6}$/);
    expect(request.header.grossExact).toMatch(/^\d+\.\d{6}$/);
    expect(request.lines).toHaveLength(2);
    expect(request.lines[1].discountKind).toBe('RATE');
    // Nothing may reach the database outside the atomic call.
    expect(
      execute.mock.calls.filter(([query]) =>
        String(query).includes('mutation'),
      ),
    ).toHaveLength(0);
  });

  it('edits the same document in place with the observed version', async () => {
    const execute = customerOnlyExecute();
    const saveDraftAtomically = vi.fn(
      async (_request: AtomicSaveRequest) => ({
        kind: 'SAVED' as const,
        quotationId: 'q-1',
        version: 3,
      }),
    );

    const result = await persistDraftQuotation(
      { ...companyDraftInput(), quotationId: 'q-1', expectedVersion: 2 },
      { execute, saveDraftAtomically },
    );

    expect(result.kind).toBe('SAVED');
    expect(saveDraftAtomically).toHaveBeenCalledTimes(1);

    const request = saveDraftAtomically.mock.calls[0][0];

    // No second document is ever created: the id and version travel together.
    expect(request.quotationId).toBe('q-1');
    expect(request.expectedVersion).toBe(2);
    expect(
      execute.mock.calls.filter(([query]) =>
        String(query).includes('createQuotation'),
      ),
    ).toHaveLength(0);
  });

  it('sends only the lines the operator kept', async () => {
    const execute = customerOnlyExecute();
    const saveDraftAtomically = vi.fn(
      async (_request: AtomicSaveRequest) => ({
        kind: 'SAVED' as const,
        quotationId: 'q-1',
        version: 7,
      }),
    );

    const input = companyDraftInput();

    await persistDraftQuotation(
      {
        ...input,
        quotationId: 'q-1',
        expectedVersion: 6,
        lines: [input.lines[1]],
      },
      { execute, saveDraftAtomically },
    );

    const request = saveDraftAtomically.mock.calls[0][0];

    // Reconciliation lives in the transaction; the client never promises which
    // server-side line id a row has.
    expect(request.lines).toHaveLength(1);
    expect(request.lines[0].name).toBe('خدمت');
  });

  it('propagates a stale-version refusal from the transaction', async () => {
    const execute = customerOnlyExecute();
    const saveDraftAtomically = vi.fn(async () => ({
      kind: 'REJECTED' as const,
      code: 'VERSION_CONFLICT',
      message: 'این پیش‌فاکتور تغییر کرده است',
    }));

    const result = await persistDraftQuotation(
      { ...companyDraftInput(), quotationId: 'q-1', expectedVersion: 1 },
      { execute, saveDraftAtomically },
    );

    expect(result.kind).toBe('REJECTED');
    if (result.kind !== 'REJECTED') {
      return;
    }

    expect(result.code).toBe('VERSION_CONFLICT');
  });

  it('propagates the locked-document refusal from the transaction', async () => {
    const execute = customerOnlyExecute();
    const saveDraftAtomically = vi.fn(async () => ({
      kind: 'REJECTED' as const,
      code: 'QUOTATION_IMMUTABLE',
      message: 'سند قفل است',
    }));

    const result = await persistDraftQuotation(
      { ...companyDraftInput(), quotationId: 'q-1', expectedVersion: 1 },
      { execute, saveDraftAtomically },
    );

    expect(result.kind).toBe('REJECTED');
    if (result.kind !== 'REJECTED') {
      return;
    }

    expect(result.code).toBe('QUOTATION_IMMUTABLE');
  });

  it('refuses a customer id the workspace cannot resolve, before any write', async () => {
    const execute = vi.fn(async (query: string) => {
      if (query.includes('query CustomerCompanies')) {
        return { companies: { edges: [], pageInfo: { hasNextPage: false } } };
      }

      throw new Error(`unexpected query: ${query.slice(0, 80)}`);
    });
    const saveDraftAtomically = vi.fn();

    const result = await persistDraftQuotation(
      { ...companyDraftInput(), companyId: 'company-does-not-exist' },
      { execute, saveDraftAtomically },
    );

    expect(result.kind).toBe('REJECTED');
    if (result.kind !== 'REJECTED') {
      return;
    }

    expect(result.code).toBe('CUSTOMER_NOT_FOUND');
    expect(saveDraftAtomically).not.toHaveBeenCalled();
  });

  it('reports a transport failure without claiming a save', async () => {
    const execute = customerOnlyExecute();
    const saveDraftAtomically = vi.fn(async () => {
      throw new Error('socket closed');
    });

    const result = await persistDraftQuotation(companyDraftInput(), {
      execute,
      saveDraftAtomically,
    });

    expect(result.kind).toBe('REJECTED');
    if (result.kind !== 'REJECTED') {
      return;
    }

    expect(result.code).toBe('PERSISTENCE_FAILED');
  });
});
