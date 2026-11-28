import { describe, expect, it } from 'vitest';
import { compareQuotationReport } from 'src/domain/accounting/quotation-reconciliation';
import { type AsanFactorViewModel } from 'src/domain/accounting/adapters/asan/asan-factor';
import { type RemoteProformaObservation } from 'src/domain/accounting/adapter-contract';

const payload: AsanFactorViewModel = {
  UserID: 7, CustomerID: 42, FactorDate: 14050907, VisitorID: 0,
  FactorNumber: 0, Description: 'پیش‌فاکتور [CRM:fixture]',
  FactorDetails: [
    { ProductID: 18, Count: 2, StorageID: 0, Price: 100 },
    { ProductID: 18, Count: 1, StorageID: 0, Price: 45 },
  ],
};
const observed: RemoteProformaObservation = {
  externalDocumentId: '17', customerExternalId: '42', description: payload.Description,
  rows: [
    { externalItemId: '18', quantity: 1, storageId: '0', observedPrice: 45 },
    { externalItemId: '18', quantity: 2, storageId: '0', observedPrice: 100 },
  ],
};
const compare = (report: RemoteProformaObservation[], acknowledgedDocumentId: string | null = '17') =>
  compareQuotationReport({ payload, report, acknowledgedDocumentId });

describe('bounded Asan reconciliation observations', () => {
  it('never authorizes replay when the document is not in the recent report', () => {
    expect(compare([])).toMatchObject({ status: 'IDENTITY_NOT_OBSERVED', replayAllowed: false, fiscalConfirmed: false });
  });
  it('refuses conflicting identity and multiple correlation matches', () => {
    expect(compare([{ ...observed, customerExternalId: '43' }]).status).toBe('IDENTITY_CONFLICT');
    expect(compare([observed, { ...observed, externalDocumentId: '18' }], null).status).toBe('IDENTITY_CONFLICT');
  });
  it('preserves repeated product rows and verifies details independent of report order', () => {
    expect(compare([observed])).toMatchObject({ status: 'DETAILS_OBSERVED', priceFieldsEqual: true, replayAllowed: false, fiscalConfirmed: false });
    expect(compare([{ ...observed, rows: observed.rows.slice(0, 1) }]).status).toBe('DETAIL_MISMATCH');
  });
  it('keeps price comparison separate from unverified fiscal semantics', () => {
    const rows = [{ ...observed.rows[0], observedPrice: 46 }, observed.rows[1]];
    expect(compare([{ ...observed, rows }])).toMatchObject({ status: 'DETAILS_OBSERVED', priceFieldsEqual: false, fiscalConfirmed: false });
  });
});
