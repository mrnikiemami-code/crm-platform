import { describe, expect, it } from 'vitest';

import { buildDraftQuotationPreview } from 'src/domain/quotation/draft-preview';

const baseLine = {
  clientLineId: 'line-1',
  catalogItemId: 'item-1',
  kind: 'PRODUCT' as const,
  name: 'کالا',
  description: null,
  unit: 'عدد',
  quantityText: '1',
  unitPriceText: '100000',
  moneyUnit: 'TOMAN' as const,
  discount: { kind: 'NONE' as const },
};

describe('buildDraftQuotationPreview', () => {
  it('keeps totals for valid lines while flagging incomplete ones', () => {
    const preview = buildDraftQuotationPreview({
      quotationId: null,
      status: 'DRAFT',
      customerType: 'COMPANY',
      personId: null,
      companyId: 'company-1',
      name: 'پیش‌نمایش',
      paymentTerms: null,
      taxPolicy: 'IR_VAT_9',
      documentDiscount: { kind: 'NONE' },
      displayMoneyUnit: 'TOMAN',
      lines: [
        baseLine,
        {
          ...baseLine,
          clientLineId: 'line-2',
          catalogItemId: null,
          name: '',
          unitPriceText: '',
        },
      ],
    });

    expect(preview.linePreviews[0].ok).toBe(true);
    expect(preview.linePreviews[1].ok).toBe(false);
    expect(preview.partialPlan?.ok).toBe(true);
    expect(preview.canSave).toBe(false);
    expect(preview.fullPlan.ok).toBe(false);
  });

  it('allows save only when every line is valid', () => {
    const preview = buildDraftQuotationPreview({
      quotationId: null,
      status: 'DRAFT',
      customerType: 'COMPANY',
      personId: null,
      companyId: 'company-1',
      name: 'کامل',
      paymentTerms: null,
      taxPolicy: 'IR_VAT_9',
      documentDiscount: { kind: 'NONE' },
      displayMoneyUnit: 'TOMAN',
      lines: [baseLine],
    });

    expect(preview.canSave).toBe(true);
    expect(preview.fullPlan.ok).toBe(true);
  });
});
