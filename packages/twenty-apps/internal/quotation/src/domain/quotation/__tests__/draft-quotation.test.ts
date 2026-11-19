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
      documentDiscount: { kind: 'NONE' },
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

    expect(plan.value.lines).toHaveLength(2);
    expect(plan.value.lines[0].kind).toBe('PRODUCT');
    expect(plan.value.lines[1].kind).toBe('SERVICE');
    expect(plan.value.currencyCode).toBe('IRR');
    expect(plan.value.status).toBe('DRAFT');
    expect(plan.value.taxPolicy).toBe('IR_VAT_9');
    expect(plan.value.totalExact).toMatch(/^\d+\.000000$/);
    expect(
      plan.value.displayTotal.includes('تومان') ||
        plan.value.displayTotal.includes('ریال'),
      ).toBe(true);
    expect(plan.value.displayTotal).not.toMatch(/\d\.\d{6}/);
  });

  it('applies document discount and keeps payable as whole rial', () => {
    const plan = buildDraftQuotationPlan({
      quotationId: null,
      status: 'DRAFT',
      customerType: 'COMPANY',
      personId: null,
      companyId: 'company-1',
      name: 'با تخفیف کل',
      paymentTerms: null,
      taxPolicy: 'IR_VAT_9',
      documentDiscount: { kind: 'RATE', percentText: '10' },
      displayMoneyUnit: 'IRR',
      lines: [
        {
          ...baseLine,
          quantityText: '1',
          unitPriceText: '1000000',
          moneyUnit: 'IRR',
          discount: { kind: 'AMOUNT', text: '100000' },
        },
        {
          ...baseLine,
          clientLineId: 'line-2',
          kind: 'SERVICE',
          name: 'خدمت',
          unit: 'ساعت',
          quantityText: '2.5',
          unitPriceText: '400000',
          moneyUnit: 'IRR',
          discount: { kind: 'NONE' },
        },
      ],
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }

    expect(plan.value.totalsExact.documentDiscountExact).not.toBe('0.000000');
    expect(plan.value.totalsExact.totalExact.endsWith('.000000')).toBe(true);
    expect(plan.value.totalsExact).toHaveProperty('roundingExact');
    expect(plan.value.displayGross.length).toBeGreaterThan(0);
    expect(plan.value.displayLineDiscount.length).toBeGreaterThan(0);
    expect(plan.value.displayDocumentDiscount.length).toBeGreaterThan(0);
    expect(plan.value.displayTax.length).toBeGreaterThan(0);
    expect(plan.value.displayRounding.length).toBeGreaterThan(0);
    expect(plan.value.totalExact).toBe(
      // payable = net + tax + rounding (exact text equality via micros already tested)
      plan.value.totalsExact.totalExact,
    );
  });

  it('refuses document discount larger than net after line discounts', () => {
    const plan = buildDraftQuotationPlan({
      quotationId: null,
      status: 'DRAFT',
      customerType: 'COMPANY',
      personId: null,
      companyId: 'company-1',
      name: 'تخفیف نامعتبر',
      paymentTerms: null,
      taxPolicy: 'IR_VAT_9',
      documentDiscount: { kind: 'AMOUNT', text: '999999999' },
      displayMoneyUnit: 'IRR',
      lines: [
        {
          ...baseLine,
          quantityText: '1',
          unitPriceText: '1000',
          moneyUnit: 'IRR',
        },
      ],
    });

    expect(plan.ok).toBe(false);
    if (plan.ok) {
      return;
    }

    expect(plan.refusal.code).toBe('DOCUMENT_DISCOUNT_EXCEEDS_NET');
  });

  it('refuses unknown tax policy instead of inventing a rate', () => {
    const plan = buildDraftQuotationPlan({
      quotationId: null,
      status: 'DRAFT',
      customerType: 'COMPANY',
      personId: null,
      companyId: 'company-1',
      name: 'سیاست ناشناخته',
      paymentTerms: null,
      taxPolicy: 'IR_VAT_FAKE',
      documentDiscount: { kind: 'NONE' },
      displayMoneyUnit: 'IRR',
      lines: [baseLine],
    });

    expect(plan.ok).toBe(false);
    if (plan.ok) {
      return;
    }

    expect(plan.refusal.code).toBe('TAX_POLICY_UNKNOWN');
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
      taxPolicy: 'IR_VAT_9',
      documentDiscount: { kind: 'NONE' },
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
      taxPolicy: 'IR_VAT_9',
      documentDiscount: { kind: 'NONE' },
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
