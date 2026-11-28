import { type QuotationDraftSaveHeader } from 'src/modules/quotation/types/quotation-draft-save.type';

type IssuerFields = Pick<
  QuotationDraftSaveHeader,
  | 'issuerLegalName'
  | 'issuerNationalId'
  | 'issuerEconomicCode'
  | 'issuerAddress'
  | 'issuerPhone'
>;

const readEnvDefault = (key: string): string | null => {
  const value = process.env[key];

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

const coalesce = (
  provided: string | null | undefined,
  envKey: string,
): string | null => {
  const text = (provided ?? '').trim();

  if (text !== '') {
    return text;
  }

  return readEnvDefault(envKey);
};

// Nest atomic save mirrors LF issuer merge so direct REST drafts also receive
// workspace issuer defaults without inventing vendor identifiers.
export const mergeIssuerFieldsWithEnvDefaults = (
  header: IssuerFields,
): IssuerFields => ({
  issuerLegalName: coalesce(
    header.issuerLegalName,
    'QUOTATION_ISSUER_LEGAL_NAME',
  ),
  issuerNationalId: coalesce(
    header.issuerNationalId,
    'QUOTATION_ISSUER_NATIONAL_ID',
  ),
  issuerEconomicCode: coalesce(
    header.issuerEconomicCode,
    'QUOTATION_ISSUER_ECONOMIC_CODE',
  ),
  issuerAddress: coalesce(header.issuerAddress, 'QUOTATION_ISSUER_ADDRESS'),
  issuerPhone: coalesce(header.issuerPhone, 'QUOTATION_ISSUER_PHONE'),
});
