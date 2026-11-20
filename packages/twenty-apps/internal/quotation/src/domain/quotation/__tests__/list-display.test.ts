import { describe, expect, it } from 'vitest';

import {
  DRAFT_QUOTATION_NUMBER_LABEL,
  buildQuotationListDisplay,
  buildQuotationTotalDisplay,
} from 'src/domain/quotation/list-display';

const PERSON_CUSTOMER = {
  person: { name: { firstName: 'سارا', lastName: 'محمدی' } },
  company: null,
};

const COMPANY_CUSTOMER = {
  person: null,
  company: { name: 'شرکت پارس' },
};

describe('quotation list display', () => {
  it('labels a draft without a number instead of leaving the cell empty', () => {
    const display = buildQuotationListDisplay({
      quotationNumber: null,
      customer: PERSON_CUSTOMER,
      totalExact: '2305350.000000',
      currencyCode: 'IRR',
    });

    expect(display.quotationNumberLabel).toBe(DRAFT_QUOTATION_NUMBER_LABEL);
  });

  it('prints an issued number in Persian digits', () => {
    const display = buildQuotationListDisplay({
      quotationNumber: 'QT-1405-000012',
      customer: PERSON_CUSTOMER,
      totalExact: '2305350.000000',
      currencyCode: 'IRR',
    });

    expect(display.quotationNumberLabel).toBe('QT-۱۴۰۵-۰۰۰۰۱۲');
  });

  it('reads the customer from the real related record', () => {
    expect(
      buildQuotationListDisplay({
        quotationNumber: null,
        customer: PERSON_CUSTOMER,
        totalExact: null,
        currencyCode: null,
      }).customerName,
    ).toBe('سارا محمدی');

    expect(
      buildQuotationListDisplay({
        quotationNumber: null,
        customer: COMPANY_CUSTOMER,
        totalExact: null,
        currencyCode: null,
      }).customerName,
    ).toBe('شرکت پارس');
  });

  it('renders the exact amount with Persian grouping and the rial unit', () => {
    const display = buildQuotationListDisplay({
      quotationNumber: null,
      customer: PERSON_CUSTOMER,
      totalExact: '2305350.000000',
      currencyCode: 'IRR',
    });

    // 2305350.000000 must read as ۲٬۳۰۵٬۳۵۰ ریال — never with six decimals.
    expect(display.totalDisplay).toBe('۲٬۳۰۵٬۳۵۰ ریال');
  });

  it('keeps real fraction digits and never rounds them away', () => {
    expect(
      buildQuotationTotalDisplay({
        totalExact: '1234.500000',
        currencyCode: 'IRR',
      }),
    ).toBe('۱٬۲۳۴٫۵ ریال');
  });

  it('leaves the amount empty when there is no computed total', () => {
    expect(
      buildQuotationTotalDisplay({ totalExact: null, currencyCode: 'IRR' }),
    ).toBeNull();
  });
});
