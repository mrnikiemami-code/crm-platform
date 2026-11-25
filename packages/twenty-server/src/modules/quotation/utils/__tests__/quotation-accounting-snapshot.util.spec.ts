import {
  buildQuotationAccountingSnapshot,
  findClientAccountingSnapshotOverrides,
  isNonEmptyAccountingCodeSnapshot,
  stripAccountingSnapshotFields,
} from 'src/modules/quotation/utils/quotation-accounting-snapshot.util';

describe('quotation-accounting-snapshot.util', () => {
  it('normalizes empty and whitespace codes as empty snapshots', () => {
    expect(isNonEmptyAccountingCodeSnapshot('  ')).toBe(false);
    expect(isNonEmptyAccountingCodeSnapshot('GL-1')).toBe(true);
    expect(
      buildQuotationAccountingSnapshot({
        taxPolicyRecordId: ' tp-1 ',
        taxAccountingCode: ' TAX ',
        quotationCurrencyRecordId: null,
        currencyAccountingCode: '',
      }),
    ).toEqual({
      taxPolicyRecordId: 'tp-1',
      taxAccountingCode: 'TAX',
      quotationCurrencyRecordId: null,
      currencyAccountingCode: '',
    });
  });

  it('detects and strips client snapshot override keys', () => {
    expect(
      findClientAccountingSnapshotOverrides({
        taxAccountingCode: 'X',
        name: 'ok',
      }),
    ).toEqual(['taxAccountingCode']);
    expect(
      stripAccountingSnapshotFields({
        taxAccountingCode: 'X',
        currencyAccountingCode: 'Y',
        name: 'ok',
      }),
    ).toEqual({ name: 'ok' });
  });
});
