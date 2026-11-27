import { describe, expect, it } from 'vitest';
import { crmPartyFields, enrichPartyRows, loadCrmPartyIdentities, resolvePartyIdentity, stableCustomerRecordId, type CrmPartyIdentity } from 'src/services/accounting-party-identity.service';
import { mergeSourcePartyProfile } from 'src/domain/accounting/party-profile';
import { MOCK_PARTY_UAT_100 } from 'src/domain/accounting/adapters/mock/mock-dataset';
import { planPartyImport } from 'src/domain/accounting/import-plan';
import { normalizeNationalCode } from 'src/domain/accounting/party-identity';

const remote = { fullName: 'علی احمدی', nationalCode: '۰۰۱۲۳۴۵۶۷۸', mobile: '09121234567' };
const person: CrmPartyIdentity = {
  id: 'person-1', partyType: 'PERSON', name: 'علی قدیمی', nationalCode: '0012345678',
  mobile: '09120000000',
  phones: { primaryPhoneNumber: '9120000000', primaryPhoneCountryCode: 'IR', primaryPhoneCallingCode: '+98', additionalPhones: [] },
};
describe('accounting CRM identity authority', () => {
  it('retains leading zeroes and normalizes Persian and Arabic digits', () => {
    expect(normalizeNationalCode(remote.nationalCode)).toBe('0012345678');
    expect(normalizeNationalCode('٠٠١٢٣٤٥٦٧٨')).toBe('0012345678');
  });
  it('finds the existing customer by national identity and updates only source fields', () => {
    expect(resolvePartyIdentity(remote, [person])).toEqual({ kind: 'MATCH', target: person });
    expect(crmPartyFields(remote, 'PERSON', person)).toMatchObject({
      name: { firstName: 'علی', lastName: 'احمدی' },
      phones: { primaryPhoneNumber: '9121234567', additionalPhones: [{ number: '9120000000', countryCode: 'IR', callingCode: '+98' }] },
    });
  });
  it('creates only when the identity is absent and refuses duplicate or conflicting identities', () => {
    expect(resolvePartyIdentity(remote, [])).toEqual({ kind: 'CREATE', partyType: 'PERSON', nationalCode: '0012345678' });
    expect(resolvePartyIdentity(remote, [person, { ...person, id: 'other' }])).toEqual({ kind: 'CONFLICT' });
    expect(resolvePartyIdentity(remote, [{ ...person, nationalCode: '1234567890' }], person.id)).toEqual({ kind: 'CONFLICT' });
    expect(resolvePartyIdentity({ ...remote, nationalCode: null }, [])).toEqual({ kind: 'MISSING_IDENTITY' });
  });
  it('distinguishes deleted strong identities, deleted links and truly new customers', () => {
    const deleted = { ...person, deletedAt: '2026-11-26T12:00:00Z' };
    expect(resolvePartyIdentity(remote, [deleted])).toEqual({ kind: 'DELETED_CUSTOMER' });
    expect(resolvePartyIdentity({ ...remote, nationalCode: null }, [deleted], deleted.id)).toEqual({ kind: 'DELETED_CUSTOMER' });
    expect(resolvePartyIdentity(remote, [])).toEqual({ kind: 'CREATE', partyType: 'PERSON', nationalCode: '0012345678' });
    expect(resolvePartyIdentity({ ...remote, nationalCode: null, economicCode: '990099001234' }, [{ ...deleted, economicCode: '990099001234' }])).toEqual({ kind: 'DELETED_CUSTOMER' });
  });
  it('requests deleted records explicitly and excludes them from automatic transfer', async () => {
    const queries: string[] = [];
    const execute = async (query: string) => {
      queries.push(query);
      return { people: { edges: [{ node: { id: person.id, name: { firstName: 'علی', lastName: 'قدیمی' }, nationalCode: person.nationalCode, deletedAt: '2026-11-26T12:00:00Z' } }], pageInfo: { hasNextPage: false } },
        companies: { edges: [], pageInfo: { hasNextPage: false } } };
    };
    const identities = await loadCrmPartyIdentities([remote], [], execute);
    expect(queries.every((query) => query.includes('deletedAt: {is: NOT_NULL}') && query.includes('deletedAt: {is: NULL}'))).toBe(true);
    expect(identities).toMatchObject([{ id: person.id, deletedAt: '2026-11-26T12:00:00Z' }]);
    const preview = planPartyImport({ remoteParties: [{ ...MOCK_PARTY_UAT_100[0], ...remote, legalNationalId: null }], links: [], crmParties: [] });
    const rows = await enrichPartyRows(preview.rows, execute, 'test-connection');
    expect(rows).toMatchObject([{ decision: 'AMBIGUOUS_CRM_MATCH', autoEligible: false, warnings: expect.arrayContaining(['CRM_CUSTOMER_DELETED']) }]);
  });
  it('supports sparse explicit identities, connection-scoped retries, and economic identity', () => {
    const sparse = { fullName: 'مشتری آزمایشی', partyType: 'PERSON' as const, externalPartyId: 'A-001' };
    expect(resolvePartyIdentity(sparse, [])).toEqual({ kind: 'CREATE', partyType: 'PERSON', nationalCode: null });
    expect(resolvePartyIdentity(sparse, [person], person.id, 'PERSON').kind).toBe('MATCH');
    const economic = { ...person, economicCode: '990099001234' };
    expect(resolvePartyIdentity({ ...sparse, economicCode: economic.economicCode }, [economic])).toEqual({ kind: 'MATCH', target: economic });
    expect(stableCustomerRecordId('a', 'A-001')).toBe(stableCustomerRecordId('a', 'A-001'));
    expect(stableCustomerRecordId('a', 'A-001')).not.toBe(stableCustomerRecordId('b', 'A-001'));
  });
  it('preserves missing names, contact data and address components', () => {
    const existing = { ...person, profile: { name: { firstName: 'علی', lastName: 'قدیمی' }, accountingAddress: { addressStreet1: 'خانه', addressCity: 'تهران' } } };
    expect(crmPartyFields({ fullName: '', firstName: 'رضا', city: 'شیراز' }, 'PERSON', existing)).toEqual({
      name: { firstName: 'رضا', lastName: 'قدیمی' }, accountingAddress: { addressStreet1: 'خانه', addressCity: 'شیراز' },
    });
    expect(crmPartyFields({ fullName: '' }, 'PERSON', existing)).toEqual({});
    expect(crmPartyFields({ fullName: 'شرکت نمونه', address: 'نشانی شرکت' }, 'COMPANY', null)).toEqual({ name: 'شرکت نمونه', address: { addressStreet1: 'نشانی شرکت' } });
  });
  it('keeps connection ledger data without overwriting absent values and has an isolated sparse 100-row fixture', () => {
    const previous = mergeSourcePartyProfile({ accountingCode: '0001', subsidiaryLedgerCode: '002' }, null);
    expect(JSON.parse(mergeSourcePartyProfile({ accountingCode: null, detailLedgerCode: '03' }, previous)!)).toEqual({ accountingCode: '0001', subsidiaryLedgerCode: '002', detailLedgerCode: '03' });
    expect(MOCK_PARTY_UAT_100).toHaveLength(100);
    expect(MOCK_PARTY_UAT_100.filter((row) => row.partyType === 'PERSON')).toHaveLength(60);
    expect(MOCK_PARTY_UAT_100.some((row) => !row.nationalCode && !row.legalNationalId && !row.economicCode && !row.mobile)).toBe(true);
    const first = { ...MOCK_PARTY_UAT_100[0], nationalCode: null, legalNationalId: null, economicCode: null };
    const preview = planPartyImport({ remoteParties: [first, { ...first, externalPartyId: 'shared-mobile-other' }], links: [], crmParties: [] });
    expect(preview.rows.every((row) => row.decision === 'AMBIGUOUS_CRM_MATCH')).toBe(true);
  });
  it('does not auto-attach a legacy record by name alone', () => {
    expect(resolvePartyIdentity(remote, [{ ...person, name: remote.fullName, nationalCode: null, mobile: null }])).toEqual({ kind: 'CONFLICT' });
    expect(resolvePartyIdentity(remote, [{ ...person, name: remote.fullName, nationalCode: null, mobile: remote.mobile }]).kind).toBe('MATCH');
  });
});
