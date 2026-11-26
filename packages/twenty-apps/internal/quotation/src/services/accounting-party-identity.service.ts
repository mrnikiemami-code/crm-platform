import { type GraphqlValue, toGraphqlLiteral } from 'src/data/graphql-literal';
import { RecordApiError, executeRecordGraphql } from 'src/data/record-api';
import {
  normalizeIranMobile,
  normalizeNationalCode,
  normalizePartyName,
  partyTypeFromNationalCode,
  splitPartyPersonName,
} from 'src/domain/accounting/party-identity';
import { type PartyImportRow } from 'src/domain/accounting/import-plan';

type Execute = (query: string) => Promise<Record<string, unknown>>;
type Kind = 'PERSON' | 'COMPANY';
type IdentityInput = { fullName: string; nationalCode: string | null; mobile: string | null };
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
  mobile: string | null;
  phones: Phones | null;
};
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
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
      const code = normalizeNationalCode(row.nationalCode);
      return code === null ? [] : [...variants(code), row.nationalCode ?? ''];
    }));
    const names = unique(batch.map((row) => row.fullName.trim()));
    const mobiles = unique(batch.flatMap((row) => {
      const mobile = normalizeIranMobile(row.mobile);
      return mobile === null ? [] : mobileVariants(mobile);
    }));
    for (const kind of ['PERSON', 'COMPANY'] as const) {
      const root = kind === 'PERSON' ? 'people' : 'companies';
      const clauses: GraphqlValue[] = [];
      if (batchIds.length) clauses.push({ id: { in: batchIds } });
      if (nationalCodes.length) clauses.push({ nationalCode: { in: nationalCodes } });
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
      const fields = kind === 'PERSON'
        ? 'id nationalCode name { firstName lastName } phones { primaryPhoneNumber primaryPhoneCountryCode primaryPhoneCallingCode additionalPhones }'
        : 'id nationalCode name accountingMobile';
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
            mobile: kind === 'PERSON' ? text(phone?.primaryPhoneNumber) || null : text(node.accountingMobile) || null,
            phones: phone === null ? null : {
              primaryPhoneNumber: text(phone.primaryPhoneNumber),
              primaryPhoneCallingCode: text(phone.primaryPhoneCallingCode),
              primaryPhoneCountryCode: text(phone.primaryPhoneCountryCode),
              additionalPhones: Array.isArray(phone.additionalPhones) ? phone.additionalPhones as GraphqlValue : [],
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

export type PartyIdentityDecision =
  | { kind: 'MATCH'; target: CrmPartyIdentity }
  | { kind: 'CREATE'; partyType: Kind; nationalCode: string }
  | { kind: 'CONFLICT' | 'MISSING_IDENTITY' };

export const resolvePartyIdentity = (
  remote: IdentityInput,
  crm: CrmPartyIdentity[],
  linkedId: string | null = null,
  linkedKind?: Kind,
): PartyIdentityDecision => {
  const code = normalizeNationalCode(remote.nationalCode);
  const kind = partyTypeFromNationalCode(code);
  if (code === null || kind === null || !remote.fullName.trim()) return { kind: 'MISSING_IDENTITY' };
  const exact = crm.filter((entry) => normalizeNationalCode(entry.nationalCode) === code);
  if (exact.length > 1 || exact.some((entry) => entry.partyType !== kind)) return { kind: 'CONFLICT' };
  if (linkedId !== null) {
    const targets = crm.filter((entry) => entry.id === linkedId && entry.partyType === kind);
    const target = targets[0];
    if (targets.length !== 1 || (linkedKind !== undefined && linkedKind !== kind) ||
        (target.nationalCode !== null && normalizeNationalCode(target.nationalCode) !== code) ||
        exact.some((entry) => entry.id !== linkedId)) return { kind: 'CONFLICT' };
    return { kind: 'MATCH', target };
  }
  if (exact.length === 1) return { kind: 'MATCH', target: exact[0] };
  const name = normalizePartyName(remote.fullName);
  const mobile = normalizeIranMobile(remote.mobile);
  const possible = crm.filter((entry) =>
    normalizePartyName(entry.name) === name ||
    (mobile !== null && normalizeIranMobile(entry.mobile) === mobile),
  );
  if (possible.length === 1) {
    const candidate = possible[0];
    if (candidate.partyType === kind && candidate.nationalCode === null &&
        mobile !== null && normalizeIranMobile(candidate.mobile) === mobile &&
        normalizePartyName(candidate.name) === name) return { kind: 'MATCH', target: candidate };
  }
  return possible.length > 0 ? { kind: 'CONFLICT' } : { kind: 'CREATE', partyType: kind, nationalCode: code };
};

export const crmPartyFields = (
  remote: IdentityInput,
  partyType: Kind,
  existing: CrmPartyIdentity | null,
): Record<string, GraphqlValue> => {
  const fields: Record<string, GraphqlValue> = {};
  const code = normalizeNationalCode(remote.nationalCode);
  if (code !== null && existing?.nationalCode !== code) fields.nationalCode = code;
  if (existing === null || normalizePartyName(existing.name) !== normalizePartyName(remote.fullName)) {
    fields.name = partyType === 'PERSON' ? splitPartyPersonName(remote.fullName) : remote.fullName.trim();
  }
  const mobile = normalizeIranMobile(remote.mobile);
  if (mobile !== null && normalizeIranMobile(existing?.mobile) !== mobile) {
    if (partyType === 'COMPANY') {
      fields.accountingMobile = '0' + mobile;
    } else {
      // Keep existing additional phone entries and preserve the old primary
      // when a valid new primary arrives from accounting.
      const previous = existing?.phones;
      const additional = Array.isArray(previous?.additionalPhones) ? [...previous.additionalPhones] : [];
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
): Promise<PartyImportRow[]> => {
  const crm = await loadCrmPartyIdentities(rows, rows.flatMap((row) => row.suggestedInternalPartyId ? [row.suggestedInternalPartyId] : []), execute);
  return rows.map((row) => {
    if (row.decision === 'DUPLICATE_REMOTE_CODE' || row.warnings.includes('DUPLICATE_REMOTE_NATIONAL_CODE')) {
      return { ...row, decision: 'DUPLICATE_REMOTE_CODE', suggestedInternalPartyId: null };
    }
    const linkedId = row.existingLinkId !== null ? row.suggestedInternalPartyId : null;
    const decision = resolvePartyIdentity(row, crm, linkedId);
    if (decision.kind === 'CONFLICT') return { ...row, decision: 'AMBIGUOUS_CRM_MATCH', suggestedInternalPartyId: null };
    if (decision.kind === 'MISSING_IDENTITY') {
      return row.existingLinkId !== null ? row : { ...row, decision: 'NEEDS_CRM_RECORD', suggestedInternalPartyId: null };
    }
    if (decision.kind === 'CREATE') return { ...row, decision: 'NEEDS_CRM_RECORD', suggestedInternalPartyId: null };
    return {
      ...row,
      decision: linkedId === null ? 'LINK_SUGGESTED' :
        row.decision === 'REMOTE_CHANGED' || Object.keys(crmPartyFields(row, decision.target.partyType, decision.target)).length > 0 ? 'REMOTE_CHANGED' : 'IN_SYNC',
      suggestedInternalPartyId: decision.target.id,
    };
  });
};
