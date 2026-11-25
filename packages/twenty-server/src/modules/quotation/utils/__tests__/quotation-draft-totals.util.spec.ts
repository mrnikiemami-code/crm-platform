import {
  evaluateQuotationDraftTotals,
  isExactAmountText,
  parseExactAmountToMicros,
} from 'src/modules/quotation/utils/quotation-draft-totals.util';
import {
  type QuotationDraftSaveHeader,
  type QuotationDraftSaveLine,
} from 'src/modules/quotation/types/quotation-draft-save.type';

const line = (
  overrides: Partial<QuotationDraftSaveLine> = {},
): QuotationDraftSaveLine => ({
  name: 'کالا',
  kind: 'PRODUCT',
  description: null,
  unit: 'عدد',
  quantityExact: '1.000000',
  unitPriceExact: '1000.000000',
  grossExact: '1000.000000',
  discountExact: '0.000000',
  discountKind: 'NONE',
  discountInputExact: '0.000000',
  documentDiscountExact: '0.000000',
  taxExact: '90.000000',
  totalExact: '1090.000000',
  itemId: null,
  ...overrides,
});

const header = (
  overrides: Partial<QuotationDraftSaveHeader> = {},
): QuotationDraftSaveHeader => ({
  name: 'پیش‌فاکتور',
  customerType: 'COMPANY',
  personId: null,
  companyId: 'company-1',
  currencyCode: 'IRR',
  taxPolicy: 'IR_VAT_9',
  taxRateBasisPoints: null,
  paymentTerms: null,
  documentDiscountKind: 'NONE',
  documentDiscountInputExact: '0.000000',
  grossExact: '3000.000000',
  lineDiscountExact: '200.000000',
  documentDiscountExact: '0.000000',
  netExact: '2800.000000',
  taxExact: '252.000000',
  roundingExact: '0.000000',
  totalExact: '3052.000000',
  ...overrides,
});

const secondLine = line({
  name: 'خدمت',
  kind: 'SERVICE',
  unit: 'ساعت',
  unitPriceExact: '2000.000000',
  grossExact: '2000.000000',
  discountExact: '200.000000',
  discountKind: 'RATE',
  discountInputExact: '10.000000',
  taxExact: '162.000000',
  totalExact: '1962.000000',
});

describe('quotation-draft-totals.util', () => {
  it('accepts a plan whose lines add up to the header', () => {
    expect(
      evaluateQuotationDraftTotals({
        header: header(),
        lines: [line(), secondLine],
      }),
    ).toEqual({ ok: true });
  });

  it('accepts a whole-rial payable that carries floor rounding', () => {
    expect(
      evaluateQuotationDraftTotals({
        header: header({
          taxExact: '252.400000',
          roundingExact: '-0.400000',
          totalExact: '3052.000000',
        }),
        lines: [
          line({ taxExact: '90.400000', totalExact: '1090.400000' }),
          secondLine,
        ],
      }),
    ).toEqual({ ok: true });
  });

  it('accepts named step 100 floor and refuses silent zero', () => {
    expect(
      evaluateQuotationDraftTotals({
        header: header({
          netExact: '10025.000000',
          taxExact: '0.000000',
          grossExact: '10025.000000',
          lineDiscountExact: '0.000000',
          roundingExact: '-25.000000',
          totalExact: '10000.000000',
          roundingStepRials: '100',
          preRoundTotalExact: '10025.000000',
        }),
        lines: [
          line({
            grossExact: '10025.000000',
            unitPriceExact: '10025.000000',
            taxExact: '0.000000',
            totalExact: '10025.000000',
          }),
        ],
      }),
    ).toEqual({ ok: true });

    const zeroed = evaluateQuotationDraftTotals({
      header: header({
        netExact: '50.000000',
        taxExact: '0.000000',
        grossExact: '50.000000',
        lineDiscountExact: '0.000000',
        roundingExact: '-50.000000',
        totalExact: '0.000000',
        roundingStepRials: '100',
      }),
      lines: [
        line({
          grossExact: '50.000000',
          unitPriceExact: '50.000000',
          taxExact: '0.000000',
          totalExact: '50.000000',
        }),
      ],
    });

    expect(zeroed.ok).toBe(false);
    if (!zeroed.ok) {
      expect(zeroed.code).toBe('PAYABLE_ROUNDED_TO_ZERO');
    }
  });

  it('rejects a line total that is off by one micro', () => {
    const decision = evaluateQuotationDraftTotals({
      header: header({ totalExact: '3051.999999', netExact: '2799.999999' }),
      lines: [line(), secondLine],
    });

    expect(decision.ok).toBe(false);
    if (decision.ok) {
      return;
    }

    expect(decision.code).toBe('TOTALS_INCONSISTENT');
  });

  it('rejects a line whose fields do not match the header', () => {
    const decision = evaluateQuotationDraftTotals({
      header: header(),
      lines: [line({ discountExact: '1.000000' }), secondLine],
    });

    expect(decision.ok).toBe(false);
    if (decision.ok) {
      return;
    }

    expect(decision.code).toBe('TOTALS_INCONSISTENT');
  });

  it('rejects a payable that is not a whole rial', () => {
    const decision = evaluateQuotationDraftTotals({
      header: header({
        netExact: '2800.000000',
        taxExact: '252.500000',
        roundingExact: '0.000000',
        totalExact: '3052.500000',
      }),
      lines: [
        line({ taxExact: '90.500000', totalExact: '1090.500000' }),
        secondLine,
      ],
    });

    expect(decision.ok).toBe(false);
    if (decision.ok) {
      return;
    }

    expect(decision.code).toBe('TOTALS_INCONSISTENT');
    expect(decision.message).toContain('whole rial');
  });

  it('rejects a non-decimal amount before doing arithmetic', () => {
    const decision = evaluateQuotationDraftTotals({
      header: header({ totalExact: '3052.0000000' }),
      lines: [line(), secondLine],
    });

    expect(decision.ok).toBe(false);
    if (decision.ok) {
      return;
    }

    expect(decision.code).toBe('INVALID_EXACT_AMOUNT');
  });

  it('rejects a plan with no lines', () => {
    expect(evaluateQuotationDraftTotals({ header: header(), lines: [] })).toEqual(
      {
        ok: false,
        code: 'DOCUMENT_HAS_NO_LINES',
        message: 'a quotation needs at least one line',
      },
    );
  });

  it('accepts independent per-line tax and duty rates after document discount', () => {
    // Mirrors money-domain WS3 fixture: nets 810000 / 900000 after discounts;
    // line A 9% tax; line B 6% tax + 3% duty.
    expect(
      evaluateQuotationDraftTotals({
        header: header({
          taxRateBasisPoints: '900',
          dutyRateBasisPoints: '0',
          grossExact: '2000000.000000',
          lineDiscountExact: '100000.000000',
          documentDiscountExact: '190000.000000',
          netExact: '1710000.000000',
          taxExact: '153900.000000',
          dutyExact: '27000.000000',
          roundingExact: '0.000000',
          totalExact: '1863900.000000',
        }),
        lines: [
          line({
            unitPriceExact: '1000000.000000',
            grossExact: '1000000.000000',
            discountExact: '100000.000000',
            discountKind: 'RATE',
            discountInputExact: '10.000000',
            documentDiscountExact: '90000.000000',
            taxExact: '72900.000000',
            totalExact: '882900.000000',
            taxPolicy: 'IR_VAT_9',
            taxRateBasisPoints: '900',
            dutyRateBasisPoints: '0',
          }),
          line({
            name: 'خدمت',
            kind: 'SERVICE',
            unit: 'ساعت',
            unitPriceExact: '1000000.000000',
            grossExact: '1000000.000000',
            discountExact: '0.000000',
            documentDiscountExact: '100000.000000',
            taxExact: '81000.000000',
            totalExact: '981000.000000',
            taxPolicy: 'SPLIT_6_3',
            taxRateBasisPoints: '600',
            dutyRateBasisPoints: '300',
          }),
        ],
      }),
    ).toEqual({ ok: true });
  });

  it('parses exact text without floating point drift', () => {
    expect(parseExactAmountToMicros('0.000001')).toBe(BigInt(1));
    expect(parseExactAmountToMicros('3052.000000')).toBe(BigInt(3052000000));
    expect(parseExactAmountToMicros('12')).toBe(BigInt(12000000));
    expect(parseExactAmountToMicros('-1.500000')).toBe(BigInt(-1500000));
    expect(parseExactAmountToMicros('1.5')).toBe(BigInt(1500000));
    expect(parseExactAmountToMicros('abc')).toBeNull();
    expect(isExactAmountText('1000.000000')).toBe(true);
    expect(isExactAmountText('1000,000000')).toBe(false);
  });
});
