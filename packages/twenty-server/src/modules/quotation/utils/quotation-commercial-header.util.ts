import { type QuotationDraftSaveHeader } from 'src/modules/quotation/types/quotation-draft-save.type';
import { mergeIssuerFieldsWithEnvDefaults } from 'src/modules/quotation/utils/quotation-issuer-defaults.util';

export const commercialColumnsFromDraftHeader = (
  header: QuotationDraftSaveHeader,
): Record<string, unknown> => {
  const issuer = mergeIssuerFieldsWithEnvDefaults(header);

  return {
    expiresAt: header.expiresAt ?? null,
    paymentDueDate: header.paymentDueDate ?? null,
    deliveryTerms: header.deliveryTerms ?? null,
    documentNotes: header.documentNotes ?? null,
    issuerLegalName: issuer.issuerLegalName,
    issuerNationalId: issuer.issuerNationalId,
    issuerEconomicCode: issuer.issuerEconomicCode,
    issuerAddress: issuer.issuerAddress,
    issuerPhone: issuer.issuerPhone,
    visitorName: header.visitorName ?? null,
    selectedPriceListId: header.selectedPriceListId ?? null,
    selectedPriceListName: header.selectedPriceListName ?? null,
  };
};