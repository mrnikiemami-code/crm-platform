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
});
