import { describe, expect, it } from 'vitest';

import { parseDraftForEdit } from 'src/services/quotation-draft-edit.service';

const draftEditData = (overrides: Record<string, unknown> = {}) => ({
  quotation: {
    id: 'q-1',
    status: 'DRAFT',
    version: 4,
    name: 'پیش‌فاکتور فروش',
    customerType: 'COMPANY',
    person: null,
    company: { id: 'company-1' },
    paymentTerms: '۳۰ روز',
    taxPolicy: 'IR_VAT_9',
    documentDiscountKind: 'AMOUNT',
    documentDiscountInputExact: '50000000.000000',
    documentDiscountExact: '50000000.000000',
    ...overrides,
  },
  // Lines are their own root connection in the query, not nested under the record.
  quotationLines: {
    edges: [
      {
        node: {
          id: 'line-1',
          name: 'کالای نمونه',
          kind: 'PRODUCT',
          description: null,
          unit: 'عدد',
          quantityExact: '2.000000',
          unitPriceExact: '100000000.000000',
          discountExact: '0.000000',
          discountKind: 'RATE',
          discountInputExact: '100000.000000',
          sortOrder: 1,
          item: { id: 'item-1' },
        },
      },
    ],
  },
});

describe('quotation-draft-edit.service', () => {
  it('reads stored exacts back into form inputs without losing the unit', () => {
    const result = parseDraftForEdit(draftEditData());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const { value } = result;

    // 100,000.000000 toman micros is 1,000 toman: the stored price is IRR micros
    // and the input must show the same money, not a re-parsed display string.
    expect(value.quotationId).toBe('q-1');
    expect(value.version).toBe(4);
    expect(value.moneyUnit).toBe('TOMAN');
    expect(value.customerType).toBe('COMPANY');
    expect(value.companyId).toBe('company-1');
    expect(value.lines).toHaveLength(1);
    expect(value.lines[0].clientLineId).toBe('line-1');
    expect(value.lines[0].catalogItemId).toBe('item-1');
    expect(value.lines[0].quantityText).toBe('۲');
    expect(value.lines[0].discountKind).toBe('RATE');
    expect(value.contentEditable).toBe(true);
  });

  it('treats a non-draft document as locked for editing', () => {
    const result = parseDraftForEdit(draftEditData({ status: 'SENT' }));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.contentEditable).toBe(false);
  });

  it('refuses a document with no lines instead of opening an empty form', () => {
    const result = parseDraftForEdit({
      ...draftEditData(),
      quotationLines: { edges: [] },
    });

    expect(result.ok).toBe(false);
  });

  it('refuses when the quotation is missing', () => {
    const result = parseDraftForEdit({ quotation: null });

    expect(result.ok).toBe(false);
  });
});
