// Canonical vendor-neutral customer attributes: unavailable values are optional,
 // never manufactured, and never permission to erase an existing CRM value.
export const PARTY_PROFILE_FIELDS = ["partyType","firstName","lastName","companyName","tradeName","legalNationalId","economicCode","registrationNumber","crmCustomerCode","accountingCode","generalLedgerCode","subsidiaryLedgerCode","detailLedgerCode","accountGroup","firstPhone","secondPhone","fax","email","address","postalCode","country","state","city","contactName","paymentTermsCode","settlementDays","creditLimitExact","creditLimitCurrency","isActive"] as const;
export type PartyProfileField = (typeof PARTY_PROFILE_FIELDS)[number];
export type PartyKind = 'PERSON' | 'COMPANY';
export type AccountingPartyProfile = {
  partyType?: PartyKind | 'UNKNOWN' | null;
  partyTypeEvidence?: 'VENDOR_EXPLICIT' | 'NATIONAL_ID_SHAPE' | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  tradeName?: string | null;
  legalNationalId?: string | null;
  economicCode?: string | null;
  registrationNumber?: string | null;
  crmCustomerCode?: string | null;
  accountingCode?: string | null;
  generalLedgerCode?: string | null;
  subsidiaryLedgerCode?: string | null;
  detailLedgerCode?: string | null;
  accountGroup?: string | null;
  firstPhone?: string | null;
  secondPhone?: string | null;
  fax?: string | null;
  email?: string | null;
  address?: string | null;
  postalCode?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  contactName?: string | null;
  paymentTermsCode?: string | null;
  creditLimitExact?: string | null;
  creditLimitCurrency?: string | null;
  settlementDays?: number | null;
  isActive?: boolean | null;
};
export type PartyFieldCapability = {
  contractVersion: '2';
  identity: 'CUSTOMER_CODE' | 'EXTERNAL_ID';
  readable: readonly (PartyProfileField | 'code' | 'fullName' | 'mobile' | 'nationalCode')[];
  writable: readonly (PartyProfileField | 'fullName' | 'mobile' | 'nationalCode')[];
};
// Connection-owned fields are not the CRM's own accounting code or fiscal balances.
const SOURCE_FIELDS = ['crmCustomerCode','accountingCode','generalLedgerCode','subsidiaryLedgerCode','detailLedgerCode','accountGroup','tradeName','contactName','paymentTermsCode','settlementDays','creditLimitExact','creditLimitCurrency','isActive'] as const;
export const mergeSourcePartyProfile = (profile: AccountingPartyProfile, previous: string | null | undefined): string | null => {
  const result: Record<string, string | number | boolean> = {};
  if (previous) {
    const parsed: unknown = JSON.parse(previous);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid stored source customer profile');
    for (const field of SOURCE_FIELDS) {
      const value = (parsed as Record<string, unknown>)[field];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') result[field] = value;
    }
  }
  for (const field of SOURCE_FIELDS) {
    const value = profile[field];
    if (typeof value === 'string' && value.trim() !== '') result[field] = value.trim();
    else if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) result[field] = value;
  }
  return Object.keys(result).length === 0 ? null : JSON.stringify(result);
};
