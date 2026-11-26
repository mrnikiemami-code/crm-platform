import { type AccountingPartyProfile, type PartyKind } from 'src/domain/accounting/party-profile';

// National identifiers are strings: leading zeroes are significant. Length determines
// the structural kind under the current adapter contract; it is not a civil-registry check.
export const asciiDigits = (value: string): string =>
  value.replace(/[۰-۹٠-٩]/g, (digit) =>
    String('۰۱۲۳۴۵۶۷۸۹'.includes(digit)
      ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)
      : '٠١٢٣٤٥٦٧٨٩'.indexOf(digit)),
  );

export const normalizeNationalCode = (value: string | null | undefined): string | null => {
  const normalized = asciiDigits(value ?? '').trim().replace(/[\s-]/g, '');
  return /^\d{10,11}$/.test(normalized) ? normalized : null;
};

export const partyTypeFromNationalCode = (value: string | null | undefined): 'PERSON' | 'COMPANY' | null => {
  const code = normalizeNationalCode(value);
  return code === null ? null : code.length === 10 ? 'PERSON' : 'COMPANY';
};

export const normalizePartyName = (value: string): string =>
  value.trim().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c]+/g, ' ').toLowerCase();

export const splitPartyPersonName = (value: string): { firstName: string; lastName: string } => {
  const parts = value.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
};

// Only a structurally valid Iranian mobile is promoted to the standard Person phones
// composite. Empty or invalid vendor values never erase existing CRM contact data.
export const normalizeIranMobile = (value: string | null | undefined): string | null => {
  const number = asciiDigits(value ?? '').trim().replace(/[\s()-]/g, '');
  const match = /^(?:\+98|0098|98|0)?(9\d{9})$/.exec(number);
  return match?.[1] ?? null;
};

export type PartyIdentityAttributes = AccountingPartyProfile & { nationalCode?: string | null; fullName: string; mobile?: string | null; externalPartyId?: string | null };

export const normalizeEconomicCode = (value: string | null | undefined): string | null => {
  const code = asciiDigits(value ?? '').trim().replace(/[\s-]/g, '');
  return /^\d{8,20}$/.test(code) && !/^0+$/.test(code) ? code : null;
};

export const partyNationalIdentity = (party: PartyIdentityAttributes): string | null =>
  normalizeNationalCode(party.legalNationalId) ?? normalizeNationalCode(party.nationalCode);

export const partyIdentityConflict = (party: PartyIdentityAttributes): boolean => {
  const personal = normalizeNationalCode(party.nationalCode);
  const legal = normalizeNationalCode(party.legalNationalId);
  const inferred = partyTypeFromNationalCode(legal ?? personal);
  return (legal !== null && legal.length !== 11) ||
    (personal !== null && legal !== null && personal !== legal) ||
    ((party.partyType === 'PERSON' || party.partyType === 'COMPANY') && inferred !== null && party.partyType !== inferred);
};

export const resolvePartyKind = (party: PartyIdentityAttributes): PartyKind | null =>
  partyIdentityConflict(party) ? null :
    party.partyType === 'PERSON' || party.partyType === 'COMPANY' ? party.partyType :
    partyTypeFromNationalCode(partyNationalIdentity(party));

export const partyDisplayName = (party: PartyIdentityAttributes): string =>
  (party.partyType === 'COMPANY' ? party.companyName?.trim() : [party.firstName?.trim(), party.lastName?.trim()].filter(Boolean).join(' ')) ||
  party.fullName.trim() || party.companyName?.trim() || '';
