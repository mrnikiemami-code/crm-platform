import { type RemoteProformaObservation } from 'src/domain/accounting/adapter-contract';
import { type AsanFactorViewModel } from 'src/domain/accounting/adapters/asan/asan-factor';

export type QuotationReconciliationObservation = {
  status: 'IDENTITY_NOT_OBSERVED' | 'IDENTITY_CONFLICT' | 'DETAIL_MISMATCH' | 'DETAILS_OBSERVED';
  externalDocumentId: string | null;
  // Price fields in LastPishFactors have not been certified against register
  // semantics. Even exact field equality does not certify posted payable.
  priceFieldsEqual: boolean | null;
  reportCount: number;
  fiscalConfirmed: false;
  replayAllowed: false;
};

export const compareQuotationReport = ({
  payload, report, acknowledgedDocumentId,
}: {
  payload: AsanFactorViewModel;
  report: RemoteProformaObservation[];
  acknowledgedDocumentId: string | null;
}): QuotationReconciliationObservation => {
  const result = (status: QuotationReconciliationObservation['status'], externalDocumentId: string | null = null,
    priceFieldsEqual: boolean | null = null): QuotationReconciliationObservation => ({
    status, externalDocumentId, priceFieldsEqual, reportCount: report.length,
    fiscalConfirmed: false, replayAllowed: false,
  });
  const candidates = report.filter(row => row.description === payload.Description ||
    (acknowledgedDocumentId !== null && row.externalDocumentId === acknowledgedDocumentId));
  if (candidates.length === 0) return result('IDENTITY_NOT_OBSERVED');
  if (candidates.length !== 1) return result('IDENTITY_CONFLICT');
  const row = candidates[0];
  if (row.description !== payload.Description || row.customerExternalId !== String(payload.CustomerID) ||
      (acknowledgedDocumentId !== null && row.externalDocumentId !== acknowledgedDocumentId) ||
      !/^[1-9]\d*$/.test(row.externalDocumentId)) return result('IDENTITY_CONFLICT');
  // Compare a multiset, preserving repeated product rows; never collapse by
  // product id or derive a price by assuming report semantics.
  const expectedIdentity = payload.FactorDetails.map(detail =>
    JSON.stringify([String(detail.ProductID), detail.Count, String(detail.StorageID)])).sort();
  const observedIdentity = row.rows.map(detail =>
    JSON.stringify([detail.externalItemId, detail.quantity, detail.storageId])).sort();
  if (JSON.stringify(expectedIdentity) !== JSON.stringify(observedIdentity)) return result('DETAIL_MISMATCH', row.externalDocumentId);
  const expectedAmounts = payload.FactorDetails.map(detail =>
    JSON.stringify([String(detail.ProductID), detail.Count, String(detail.StorageID), detail.Price])).sort();
  const observedAmounts = row.rows.map(detail =>
    JSON.stringify([detail.externalItemId, detail.quantity, detail.storageId, detail.observedPrice])).sort();
  return result('DETAILS_OBSERVED', row.externalDocumentId, JSON.stringify(expectedAmounts) === JSON.stringify(observedAmounts));
};
