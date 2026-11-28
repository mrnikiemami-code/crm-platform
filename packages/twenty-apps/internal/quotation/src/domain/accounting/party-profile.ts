// Canonical vendor-neutral customer attributes: unavailable values are optional,
 // never manufactured, and never permission to erase an existing CRM value.
export const PARTY_PROFILE_FIELDS = ["partyType","firstName","lastName","companyName","tradeName","legalNationalId","economicCode","registrationNumber","crmCustomerCode","accountingCode","generalLedgerCode","subsidiaryLedgerCode","detailLedgerCode","accountGroup","firstPhone","secondPhone","fax","email","address","postalCode","country","state","city","contactName","paymentTermsCode","settlementDays","creditLimitExact","creditLimitCurrency","isActive"] as const;
export type PartyProfileField = (typeof PARTY_PROFILE_FIELDS)[number];
export type PartyKind = 'PERSON' | 'COMPANY';
// Source-owned observation; never a writable CRM identity or a ledger balance.
// The account-nature code must not be interpreted as a person's gender/type.
export type RemotePartyObservation = {
  version: '1';
  parentId?: string;
  accountNatureCode?: number;
  accountNatureLabel?: string;
  priceListId?: string;
  representativeId?: string;
  representativePercent?: number;
};

export type AccountingPartyProfile = {
  sourceObservation?: RemotePartyObservation;
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
  // Keep the source observations scoped to the accounting link. Do not
  // promote them to CRM customer fields, and never serialize balance/credit
  // data from an unrestricted customer catalog.
  const previousObservation = previous ? (JSON.parse(previous) as Record<string, unknown>).sourceObservation : null;
  const candidate = profile.sourceObservation;
  const observation: RemotePartyObservation = { version: '1' };
  for (const source of [previousObservation, candidate]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    const value = source as Record<string, unknown>;
    if (value.version !== '1') continue;
    for (const key of ['parentId', 'priceListId', 'representativeId'] as const) {
      const field = value[key];
      if (typeof field === 'string' && /^(0|[1-9]\d*)$/.test(field)) observation[key] = field;
    }
    if (typeof value.accountNatureCode === 'number' && Number.isInteger(value.accountNatureCode) &&
        value.accountNatureCode >= 0 && value.accountNatureCode <= 255) observation.accountNatureCode = value.accountNatureCode;
    if (typeof value.accountNatureLabel === 'string' && value.accountNatureLabel.trim()) observation.accountNatureLabel = value.accountNatureLabel.trim();
    if (typeof value.representativePercent === 'number' && Number.isFinite(value.representativePercent)) {
      observation.representativePercent = value.representativePercent;
    }
  }
  const merged = { ...result, ...(Object.keys(observation).length > 1 ? { sourceObservation: observation } : {}) };
  return Object.keys(merged).length === 0 ? null : JSON.stringify(merged);
};
