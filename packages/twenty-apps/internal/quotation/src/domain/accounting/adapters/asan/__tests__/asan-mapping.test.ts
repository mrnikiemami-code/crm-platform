import { describe, expect, it } from 'vitest';

import { ASAN_CAPABILITIES, ASAN_SPECIAL_ITEM_CODES } from 'src/domain/accounting/adapters/asan/asan-capabilities';
import {
  ASAN_AUTO_FACTOR_NUMBER,
  MICROS_PER_ASAN_UNIT,
  mapRevisionToAsanFactor,
  validateAsanDocumentPayable,
  microsToAsanMoney,
  scaledQuantityToAsanCount,
  type AsanMappingInput,
} from 'src/domain/accounting/adapters/asan/asan-factor';
import {
  classifyAsanResponse,
  isAsanItemCodeLengthValid,
  shouldSendOriginalPrice,
} from 'src/domain/accounting/adapters/asan/asan-response';
import {
  formatJalaliCompact,
  readAsanDate,
  toAsanFactorDate,
  toJalali,
} from 'src/domain/accounting/adapters/asan/jalali';
import { type QuotationRevisionSnapshot } from 'src/domain/quotation/revision';

const unwrap = <TValue>(
  result: { ok: true; value: TValue } | { ok: false; refusal: { code: string } },
): TValue => {
  if (!result.ok) {
    throw new Error(`expected success, got ${result.refusal.code}`);
  }

  return result.value;
};

const refusalCodeOf = (result: {
  ok: boolean;
  refusal?: { code: string };
}): string => (result.ok ? 'NO_REFUSAL' : (result.refusal?.code ?? 'NONE'));

// One unit at 4,400,000 rial net, 9% VAT on the discounted amount.
// Amounts are canonical integer micros, the representation emitted by Nest.
const revision = (
  overrides: Partial<QuotationRevisionSnapshot> = {},
): QuotationRevisionSnapshot => ({
  quotationId: 'q-1',
  version: 1,
  quotationNumber: 'QT-1403-000123',
  currencyCode: 'IRR',
  customerRef: 'company-9',
  taxPolicy: 'IR_VAT_9',
  taxRateBasisPoints: '900',
  paymentTerms: null,
  lines: [
    {
      lineId: 'line-1',
      description: 'خدمت مشاوره',
      unit: 'ساعت',
      quantityScaled: '1000000',
      unitPriceMicros: '4400000000000',
      discountMicros: '0',
      taxMicros: '396000000000',
      totalMicros: '4796000000000',
    },
  ],
  totals: {
    grossMicros: '4400000000000',
    discountMicros: '0',
    netMicros: '4400000000000',
    taxMicros: '396000000000',
    totalMicros: '4796000000000',
  },
  issuedAt: '2025-12-22T10:00:00.000Z',
  ...overrides,
});

const mappingInput = (
  overrides: Partial<AsanMappingInput> = {},
): AsanMappingInput => ({
  revision: revision(),
  customerCode: 101,
  userId: 1,
  productCodeByLineId: { 'line-1': 1024 },
  specialCodesInUse: { discount: false, duty: false, tax: false },
  description: 'پیش‌فاکتور آزمون',
  ...overrides,
});

describe('Jalali dates', () => {
  it('converts the one example the API guide gives', () => {
    // The guide states FactorDate 14041001 means 1404-10-01, i.e. 2025-12-22.
    expect(formatJalaliCompact(unwrap(toJalali('2025-12-22')))).toBe('14041001');
  });

  it('produces the 8-digit compact integer Asan expects', () => {
    expect(unwrap(toAsanFactorDate('2025-12-22'))).toBe(14_041_001);
  });

  it('zero-pads a single-digit month and day', () => {
    expect(formatJalaliCompact({ year: 1404, month: 1, day: 1 })).toBe('14040101');
  });

  it('refuses a Gregorian date that does not exist instead of rolling it forward', () => {
    // Date would silently make this 2026-03-02; a document dated a day later than requested
    // is a real problem on an invoice.
    expect(refusalCodeOf(toJalali('2026-02-30'))).toBe('DATE_NOT_A_CALENDAR_DAY');
  });

  it('refuses a timestamp or a non-ISO string', () => {
    expect(toJalali('2025-12-22T10:00:00Z').ok).toBe(false);
    expect(toJalali('22/12/2025').ok).toBe(false);
    expect(toJalali('').ok).toBe(false);
  });

  it('offers both readings of a date read back from Asan', () => {
    // The guide does not state whether a read returns Jalali or Gregorian, so neither is
    // assumed: the caller gets both readings and must decide.
    const readings = readAsanDate(14_041_001);

    expect(readings.map((reading) => reading.kind)).toContain('JALALI');
    expect(readings.map((reading) => reading.kind)).toContain('GREGORIAN');
  });

  it('does not pretend to understand a value that is not 8 digits', () => {
    expect(readAsanDate(1_404)[0].kind).toBe('UNRECOGNISED');
  });
});

describe('line amount mapping', () => {
  it('sends the line TOTAL in Price, not the unit price', () => {
    // The guide: Price is the whole line amount after discount and Asan derives the unit
    // figure as Price / Count. Sending the unit price here would multiply the invoice by the
    // quantity a second time.
    const factor = unwrap(mapRevisionToAsanFactor(mappingInput()));
    const detail = factor.FactorDetails[0];

    // Net of tax: 4,796,000,000 - 396,000,000 = 4,400,000,000 micros = 4,400,000 rial.
    expect(detail.Price).toBe(4_400_000);
    expect(detail.Price).not.toBe(4_400_000_000);
  });

  it('multiplies out a multi-unit line into a total', () => {
    const input = mappingInput({
      revision: revision({
        lines: [
          {
            lineId: 'line-1',
            description: 'کابل',
            unit: 'عدد',
            quantityScaled: '3000000',
            unitPriceMicros: '1000000000000',
            discountMicros: '0',
            taxMicros: '0',
            totalMicros: '3000000000000',
          },
        ],
      }),
    });

    const detail = unwrap(mapRevisionToAsanFactor(input)).FactorDetails[0];

    // 3 units at 1,000,000 rial = 3,000,000 rial for the line.
    expect(detail.Count).toBe(3);
    expect(detail.Price).toBe(3_000_000);
  });

  it('converts a six-decimal quantity into the double Asan takes', () => {
    expect(unwrap(scaledQuantityToAsanCount(1_500_000n))).toBe(1.5);
    expect(unwrap(scaledQuantityToAsanCount(1n))).toBe(0.000001);
    expect(unwrap(scaledQuantityToAsanCount(3_000_000n))).toBe(3);
  });

  it('refuses a fractional rial rather than rounding the price', () => {
    expect(refusalCodeOf(microsToAsanMoney(1_500_000n))).toBe(
      'AMOUNT_NOT_WHOLE_UNIT',
    );
    expect(unwrap(microsToAsanMoney(2_000_000n))).toBe(2);
  });

  it('refuses a line with no linked product code', () => {
    const input = mappingInput({ productCodeByLineId: {} });

    expect(refusalCodeOf(mapRevisionToAsanFactor(input))).toBe(
      'LINE_HAS_NO_ASAN_PRODUCT',
    );
  });

  it('never sends a caller-assigned factor number', () => {
    // Asan auto-numbers, and its numbering is what an accountant reconciles. A non-zero value
    // would disable that.
    expect(unwrap(mapRevisionToAsanFactor(mappingInput())).FactorNumber).toBe(
      ASAN_AUTO_FACTOR_NUMBER,
    );
  });

  it('carries the resolved customer code and user id, never the CRM id', () => {
    const factor = unwrap(
      mapRevisionToAsanFactor(mappingInput({ customerCode: 801001, userId: 7 })),
    );

    expect(factor.CustomerID).toBe(801001);
    expect(factor.UserID).toBe(7);
  });
});

describe('discount and tax special codes', () => {
  const discountedRevision = revision({
    lines: [
      {
        lineId: 'line-1',
        description: 'کابل',
        unit: 'عدد',
        quantityScaled: '1000000',
        unitPriceMicros: '10000000000000',
        // 10,000,000 rial gross, 1,000,000 discount, 810,000 VAT on the 9,000,000 net.
        discountMicros: '1000000000000',
        taxMicros: '810000000000',
        totalMicros: '9810000000000',
      },
    ],
    // The special lines read the document totals, so the fixture has to state the same
    // document an issued revision would: a line figure alone is not the authority.
    totals: {
      grossMicros: '10000000000000',
      discountMicros: '1000000000000',
      netMicros: '9000000000000',
      taxMicros: '810000000000',
      totalMicros: '9810000000000',
    },
  });

  it('appends discount and tax as separate Count=0 lines when configured', () => {
    const factor = unwrap(
      mapRevisionToAsanFactor(
        mappingInput({
          revision: discountedRevision,
          specialCodesInUse: { discount: true, duty: false, tax: true },
        }),
      ),
    );

    const specials = factor.FactorDetails.filter((detail) => detail.Count === 0);

    expect(specials).toHaveLength(2);
    expect(specials.map((detail) => detail.ProductID)).toEqual([
      Number(ASAN_SPECIAL_ITEM_CODES.discount),
      Number(ASAN_SPECIAL_ITEM_CODES.tax),
    ]);
    expect(specials.map((detail) => detail.Price)).toEqual([1_000_000, 810_000]);
    // Separate discount must be subtracted once from gross, not net.
    expect(factor.FactorDetails[0].Price).toBe(10_000_000);
    expect(factor.FactorDetails[0].Price - specials[0].Price + specials[1].Price).toBe(9_810_000);
    expect(validateAsanDocumentPayable({ factor, revision: discountedRevision, moneyUnit: 'RIAL' }).ok).toBe(true);
    const wrong = { ...factor, FactorDetails: [{ ...factor.FactorDetails[0], Price: 9_000_000 }, ...factor.FactorDetails.slice(1)] };
    expect(refusalCodeOf(validateAsanDocumentPayable({ factor: wrong, revision: discountedRevision, moneyUnit: 'RIAL' }))).toBe('ASAN_DOCUMENT_TOTAL_MISMATCH');
    expect(refusalCodeOf(validateAsanDocumentPayable({ factor, revision: { ...discountedRevision, totals: { ...discountedRevision.totals, totalMicros: '9810001000000' } }, moneyUnit: 'RIAL' }))).toBe('ASAN_DOCUMENT_TOTAL_MISMATCH');
  });

  it('does not append a special line when the installation lacks the code', () => {
    const factor = unwrap(
      mapRevisionToAsanFactor(
        mappingInput({ revision: discountedRevision }),
      ),
    );

    expect(factor.FactorDetails).toHaveLength(1);
    expect(factor.FactorDetails.every((detail) => detail.Count > 0)).toBe(true);
  });

  it('does not append a zero-value special line', () => {
    const factor = unwrap(
      mapRevisionToAsanFactor(
        mappingInput({ specialCodesInUse: { discount: true, duty: true, tax: true } }),
      ),
    );

    // The fixture's tax is non-zero, so the tax line appears; discount is zero and must not.
    expect(
      factor.FactorDetails.filter(
        (detail) => detail.ProductID === Number(ASAN_SPECIAL_ITEM_CODES.discount),
      ),
    ).toHaveLength(0);
    expect(
      factor.FactorDetails.filter(
        (detail) => detail.ProductID === Number(ASAN_SPECIAL_ITEM_CODES.tax),
      ),
    ).toHaveLength(1);
  });

  // One policy, two internal components. The sealed snapshot keeps tax and duty apart, and
  // the destination's own contract decides whether it receives them as separate rows or as
  // the single combined figure its policy code stands for.
  describe('a 9% policy split into 6% tax and 3% duty', () => {
    const splitRevision = revision({
      lines: [
        {
          lineId: 'line-1',
          description: 'خدمت مشاوره',
          unit: 'ساعت',
          quantityScaled: '1000000',
          unitPriceMicros: '1000000000000',
          discountMicros: '0',
          taxMicros: '90000000000',
          totalMicros: '1090000000000',
        },
      ],
      totals: {
        grossMicros: '1000000000000',
        discountMicros: '0',
        netMicros: '1000000000000',
        taxMicros: '90000000000',
        dutyMicros: '30000000000',
        totalMicros: '1090000000000',
      },
    });

    const specialsOf = (input: Partial<AsanMappingInput>) => {
      const factor = unwrap(
        mapRevisionToAsanFactor(
          mappingInput({
            revision: splitRevision,
            specialCodesInUse: { discount: false, duty: true, tax: true },
            ...input,
          }),
        ),
      );

      return factor.FactorDetails.filter((detail) => detail.Count === 0);
    };

    it('sends duty and tax as two rows with their own amounts', () => {
      const specials = specialsOf({ dutyHandling: 'DUTY_AMOUNT' });

      expect(specials.map((detail) => detail.ProductID)).toEqual([
        Number(ASAN_SPECIAL_ITEM_CODES.duty),
        Number(ASAN_SPECIAL_ITEM_CODES.tax),
      ]);
      expect(specials.map((detail) => detail.Price)).toEqual([30_000, 60_000]);
    });

    it('keeps the product line free of both components', () => {
      const factor = unwrap(
        mapRevisionToAsanFactor(
          mappingInput({
            revision: splitRevision,
            specialCodesInUse: { discount: false, duty: true, tax: true },
            dutyHandling: 'DUTY_AMOUNT',
          }),
        ),
      );

      expect(factor.FactorDetails[0].Price).toBe(1_000_000);
    });

    it('sends one tax row carrying the whole policy when that is the contract', () => {
      const specials = specialsOf({ dutyHandling: 'DUTY_WITHIN_POLICY' });

      expect(specials.map((detail) => detail.ProductID)).toEqual([
        Number(ASAN_SPECIAL_ITEM_CODES.tax),
      ]);
      expect(specials[0].Price).toBe(90_000);
    });

    it('uses the row codes this installation numbered, not a hardcoded default', () => {
      const specials = specialsOf({
        dutyHandling: 'DUTY_AMOUNT',
        specialItemCodes: { duty: '880002', tax: '880001' },
      });

      expect(specials.map((detail) => detail.ProductID)).toEqual([880002, 880001]);
    });
  });

  it('uses the documented special codes', () => {
    expect(ASAN_SPECIAL_ITEM_CODES.discount).toBe('999123');
    expect(ASAN_SPECIAL_ITEM_CODES.duty).toBe('999140');
    expect(ASAN_SPECIAL_ITEM_CODES.tax).toBe('999141');
  });

  it('never sends OriginalPrice, which is what triggers -369', () => {
    expect(shouldSendOriginalPrice()).toBe(false);
    // And the validation Asan applies, stated so the reason is checkable.
    expect(isAsanItemCodeLengthValid('999123')).toBe(true);
    expect(isAsanItemCodeLengthValid('1024')).toBe(false);
    expect(isAsanItemCodeLengthValid('102')).toBe(true);
  });
});

describe('Asan response codes', () => {
  it('reads a positive integer as the registered document number', () => {
    expect(
      classifyAsanResponse({ operation: 'REGISTER_PROFORMA', rawCode: 152 }),
    ).toEqual({ kind: 'DOCUMENT_REGISTERED', documentNumber: 152 });
  });

  it('treats ZERO as a failure, not as a falsy success', () => {
    const classification = classifyAsanResponse({
      operation: 'REGISTER_PROFORMA',
      rawCode: 0,
    });

    expect(classification.kind).toBe('FAILED');
    expect(
      classification.kind === 'FAILED' ? classification.reason : '',
    ).toBe('DOCUMENT_NOT_REGISTERED');
  });

  it('refuses to retry a zero-result registration without reconciliation', () => {
    // A 0 covers both "customer missing" and an unnamed failure, so the document may exist.
    const classification = classifyAsanResponse({
      operation: 'REGISTER_PROFORMA',
      rawCode: 0,
    });

    expect(classification.kind === 'FAILED' ? classification.retrySafe : true).toBe(
      false,
    );
  });

  it('classifies -369 as a validation error that is safe to retry after fixing codes', () => {
    const classification = classifyAsanResponse({
      operation: 'REGISTER_PROFORMA',
      rawCode: -369,
    });

    expect(classification).toMatchObject({
      kind: 'FAILED',
      reason: 'ORIGINAL_PRICE_ITEM_CODE_INVALID',
      retrySafe: true,
    });
  });

  it('treats a customer write result as a flag, never as an identifier', () => {
    const created = classifyAsanResponse({
      operation: 'CREATE_CUSTOMER',
      rawCode: 1,
    });

    // This is why the capability declares returnsAssignedCode: false — storing "1" as a
    // PersonCode would point every new customer at the same account.
    expect(created.kind).toBe('SUCCEEDED_WITHOUT_IDENTIFIER');
  });

  it('classifies the two documented customer refusals', () => {
    expect(
      classifyAsanResponse({ operation: 'UPDATE_CUSTOMER', rawCode: -10 }),
    ).toMatchObject({ kind: 'FAILED', reason: 'CUSTOMER_LEADING_CODE_IGNORED' });
    expect(
      classifyAsanResponse({ operation: 'CREATE_CUSTOMER', rawCode: -1 }),
    ).toMatchObject({ kind: 'FAILED', reason: 'CUSTOMER_GROUP_FULL' });
  });

  it('accepts a numeric string, because proxies quote numbers', () => {
    expect(
      classifyAsanResponse({ operation: 'REGISTER_PROFORMA', rawCode: '152' }),
    ).toEqual({ kind: 'DOCUMENT_REGISTERED', documentNumber: 152 });
  });

  it('refuses customer zero, fractional and blank responses', () => {
    for (const code of [0, 1.5, '', ' ', '1e2', 2147483648]) {
      expect(classifyAsanResponse({ operation: 'CREATE_CUSTOMER', rawCode: code }).kind).not.toBe('SUCCEEDED_WITHOUT_IDENTIFIER');
    }
  });
  it('reports an undocumented code instead of guessing its meaning', () => {
    expect(
      classifyAsanResponse({ operation: 'REGISTER_PROFORMA', rawCode: -42 }).kind,
    ).toBe('UNEXPECTED');
    expect(
      classifyAsanResponse({ operation: 'REGISTER_PROFORMA', rawCode: null }).kind,
    ).toBe('UNEXPECTED');
  });
});

describe('Asan capabilities', () => {
  it('declares price-only item edits', () => {
    expect(ASAN_CAPABILITIES.items.updateFields).toBe('PRICE_ONLY');
  });

  it('declares no item delete', () => {
    expect(ASAN_CAPABILITIES.items.delete).toBe(false);
  });

  it('declares that a party create does not return the assigned code', () => {
    expect(ASAN_CAPABILITIES.parties.create).toBe(true);
    expect(ASAN_CAPABILITIES.parties.returnsAssignedCode).toBe(false);
  });

  it('declares pro-forma creation but not the posted invoice path as safe', () => {
    expect(ASAN_CAPABILITIES.documents.createProforma).toBe(true);
    expect(ASAN_CAPABILITIES.documents.readById).toBe(false);
    expect(ASAN_CAPABILITIES.documents.cancelDocument).toBe(false);
  });

  it('never claims remote idempotency', () => {
    expect(ASAN_CAPABILITIES.documents.remoteIdempotency).toBe(false);
  });

  it('declares the transport insecure', () => {
    expect(ASAN_CAPABILITIES.transportIsSecure).toBe(false);
  });
});

describe('money scale', () => {
  it('uses a million micros per Asan unit', () => {
    expect(MICROS_PER_ASAN_UNIT).toBe(1_000_000n);
  });
});

describe('real Nest revision encoding', () => {
  it('maps the actual 53273 rial payable scale without a second multiplication', () => {
    const r = revision({
      lines: [{ lineId: 'line-1', description: 'کالا', unit: 'عدد', quantityScaled: '1000000',
        unitPriceMicros: '53273000000', discountMicros: '0', taxMicros: '0', totalMicros: '53273000000' }],
      totals: { grossMicros: '53273000000', discountMicros: '0', netMicros: '53273000000',
        taxMicros: '0', totalMicros: '53273000000' },
    });
    const factor = unwrap(mapRevisionToAsanFactor(mappingInput({ revision: r })));
    expect(factor.FactorDetails[0].Price).toBe(53273);
    expect(validateAsanDocumentPayable({ factor, revision: r, moneyUnit: 'RIAL' }).ok).toBe(true);
  });

  it('rejects draft decimal strings in an issued revision rather than guessing its encoding', () => {
    const r = revision();
    const invalid = { ...r, lines: [{ ...r.lines[0], totalMicros: '4796000.000000' }] };
    expect(refusalCodeOf(mapRevisionToAsanFactor(mappingInput({ revision: invalid })))).toBe('AMOUNT_NOT_A_DECIMAL');
  });
});
