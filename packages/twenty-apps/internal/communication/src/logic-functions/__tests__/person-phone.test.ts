import { describe, expect, it } from 'vitest';

import { buildPersonPhoneOptions } from 'src/logic-functions/types/person-phone.type';

describe('buildPersonPhoneOptions', () => {
  it('returns the primary number first', () => {
    expect(
      buildPersonPhoneOptions({
        primaryPhoneNumber: '09120000000',
        additionalPhones: [{ number: '09350000000' }],
      }),
    ).toEqual([
      { id: 'primary', value: '09120000000', isPrimary: true },
      { id: 'additional-0', value: '09350000000', isPrimary: false },
    ]);
  });

  it('returns an empty list when the person has no phone', () => {
    expect(buildPersonPhoneOptions(null)).toEqual([]);
    expect(buildPersonPhoneOptions({ primaryPhoneNumber: null })).toEqual([]);
    expect(buildPersonPhoneOptions({ primaryPhoneNumber: '   ' })).toEqual([]);
  });

  it('skips blank additional numbers', () => {
    expect(
      buildPersonPhoneOptions({
        primaryPhoneNumber: '09120000000',
        additionalPhones: [{ number: '  ' }, { number: '09360000000' }],
      }),
    ).toEqual([
      { id: 'primary', value: '09120000000', isPrimary: true },
      { id: 'additional-1', value: '09360000000', isPrimary: false },
    ]);
  });

  it('does not normalize the number (out of scope)', () => {
    expect(
      buildPersonPhoneOptions({ primaryPhoneNumber: '+98 912 000 0000' }),
    ).toEqual([
      { id: 'primary', value: '+98 912 000 0000', isPrimary: true },
    ]);
  });
});
