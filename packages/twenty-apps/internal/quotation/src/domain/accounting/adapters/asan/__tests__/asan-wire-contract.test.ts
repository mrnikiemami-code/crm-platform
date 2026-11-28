import { describe, expect, it } from 'vitest';
import { ASAN_GUIDE_FIELD_MODELS, ASAN_GUIDE_OPERATIONS } from 'src/domain/accounting/adapters/asan/asan-wire-contract';
import { ASAN_ENDPOINTS } from 'src/domain/accounting/adapters/asan/asan-endpoints';

describe('Asan guide inventory', () => {
  it('covers all 47 distinct routes and 17 data models, without duplicating paths', () => {
    expect(ASAN_GUIDE_OPERATIONS).toHaveLength(47);
    expect(new Set(ASAN_GUIDE_OPERATIONS.map((op) => op.method + ' ' + op.path)).size).toBe(47);
    expect(Object.keys(ASAN_GUIDE_FIELD_MODELS)).toHaveLength(17);
    expect(new Set(ASAN_GUIDE_OPERATIONS.map((op) => op.path))).toEqual(new Set(Object.values(ASAN_ENDPOINTS)));
  });
  it('keeps customer input and output separate and classifies the mutating GET', () => {
    expect(ASAN_GUIDE_FIELD_MODELS.CustomerViewModel.PersonCode).toBe('int');
    expect(ASAN_GUIDE_FIELD_MODELS.CustomerServiceViewModel.Code).toBe('long');
    expect(ASAN_GUIDE_FIELD_MODELS.Products.TotalCount).toBe('double');
    expect(ASAN_GUIDE_OPERATIONS.find((op) => op.path === ASAN_ENDPOINTS.updateFactorState))
      .toMatchObject({ method: 'GET', effect: 'WRITE' });
    expect(ASAN_GUIDE_OPERATIONS.find((op) => op.path === ASAN_ENDPOINTS.lastCustomerPishFactors))
      .toMatchObject({ method: 'POST', effect: 'READ' });
  });
});
