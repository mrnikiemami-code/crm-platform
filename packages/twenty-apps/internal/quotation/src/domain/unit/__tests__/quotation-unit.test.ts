import { describe, expect, it } from 'vitest';

import {
  validateQuotationUnitAccountingCode,
  validateQuotationUnitName,
  validateUnitRecordSelection,
} from 'src/domain/unit/quotation-unit';

describe('quotation unit validation', () => {
  it('requires a non-empty name', () => {
    expect(validateQuotationUnitName('   ').ok).toBe(false);
    expect(validateQuotationUnitName('عدد').ok).toBe(true);
  });

  it('accepts empty accounting code and rejects invalid characters', () => {
    expect(validateQuotationUnitAccountingCode('').ok).toBe(true);
    expect(validateQuotationUnitAccountingCode('100').ok).toBe(true);
    expect(validateQuotationUnitAccountingCode(' 1 0 0 ').ok).toBe(false);
  });

  it('requires an active catalog unit for selection', () => {
    const catalog = [
      {
        recordId: 'u1',
        code: 'UNIT_1',
        name: 'عدد',
        isActive: false,
        accountingCode: '100',
      },
    ];

    expect(validateUnitRecordSelection({ recordId: null, catalog }).ok).toBe(
      false,
    );
    expect(
      validateUnitRecordSelection({ recordId: 'u1', catalog }).ok,
    ).toBe(false);
    expect(
      validateUnitRecordSelection({
        recordId: 'u1',
        catalog: [{ ...catalog[0], isActive: true }],
      }).ok,
    ).toBe(true);
  });
});