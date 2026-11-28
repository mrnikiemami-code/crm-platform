export type QuotationIssuerSnapshot = {
  issuerLegalName: string | null;
  issuerNationalId: string | null;
  issuerEconomicCode: string | null;
  issuerAddress: string | null;
  issuerPhone: string | null;
};

export type IssuerDefaultSource = Record<string, string | null | undefined>;

const readDefault = (source: IssuerDefaultSource, key: string): string | null => {
  const value = source[key];

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

// Fills empty issuer snapshot fields from workspace application-variable defaults.
export const mergeIssuerSnapshotWithDefaults = (
  snapshot: QuotationIssuerSnapshot,
  defaults: IssuerDefaultSource,
): QuotationIssuerSnapshot => ({
  issuerLegalName:
    snapshot.issuerLegalName ?? readDefault(defaults, 'QUOTATION_ISSUER_LEGAL_NAME'),
  issuerNationalId:
    snapshot.issuerNationalId ?? readDefault(defaults, 'QUOTATION_ISSUER_NATIONAL_ID'),
  issuerEconomicCode:
    snapshot.issuerEconomicCode ?? readDefault(defaults, 'QUOTATION_ISSUER_ECONOMIC_CODE'),
  issuerAddress:
    snapshot.issuerAddress ?? readDefault(defaults, 'QUOTATION_ISSUER_ADDRESS'),
  issuerPhone:
    snapshot.issuerPhone ?? readDefault(defaults, 'QUOTATION_ISSUER_PHONE'),
});