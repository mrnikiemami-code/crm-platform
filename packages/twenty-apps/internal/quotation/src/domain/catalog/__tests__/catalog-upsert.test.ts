import { describe, expect, it } from 'vitest';

import { buildCatalogItemUpsertPlan } from 'src/domain/catalog/catalog-upsert';

describe('buildCatalogItemUpsertPlan', () => {
  it('accepts a product with a toman default price stored as IRR exact text', () => {
    const plan = buildCatalogItemUpsertPlan({
      id: null,
      kind: 'PRODUCT',
      name: 'کابل شبکه کت ۶',
      sku: 'SKU-1',
      unit: 'عدد',
      description: null,
      isActive: true,
      defaultUnitPriceText: '۱۲۵۰۰۰',
      moneyUnit: 'TOMAN',
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }

    expect(plan.value.item.kind).toBe('PRODUCT');
    expect(plan.value.item.name).toBe('کابل شبکه کت ۶');
    // 125000 toman → 1_250_000 rial → micros with 6 decimals
    expect(plan.value.defaultUnitPriceExact).toBe('1250000.000000');
  });

  it('accepts a service without a default price', () => {
    const plan = buildCatalogItemUpsertPlan({
      id: 'svc-1',
      kind: 'SERVICE',
      name: 'نصب',
      sku: null,
      unit: 'ساعت',
      description: 'نصب در محل',
      isActive: true,
      defaultUnitPriceText: null,
      moneyUnit: 'IRR',
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }

    expect(plan.value.defaultUnitPriceExact).toBeNull();
  });

  it('refuses an empty name with a Persian message', () => {
    const plan = buildCatalogItemUpsertPlan({
      id: null,
      kind: 'PRODUCT',
      name: '   ',
      sku: null,
      unit: 'عدد',
      description: null,
      isActive: true,
      defaultUnitPriceText: null,
      moneyUnit: 'IRR',
    });

    expect(plan.ok).toBe(false);
    if (plan.ok) {
      return;
    }

    expect(plan.refusal.detail).toContain('نام');
  });
});
