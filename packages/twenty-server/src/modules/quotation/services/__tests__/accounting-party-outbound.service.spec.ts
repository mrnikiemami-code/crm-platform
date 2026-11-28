import { buildPartyOutboundProfile, parsePartyOutboundRequest } from 'src/modules/quotation/services/accounting-party-outbound.service';

describe('customer outbound request authority', () => {
  it('discards browser-supplied profile and preserves only record identity', () => {
    const request = { connectionId: '11111111-1111-4111-8111-111111111111', internalPartyId: '22222222-2222-4222-8222-222222222222', partyType: 'PERSON' };
    expect(parsePartyOutboundRequest({ ...request, profile: { fullName: 'fake' } })).toEqual(request);
    expect(parsePartyOutboundRequest({ ...request, expectedFingerprint: 'invalid' })).toBeNull();
  });
  it('reads native Person fields and preserves national leading zeroes', () => {
    expect(buildPartyOutboundProfile('PERSON', {
      name: { firstName: 'علی', lastName: 'احمدی' }, nationalCode: '۰۰۱۲۳۴۵۶۷۸',
      phones: { primaryPhoneNumber: '+989121234567' },
      accountingAddress: { addressStreet1: 'خیابان اول', addressCity: 'تهران', addressPostcode: '0123456789' },
    }, null)).toMatchObject({ fullName: 'علی احمدی', nationalCode: '0012345678', mobile: '09121234567', address: 'خیابان اول، تهران', postalCode: '0123456789' });
  });
  it('does not invent a legal identity or send unsupported fields', () => {
    expect(buildPartyOutboundProfile('COMPANY', { name: 'شرکت', nationalCode: '0012345678' }, null)).toBeNull();
    const profile = buildPartyOutboundProfile('COMPANY', { name: 'شرکت', nationalCode: '10101010101', accountingEmail: 'a@example.invalid' }, '42');
    expect(profile).toMatchObject({ legalNationalId: '10101010101', externalPartyId: '42' });
    expect(profile).not.toHaveProperty('email');
    expect(profile).not.toHaveProperty('accountGroup');
  });
});
