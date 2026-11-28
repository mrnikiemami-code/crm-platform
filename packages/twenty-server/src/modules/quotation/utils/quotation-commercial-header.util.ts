import { type QuotationDraftSaveHeader } from 'src/modules/quotation/types/quotation-draft-save.type';

export const commercialColumnsFromDraftHeader = (
  header: QuotationDraftSaveHeader,
): Record<string, unknown> => ({
  expiresAt: header.expiresAt ?? null,
  paymentDueDate: header.paymentDueDate ?? null,
  deliveryTerms: header.deliveryTerms ?? null,
  documentNotes: header.documentNotes ?? null,
  issuerLegalName: header.issuerLegalName ?? null,
  issuerNationalId: header.issuerNationalId ?? null,
  issuerEconomicCode: header.issuerEconomicCode ?? null,
  issuerAddress: header.issuerAddress ?? null,
  issuerPhone: header.issuerPhone ?? null,
  visitorName: header.visitorName ?? null,
  selectedPriceListId: header.selectedPriceListId ?? null,
  selectedPriceListName: header.selectedPriceListName ?? null,
});