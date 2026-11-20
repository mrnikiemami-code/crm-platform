import {
  DRAFT_QUOTATION_NUMBER_LABEL,
  QUOTATION_NUMBER_WIDTH,
  buildQuotationSequenceScopeKey,
  formatQuotationNumber,
  formatQuotationNumberLabel,
  readSequenceWidth,
  resolveQuotationFiscalYear,
  toPersianDigits,
} from 'src/modules/quotation/utils/quotation-numbering.util';

describe('quotation-numbering.util', () => {
  it('resolves the Persian fiscal year for an instant in Tehran', () => {
    // 2026-11-20 falls in 1405, not in the Gregorian year of the same number.
    expect(resolveQuotationFiscalYear(new Date('2026-11-20T12:00:00Z'))).toBe(
      1405,
    );
  });

  it('refuses an unreadable issue date instead of guessing a year', () => {
    expect(resolveQuotationFiscalYear(new Date('not-a-date'))).toBeNull();
  });

  it('builds a scope key per document type and fiscal year', () => {
    expect(buildQuotationSequenceScopeKey(1405)).toBe('QUOTATION:1405');
  });

  it('formats a zero-padded number with prefix and fiscal year', () => {
    expect(formatQuotationNumber({ fiscalYear: 1405, sequence: 1 })).toBe(
      'QT-1405-000001',
    );
  });

  it('refuses a sequence that would not fit the width', () => {
    expect(
      formatQuotationNumber({
        fiscalYear: 1405,
        sequence: 1_000_001,
      }),
    ).toBeNull();
  });

  it('refuses non-positive and non-integer sequences', () => {
    expect(formatQuotationNumber({ fiscalYear: 1405, sequence: 0 })).toBeNull();
    expect(
      formatQuotationNumber({ fiscalYear: 1405, sequence: 2.5 }),
    ).toBeNull();
  });

  it('falls back to the default width when the stored value is unusable', () => {
    expect(readSequenceWidth(null)).toBe(QUOTATION_NUMBER_WIDTH);
    expect(readSequenceWidth(4)).toBe(4);
  });

  it('prints numbers in Persian and leaves drafts unlabelled', () => {
    expect(toPersianDigits('QT-1405-000001')).toBe('QT-۱۴۰۵-۰۰۰۰۰۱');
    expect(formatQuotationNumberLabel('QT-1405-000001')).toBe('QT-۱۴۰۵-۰۰۰۰۰۱');
    expect(formatQuotationNumberLabel(null)).toBeNull();
    expect(DRAFT_QUOTATION_NUMBER_LABEL).toBe('بدون شماره');
  });
});
