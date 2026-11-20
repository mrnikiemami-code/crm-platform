import { describe, expect, it, vi } from 'vitest';

import {
  persistCatalogItem,
  persistDraftQuotation,
} from 'src/services/quotation-persist.service';

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

  it('refuses mutating a sent quotation', async () => {
    const execute = vi.fn(async (query: string) => {
      if (query.includes('QuotationById')) {
        return {
          quotation: { id: 'q-1', status: 'SENT', version: 1, name: 'قدیمی' },
        };
      }

      throw new Error(`unexpected query: ${query.slice(0, 80)}`);
    });

    const result = await persistDraftQuotation(
      {
        quotationId: 'q-1',
        status: 'DRAFT',
        customerType: 'COMPANY',
        personId: null,
        companyId: 'company-1',
        name: 'تلاش برای ویرایش',
        paymentTerms: null,
        taxPolicy: 'IR_VAT_9',
        documentDiscount: { kind: 'NONE' },
        displayMoneyUnit: 'TOMAN',
        lines: [
          {
            clientLineId: '1',
            catalogItemId: null,
            kind: 'PRODUCT',
            name: 'کالا',
            description: null,
            unit: 'عدد',
            quantityText: '1',
            unitPriceText: '1000',
            moneyUnit: 'TOMAN',
            discount: { kind: 'NONE' },
          },
        ],
      },
      { execute },
    );

    expect(result.kind).toBe('REJECTED');
    if (result.kind !== 'REJECTED') {
      return;
    }

    expect(result.code).toBe('QUOTATION_IMMUTABLE');
  });

  it('creates quotation and lines for a new draft', async () => {
    const execute = vi.fn(async (query: string) => {
      if (query.includes('createQuotation')) {
        return { createQuotation: { id: 'q-new', status: 'DRAFT', version: 1 } };
      }

      if (query.includes('createQuotationLine')) {
        return { createQuotationLine: { id: 'line-1' } };
      }

      if (query.includes('QuotationById')) {
        return {
          quotation: { id: 'q-new', status: 'DRAFT', version: 1, name: 'جدید' },
        };
      }

      throw new Error(`unexpected query: ${query.slice(0, 80)}`);
    });

    const result = await persistDraftQuotation(
      {
        quotationId: null,
        status: 'DRAFT',
        customerType: 'PERSON',
        personId: 'person-1',
        companyId: null,
        name: 'پیش‌فاکتور شخص',
        paymentTerms: 'نقد',
        taxPolicy: 'IR_VAT_9',
        documentDiscount: { kind: 'RATE', percentText: '5' },
        displayMoneyUnit: 'TOMAN',
        lines: [
          {
            clientLineId: '1',
            catalogItemId: null,
            kind: 'PRODUCT',
            name: 'کالا',
            description: null,
            unit: 'عدد',
            quantityText: '1',
            unitPriceText: '1000',
            moneyUnit: 'TOMAN',
            discount: { kind: 'RATE', percentText: '10' },
          },
          {
            clientLineId: '2',
            catalogItemId: null,
            kind: 'SERVICE',
            name: 'خدمت',
            description: null,
            unit: 'ساعت',
            quantityText: '2',
            unitPriceText: '500',
            moneyUnit: 'TOMAN',
            discount: { kind: 'NONE' },
          },
        ],
      },
      { execute },
    );

    expect(result.kind).toBe('SAVED');
    if (result.kind !== 'SAVED') {
      return;
    }

    expect(result.quotationId).toBe('q-new');
    expect(
      execute.mock.calls.filter(([query]) =>
        String(query).includes('createQuotationLine'),
      ),
    ).toHaveLength(2);
  });

  it('refuses a stale save whose version moved on', async () => {
    const execute = vi.fn(async (query: string) => {
      if (query.includes('QuotationById')) {
        return {
          quotation: { id: 'q-1', status: 'DRAFT', version: 3, name: 'دستی' },
        };
      }

      throw new Error(`unexpected query: ${query.slice(0, 80)}`);
    });

    const result = await persistDraftQuotation(
      {
        quotationId: 'q-1',
        expectedVersion: 1,
        status: 'DRAFT',
        customerType: 'COMPANY',
        personId: null,
        companyId: 'company-1',
        name: 'ویرایش قدیمی',
        paymentTerms: null,
        taxPolicy: 'IR_VAT_9',
        documentDiscount: { kind: 'NONE' },
        displayMoneyUnit: 'TOMAN',
        lines: [
          {
            clientLineId: '1',
            catalogItemId: null,
            kind: 'PRODUCT',
            name: 'کالا',
            description: null,
            unit: 'عدد',
            quantityText: '1',
            unitPriceText: '1000',
            moneyUnit: 'TOMAN',
            discount: { kind: 'NONE' },
          },
        ],
      },
      { execute },
    );

    expect(result.kind).toBe('REJECTED');
    if (result.kind !== 'REJECTED') {
      return;
    }

    expect(result.code).toBe('VERSION_CONFLICT');
  });

  it('updates the same quotation in place and keeps its line ids', async () => {
    let quotationReads = 0;

    const execute = vi.fn(async (query: string) => {
      if (query.includes('QuotationById')) {
        quotationReads += 1;

        return {
          quotation: {
            id: 'q-1',
            status: 'DRAFT',
            version: quotationReads === 1 ? 2 : 3,
            name: 'قدیمی',
          },
        };
      }

      if (query.includes('updateQuotationLine')) {
        return { updateQuotationLine: { id: 'line-old' } };
      }

      if (query.includes('updateQuotation')) {
        return { updateQuotation: { id: 'q-1', status: 'DRAFT', version: 3 } };
      }

      if (query.includes('QuotationLinesByQuotation')) {
        return { quotationLines: { edges: [{ node: { id: 'line-old' } }] } };
      }

      if (query.includes('createQuotationLine')) {
        return { createQuotationLine: { id: 'line-new' } };
      }

      // Customer label lookup: no customer node is a valid answer.
      return { person: null, company: null };
    });

    const result = await persistDraftQuotation(
      {
        quotationId: 'q-1',
        expectedVersion: 2,
        status: 'DRAFT',
        customerType: 'COMPANY',
        personId: null,
        companyId: 'company-1',
        name: 'پیش‌نویس ویرایش‌شده',
        paymentTerms: null,
        taxPolicy: 'IR_VAT_9',
        documentDiscount: { kind: 'NONE' },
        displayMoneyUnit: 'TOMAN',
        lines: [
          {
            clientLineId: '1',
            catalogItemId: null,
            kind: 'PRODUCT',
            name: 'کالا',
            description: null,
            unit: 'عدد',
            quantityText: '3',
            unitPriceText: '2000',
            moneyUnit: 'TOMAN',
            discount: { kind: 'NONE' },
          },
          {
            clientLineId: '2',
            catalogItemId: null,
            kind: 'SERVICE',
            name: 'خدمت',
            description: null,
            unit: 'ساعت',
            quantityText: '1',
            unitPriceText: '500',
            moneyUnit: 'TOMAN',
            discount: { kind: 'NONE' },
          },
        ],
      },
      { execute },
    );

    expect(result.kind).toBe('SAVED');
    if (result.kind !== 'SAVED') {
      return;
    }

    const queries = execute.mock.calls.map(([query]) => String(query));

    expect(result.quotationId).toBe('q-1');
    expect(result.version).toBe(3);
    expect(queries.filter((query) => query.includes('mutation CreateQuotation {'))).toHaveLength(0);
    // The observed version is the lock token; the hook bumps it, not the client.
    expect(
      queries.filter((query) => query.includes('mutation UpdateQuotation {')),
    ).toHaveLength(1);
    expect(
      queries.filter((query) => query.includes('mutation UpdateQuotation {') && query.includes('version: 2')),
    ).toHaveLength(1);
    expect(queries.filter((query) => query.includes('updateQuotationLine'))).toHaveLength(1);
    expect(queries.filter((query) => query.includes('createQuotationLine'))).toHaveLength(1);
    expect(queries.filter((query) => query.includes('deleteQuotationLine'))).toHaveLength(0);
  });

  it('soft deletes only the line a draft no longer has', async () => {
    let quotationReads = 0;

    const execute = vi.fn(async (query: string) => {
      if (query.includes('QuotationById')) {
        quotationReads += 1;

        return {
          quotation: {
            id: 'q-1',
            status: 'DRAFT',
            version: quotationReads === 1 ? 4 : 6,
            name: 'قدیمی',
          },
        };
      }

      if (query.includes('updateQuotationLine')) {
        return { updateQuotationLine: { id: 'line-a' } };
      }

      if (query.includes('deleteQuotationLine')) {
        return { deleteQuotationLine: { id: 'line-b' } };
      }

      if (query.includes('updateQuotation')) {
        return { updateQuotation: { id: 'q-1', status: 'DRAFT', version: 5 } };
      }

      if (query.includes('QuotationLinesByQuotation')) {
        return {
          quotationLines: {
            edges: [{ node: { id: 'line-a' } }, { node: { id: 'line-b' } }],
          },
        };
      }

      return { person: null, company: null };
    });

    const result = await persistDraftQuotation(
      {
        quotationId: 'q-1',
        expectedVersion: 4,
        status: 'DRAFT',
        customerType: 'COMPANY',
        personId: null,
        companyId: 'company-1',
        name: 'یک ردیف کمتر',
        paymentTerms: null,
        taxPolicy: 'IR_VAT_9',
        documentDiscount: { kind: 'NONE' },
        displayMoneyUnit: 'TOMAN',
        lines: [
          {
            clientLineId: '1',
            catalogItemId: null,
            kind: 'PRODUCT',
            name: 'کالا',
            description: null,
            unit: 'عدد',
            quantityText: '1',
            unitPriceText: '1000',
            moneyUnit: 'TOMAN',
            discount: { kind: 'NONE' },
          },
        ],
      },
      { execute },
    );

    const queries = execute.mock.calls.map(([query]) => String(query));

    expect(result.kind).toBe('SAVED');
    if (result.kind !== 'SAVED') {
      return;
    }

    expect(result.version).toBe(6);
    expect(queries.filter((query) => query.includes('updateQuotationLine'))).toHaveLength(1);
    expect(
      queries.filter((query) => query.includes('deleteQuotationLine') && query.includes('line-b')),
    ).toHaveLength(1);
    expect(
      queries.filter((query) => query.includes('deleteQuotationLine') && query.includes('line-a')),
    ).toHaveLength(0);
  });
});
