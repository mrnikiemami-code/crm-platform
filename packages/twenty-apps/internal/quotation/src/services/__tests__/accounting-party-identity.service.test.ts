import { describe, expect, it } from 'vitest';
import { crmPartyFields, resolvePartyIdentity, stableCustomerRecordId, type CrmPartyIdentity } from 'src/services/accounting-party-identity.service';
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
    const existing = { ...person, profile: { name: { firstName: 'علی', lastName: 'قدیمی' }, address: { addressStreet1: 'خانه', addressCity: 'تهران' } } };
    expect(crmPartyFields({ fullName: '', firstName: 'رضا', city: 'شیراز' }, 'PERSON', existing)).toEqual({
      name: { firstName: 'رضا', lastName: 'قدیمی' }, address: { addressStreet1: 'خانه', addressCity: 'شیراز' },
    });
    expect(crmPartyFields({ fullName: '' }, 'PERSON', existing)).toEqual({});
  });
  it('does not auto-attach a legacy record by name alone', () => {
    expect(resolvePartyIdentity(remote, [{ ...person, name: remote.fullName, nationalCode: null, mobile: null }])).toEqual({ kind: 'CONFLICT' });
    expect(resolvePartyIdentity(remote, [{ ...person, name: remote.fullName, nationalCode: null, mobile: remote.mobile }]).kind).toBe('MATCH');
  });
});
