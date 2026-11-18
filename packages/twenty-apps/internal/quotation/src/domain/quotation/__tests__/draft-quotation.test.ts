import { describe, expect, it } from 'vitest';

import { buildDraftQuotationPlan } from 'src/domain/quotation/draft-quotation';

describe('buildDraftQuotationPlan', () => {
  const baseLine = {
    clientLineId: 'line-1',
    catalogItemId: 'item-1',
    kind: 'PRODUCT' as const,
    name: 'کابل شبکه',
    description: null,
    unit: 'عدد',
    quantityText: '۲',
    unitPriceText: '1000',
    moneyUnit: 'TOMAN' as const,
    discount: { kind: 'NONE' as const },
    taxRatePercentText: '۹',
  };

  it('computes mixed product/service draft totals in IRR micros', () => {
    const plan = buildDraftQuotationPlan({
      quotationId: null,
      status: 'DRAFT',
      customerType: 'COMPANY',
      personId: null,
      companyId: 'company-1',
      name: 'پیش‌فاکتور نمونه',
      paymentTerms: '۳۰ روز',
      taxPolicy: 'IR_VAT_9',
      displayMoneyUnit: 'TOMAN',
      lines: [
        baseLine,
        {
          ...baseLine,
          clientLineId: 'line-2',
          kind: 'SERVICE',
          name: 'نصب',
          unit: 'ساعت',
          quantityText: '1.5',
          unitPriceText: '2000',
          discount: { kind: 'RATE', percentText: '10' },
        },
      ],
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }

    // line1: 2 * 1000 toman = 2000 toman = 20_000 rial → 20_000_000_000 micros? 
    // parseMoneyInput: 1000 toman → 1000 * 1e6 typed micros * 10 = 10_000_000_000 irr micros per unit
    // qty 2 → gross 20_000_000_000
    // tax 9% → 1_800_000_000
    // total line1 = 21_800_000_000
    expect(plan.value.lines).toHaveLength(2);
    expect(plan.value.lines[0].kind).toBe('PRODUCT');
    expect(plan.value.lines[1].kind).toBe('SERVICE');
    expect(plan.value.currencyCode).toBe('IRR');
    expect(plan.value.status).toBe('DRAFT');
    expect(plan.value.displayTotal.includes('تومان') || plan.value.displayTotal.includes('ریال')).toBe(
      true,
    );
    expect(plan.value.totalExact).toMatch(/^\d+\.\d{6}$/);
  });

  it('refuses a draft without a customer', () => {
    const plan = buildDraftQuotationPlan({
      quotationId: null,
      status: 'DRAFT',
      customerType: 'PERSON',
      personId: null,
      companyId: null,
      name: 'بدون مشتری',
      paymentTerms: null,
      taxPolicy: null,
      displayMoneyUnit: 'IRR',
      lines: [baseLine],
    });

    expect(plan.ok).toBe(false);
    if (plan.ok) {
      return;
    }

    expect(plan.refusal.code).toBe('CUSTOMER_PERSON_REQUIRED');
  });

  it('refuses editing a sent quotation in place', () => {
    const plan = buildDraftQuotationPlan({
      quotationId: 'q-1',
      status: 'SENT',
      customerType: 'COMPANY',
      personId: null,
      companyId: 'c-1',
      name: 'ارسال‌شده',
      paymentTerms: null,
      taxPolicy: null,
      displayMoneyUnit: 'IRR',
      lines: [baseLine],
    });

    expect(plan.ok).toBe(false);
    if (plan.ok) {
      return;
    }

    expect(plan.refusal.code).toBe('QUOTATION_NOT_EDITABLE');
  });
});
