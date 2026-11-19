import { describe, expect, it } from 'vitest';

import {
  buildDraftQuotationWritePayload,
  validateCatalogItemUpsert,
  validateDraftQuotation,
} from 'src/services/quotation-save.service';

describe('quotation-save.service', () => {
  it('validates a mixed draft and builds a write payload without accounting fields', () => {
    const outcome = validateDraftQuotation({
      quotationId: null,
      status: 'DRAFT',
      customerType: 'COMPANY',
      personId: null,
      companyId: 'company-1',
      name: 'پیش‌فاکتور تست',
      paymentTerms: 'نقد',
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
    });

    expect(outcome.kind).toBe('VALIDATED');
    if (outcome.kind !== 'VALIDATED') {
      return;
    }

    const payload = buildDraftQuotationWritePayload(outcome.plan);
    expect(payload.ok).toBe(true);
    if (!payload.ok) {
      return;
    }

    expect(payload.value.quotation).not.toHaveProperty('accountingConnectionId');
    expect(payload.value.quotation).toHaveProperty('grossExact');
    expect(payload.value.quotation).toHaveProperty('documentDiscountExact');
    expect(payload.value.quotation).toHaveProperty('taxExact');
    expect(payload.value.lines.map((line) => line.kind)).toEqual([
      'PRODUCT',
      'SERVICE',
    ]);
    expect(payload.value.lines[0]).toHaveProperty('grossExact');
    expect(payload.value.lines[0]).toHaveProperty('documentDiscountExact');
  });

  it('validates catalog upsert separately from quotation', () => {
    const outcome = validateCatalogItemUpsert({
      id: null,
      kind: 'SERVICE',
      name: 'مشاوره',
      sku: null,
      unit: 'ساعت',
      description: null,
      isActive: true,
      defaultUnitPriceText: '250000',
      moneyUnit: 'TOMAN',
    });

    expect(outcome.kind).toBe('VALIDATED');
  });
});
