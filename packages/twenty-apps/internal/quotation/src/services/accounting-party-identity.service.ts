import { createHash } from 'node:crypto';
import { type GraphqlValue, toGraphqlLiteral } from 'src/data/graphql-literal';
import { RecordApiError, executeRecordGraphql } from 'src/data/record-api';
import {
  normalizeIranMobile,
  normalizeNationalCode,
  normalizePartyName,
  normalizeEconomicCode,
  partyNationalIdentity,
  partyIdentityConflict,
  resolvePartyKind,
  partyDisplayName,
  type PartyIdentityAttributes,
  splitPartyPersonName,
} from 'src/domain/accounting/party-identity';
import { type PartyImportRow } from 'src/domain/accounting/import-plan';

type Execute = (query: string) => Promise<Record<string, unknown>>;
type Kind = 'PERSON' | 'COMPANY';
type IdentityInput = PartyIdentityAttributes;
type Phones = {
  primaryPhoneNumber?: string;
  primaryPhoneCountryCode?: string;
  primaryPhoneCallingCode?: string;
  additionalPhones?: GraphqlValue;
};
export type CrmPartyIdentity = {
  id: string;
  partyType: Kind;
  name: string;
  nationalCode: string | null;
  updatedAt?: string | null;
  economicCode?: string | null;
  profile?: Record<string, GraphqlValue>;
  mobile: string | null;
  phones: Phones | null;
};
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const jsonArray = (value: unknown): GraphqlValue[] => {
  if (value == null || value === '') return [];
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { throw new RecordApiError('INVALID_RESPONSE', 'Unreadable CRM contact collection'); }
  }
  if (!Array.isArray(parsed)) throw new RecordApiError('INVALID_RESPONSE', 'Unreadable CRM contact collection');
  return parsed as GraphqlValue[];
};
const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];
const variants = (digits: string): string[] => [
  digits,
  digits.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]),
  digits.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]),
];
const mobileVariants = (mobile: string): string[] => [mobile, '0' + mobile, '+98' + mobile, '98' + mobile, '0098' + mobile].flatMap(variants);

// A bounded, targeted lookup. It never scans the CRM or assumes a name is an
// identifier. Name/phone-only candidates are surfaced as conflicts unless both
// independent values agree on a single identity with no conflicting national code.
export const loadCrmPartyIdentities = async (
  inputs: IdentityInput[],
  ids: string[] = [],
  execute: Execute = executeRecordGraphql,
): Promise<CrmPartyIdentity[]> => {
  const results = new Map<string, CrmPartyIdentity>();
  const groups = Math.max(1, Math.ceil(Math.max(inputs.length, ids.length) / 25));
  for (let offset = 0; offset < groups * 25; offset += 25) {
    const batch = inputs.slice(offset, offset + 25);
    const batchIds = unique(ids.slice(offset, offset + 25));
    const nationalCodes = unique(batch.flatMap((row) => {
      const code = partyNationalIdentity(row);
      return code === null ? [] : [...variants(code), row.nationalCode ?? '', row.legalNationalId ?? ''];
    }));
    const economics = unique(batch.flatMap((row) => { const code = normalizeEconomicCode(row.economicCode); return code === null ? [] : [...variants(code), row.economicCode ?? '']; }));
    const names = unique(batch.map(partyDisplayName));
    const mobiles = unique(batch.flatMap((row) => {
      const mobile = normalizeIranMobile(row.mobile);
      return mobile === null ? [] : mobileVariants(mobile);
    }));
    for (const kind of ['PERSON', 'COMPANY'] as const) {
      const root = kind === 'PERSON' ? 'people' : 'companies';
      const clauses: GraphqlValue[] = [];
      if (batchIds.length) clauses.push({ id: { in: batchIds } });
      if (nationalCodes.length) clauses.push({ nationalCode: { in: nationalCodes } });
      if (economics.length) clauses.push({ economicCode: { in: economics } });
      if (kind === 'PERSON') {
        for (const name of names) {
          const parts = splitPartyPersonName(name);
          clauses.push({ name: { firstName: { eq: parts.firstName }, lastName: { eq: parts.lastName } } });
        }
        if (mobiles.length) clauses.push({ phones: { primaryPhoneNumber: { in: mobiles } } });
      } else {
        if (names.length) clauses.push({ name: { in: names } });
        if (mobiles.length) clauses.push({ accountingMobile: { in: mobiles } });
      }
      if (!clauses.length) continue;
      const addressFields = '{ addressStreet1 addressStreet2 addressCity addressState addressPostcode addressCountry addressLat addressLng }';
      const common = 'id updatedAt nationalCode economicCode accountingPhone accountingSecondPhone accountingFax ' + (kind === 'PERSON' ? 'accountingAddress ' : 'address ') + addressFields;
      const fields = kind === 'PERSON'
        ? common + ' name { firstName lastName } phones { primaryPhoneNumber primaryPhoneCountryCode primaryPhoneCallingCode additionalPhones } emails { primaryEmail additionalEmails }'
        : common + ' name accountingMobile registrationNumber accountingEmail';
      let cursor: string | null = null;
      const seen = new Set<string>();
      for (;;) {
        const after: string = cursor === null ? '' : `, after: ${toGraphqlLiteral(cursor)}`;
        const response = await execute(`query AccountingPartyIdentities {
          ${root}(first: 100, filter: ${toGraphqlLiteral({ or: clauses })}${after}) {
            edges { node { ${fields} } }
            pageInfo { hasNextPage endCursor }
          }
        }`);
        const connection = record(response[root]);
        if (connection === null || !Array.isArray(connection.edges)) {
          throw new RecordApiError('INVALID_RESPONSE', 'CRM identity lookup was incomplete');
        }
        for (const edge of connection.edges) {
          const node = record(record(edge)?.node);
          if (node === null || !text(node.id)) continue;
          const fullName = record(node.name);
          const phone = record(node.phones);
          const identity: CrmPartyIdentity = {
            id: text(node.id),
            partyType: kind,
            name: kind === 'PERSON' ? [text(fullName?.firstName), text(fullName?.lastName)].filter(Boolean).join(' ') : text(node.name),
            nationalCode: text(node.nationalCode) || null,
            updatedAt: text(node.updatedAt) || null,
            economicCode: text(node.economicCode) || null,
            profile: Object.fromEntries(Object.entries(node).filter(([key]) => ['name','accountingPhone','accountingSecondPhone','accountingFax','registrationNumber','accountingEmail','address','accountingAddress','emails'].includes(key))) as Record<string, GraphqlValue>,
            mobile: kind === 'PERSON' ? text(phone?.primaryPhoneNumber) || null : text(node.accountingMobile) || null,
            phones: phone === null ? null : {
              primaryPhoneNumber: text(phone.primaryPhoneNumber),
              primaryPhoneCallingCode: text(phone.primaryPhoneCallingCode),
              primaryPhoneCountryCode: text(phone.primaryPhoneCountryCode),
              additionalPhones: jsonArray(phone.additionalPhones),
            },
          };
          results.set(kind + ':' + identity.id, identity);
        }
        const page = record(connection.pageInfo);
        if (page?.hasNextPage !== true) break;
        const next = text(page.endCursor);
        if (!next || seen.has(next) || seen.size >= 100) {
          throw new RecordApiError('INVALID_RESPONSE', 'CRM identity lookup did not finish');
        }
        seen.add(next);
        cursor = next;
      }
    }
  }
  return [...results.values()];
};

// A stable connection-scoped ID protects first-create retries even without national ID.
export const stableCustomerRecordId = (connectionId: string, externalPartyId: string): string => {
  const hex = createHash('sha256').update('quotation/accounting-customer:' + JSON.stringify([connectionId, externalPartyId])).digest('hex');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-5' + hex.slice(13, 16) + '-8' + hex.slice(17, 20) + '-' + hex.slice(20, 32);
};

export type PartyIdentityDecision =
  | { kind: 'MATCH'; target: CrmPartyIdentity }
  | { kind: 'CREATE'; partyType: Kind; nationalCode: string | null }
  | { kind: 'CONFLICT' }
  | { kind: 'MISSING_IDENTITY' };

export const resolvePartyIdentity = (
  remote: IdentityInput,
  crm: CrmPartyIdentity[],
  linkedId: string | null = null,
  linkedKind?: Kind,
): PartyIdentityDecision => {
  if (partyIdentityConflict(remote)) return { kind: 'CONFLICT' };
  const code = partyNationalIdentity(remote);
  const economic = normalizeEconomicCode(remote.economicCode);
  const kind = resolvePartyKind(remote);
  const exact = crm.filter((entry) =>
    (code !== null && normalizeNationalCode(entry.nationalCode) === code) ||
    (economic !== null && normalizeEconomicCode(entry.economicCode) === economic),
  );
  const compatible = (target: CrmPartyIdentity): boolean =>
    (kind === null || target.partyType === kind) &&
    (code === null || !target.nationalCode || normalizeNationalCode(target.nationalCode) === code) &&
    (economic === null || !target.economicCode || normalizeEconomicCode(target.economicCode) === economic);
  if (exact.length > 1 || exact.some((entry) => !compatible(entry))) return { kind: 'CONFLICT' };
  if (linkedId !== null) {
    const targets = crm.filter((entry) => entry.id === linkedId && (linkedKind === undefined || entry.partyType === linkedKind));
    const target = targets[0];
    if (targets.length !== 1 || !compatible(target) || exact.some((entry) => entry.id !== linkedId)) return { kind: 'CONFLICT' };
    return { kind: 'MATCH', target };
  }
  if (exact.length === 1) return { kind: 'MATCH', target: exact[0] };
  const name = normalizePartyName(partyDisplayName(remote));
  const mobile = normalizeIranMobile(remote.mobile);
  const possible = crm.filter((entry) =>
    (name !== '' && normalizePartyName(entry.name) === name) ||
    (mobile !== null && normalizeIranMobile(entry.mobile) === mobile),
  );
  if (possible.length === 1) {
    const candidate = possible[0];
    if (compatible(candidate) && mobile !== null && normalizeIranMobile(candidate.mobile) === mobile &&
        name !== '' && normalizePartyName(candidate.name) === name) return { kind: 'MATCH', target: candidate };
  }
  if (possible.length > 0) return { kind: 'CONFLICT' };
  return kind !== null && name !== '' && (code !== null || economic !== null || !!remote.externalPartyId?.trim())
    ? { kind: 'CREATE', partyType: kind, nationalCode: code }
    : { kind: 'MISSING_IDENTITY' };
};

export const crmPartyFields = (
  remote: IdentityInput,
  partyType: Kind,
  existing: CrmPartyIdentity | null,
): Record<string, GraphqlValue> => {
  const fields: Record<string, GraphqlValue> = {};
  const code = partyNationalIdentity(remote);
  if (code !== null && existing?.nationalCode !== code) fields.nationalCode = code;
  const name = partyDisplayName(remote);
  if (partyType === 'PERSON' && (remote.firstName?.trim() || remote.lastName?.trim())) {
    const previous = record(existing?.profile?.name);
    const fallback = splitPartyPersonName(existing?.name || remote.fullName || '');
    const firstName = remote.firstName?.trim() || text(previous?.firstName) || fallback.firstName;
    const lastName = remote.lastName?.trim() || text(previous?.lastName) || fallback.lastName;
    if (existing === null || normalizePartyName(existing.name) !== normalizePartyName([firstName, lastName].filter(Boolean).join(' '))) {
      fields.name = { firstName, lastName };
    }
  } else if (name !== '' && (existing === null || normalizePartyName(existing.name) !== normalizePartyName(name))) {
    fields.name = partyType === 'PERSON' ? splitPartyPersonName(name) : name;
  }
  const economic = normalizeEconomicCode(remote.economicCode);
  if (economic !== null && existing?.economicCode !== economic) fields.economicCode = economic;
  const profile = existing?.profile ?? {};
  const setText = (key: string, value: string | null | undefined) => {
    const next = value?.trim();
    if (next && next !== text(profile[key])) fields[key] = next;
  };
  setText('accountingPhone', remote.firstPhone);
  setText('accountingSecondPhone', remote.secondPhone);
  setText('accountingFax', remote.fax);
  if (partyType === 'COMPANY') {
    setText('registrationNumber', remote.registrationNumber);
    setText('accountingEmail', remote.email);
  } else if (remote.email?.trim()) {
    const previous = record(profile.emails);
    const email = remote.email.trim();
    const primary = text(previous?.primaryEmail);
    const additional = jsonArray(previous?.additionalEmails).filter((value): value is string => typeof value === 'string');
    if (!primary) fields.emails = { primaryEmail: email, additionalEmails: additional };
    else if (primary.toLowerCase() !== email.toLowerCase() && !additional.some((value) => value.toLowerCase() === email.toLowerCase())) {
      fields.emails = { primaryEmail: primary, additionalEmails: [...additional, email] };
    }
  }
  const addressKey = partyType === 'PERSON' ? 'accountingAddress' : 'address';
  const currentAddress = record(profile[addressKey] ?? profile.address);
  const nextAddress: Record<string, GraphqlValue> = {};
  for (const key of ['addressStreet1','addressStreet2','addressCity','addressState','addressPostcode','addressCountry','addressLat','addressLng']) {
    const value = currentAddress?.[key];
    if (typeof value === 'string' || typeof value === 'number') nextAddress[key] = value;
  }
  let addressChanged = false;
  for (const [key, value] of Object.entries({ addressStreet1: remote.address, addressCity: remote.city, addressState: remote.state, addressPostcode: remote.postalCode, addressCountry: remote.country })) {
    const next = value?.trim();
    if (next && nextAddress[key] !== next) { nextAddress[key] = next; addressChanged = true; }
  }
  if (addressChanged) fields[addressKey] = nextAddress;
  const mobile = normalizeIranMobile(remote.mobile);
  if (mobile !== null && normalizeIranMobile(existing?.mobile) !== mobile) {
    if (partyType === 'COMPANY') {
      fields.accountingMobile = '0' + mobile;
    } else {
      // Keep existing additional phone entries and preserve the old primary
      // when a valid new primary arrives from accounting.
      const previous = existing?.phones;
      const additional = [...jsonArray(previous?.additionalPhones)];
      if (previous?.primaryPhoneNumber && previous.primaryPhoneCountryCode && previous.primaryPhoneCallingCode &&
          !additional.some((value) => record(value)?.number === previous.primaryPhoneNumber)) {
        additional.push({
          number: previous.primaryPhoneNumber,
          countryCode: previous.primaryPhoneCountryCode,
          callingCode: previous.primaryPhoneCallingCode,
        });
      }
      fields.phones = {
        primaryPhoneNumber: mobile,
        primaryPhoneCountryCode: 'IR',
        primaryPhoneCallingCode: '+98',
        additionalPhones: additional,
      };
    }
  }
  return fields;
};

export const enrichPartyRows = async (
  rows: PartyImportRow[],
  execute: Execute = executeRecordGraphql,
  connectionId?: string,
): Promise<PartyImportRow[]> => {
  const eligible = rows.filter((row) => row.decision !== 'DUPLICATE_REMOTE_CODE' &&
    (row.existingLinkId !== null || resolvePartyKind(row) !== null || partyNationalIdentity(row) !== null || normalizeEconomicCode(row.economicCode) !== null || normalizeIranMobile(row.mobile) !== null));
  const crm = await loadCrmPartyIdentities(eligible, eligible.flatMap((row) => [
    ...(row.suggestedInternalPartyId ? [row.suggestedInternalPartyId] : []),
    ...(connectionId && row.externalPartyId ? [stableCustomerRecordId(connectionId, row.externalPartyId)] : []),
  ]), execute);
  return rows.map((row) => {
    if (row.decision === 'DUPLICATE_REMOTE_CODE' || row.warnings.includes('DUPLICATE_REMOTE_NATIONAL_CODE') || row.warnings.includes('DUPLICATE_REMOTE_ECONOMIC_CODE')) {
      return { ...row, autoEligible: false, decision: 'DUPLICATE_REMOTE_CODE', suggestedInternalPartyId: null };
    }
    if (row.warnings.includes('DUPLICATE_REMOTE_MOBILE')) return { ...row, autoEligible: false, decision: 'AMBIGUOUS_CRM_MATCH', suggestedInternalPartyId: null };
    const stableId = connectionId ? stableCustomerRecordId(connectionId, row.externalPartyId) : null;
    const recovered = stableId !== null && crm.some((entry) => entry.id === stableId) ? stableId : null;
    const linkedId = row.existingLinkId !== null ? row.suggestedInternalPartyId : recovered;
    if (row.existingLinkId !== null && linkedId === null) return { ...row, autoEligible: false, decision: 'AMBIGUOUS_CRM_MATCH', suggestedInternalPartyId: null };
    const decision = resolvePartyIdentity(row, crm, linkedId);
    if (decision.kind === 'CONFLICT') return { ...row, autoEligible: false, decision: 'AMBIGUOUS_CRM_MATCH', suggestedInternalPartyId: null };
    if (decision.kind === 'MISSING_IDENTITY') return { ...row, autoEligible: false, decision: 'NEEDS_CRM_RECORD', suggestedInternalPartyId: null };
    if (decision.kind === 'CREATE') return { ...row, autoEligible: true, decision: 'NEEDS_CRM_RECORD', suggestedInternalPartyId: null };
    const status = row.existingLinkId === null ? 'LINK_SUGGESTED' :
      row.decision === 'REMOTE_CHANGED' || Object.keys(crmPartyFields(row, decision.target.partyType, decision.target)).length > 0 ? 'REMOTE_CHANGED' : 'IN_SYNC';
    return { ...row, autoEligible: status !== 'IN_SYNC', decision: status, suggestedInternalPartyId: decision.target.id };
  });
};
