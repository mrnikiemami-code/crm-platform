import { describe, expect, it } from 'vitest';

import {
  matchTaxPolicyToDestinationCode,
  type TaxCodeContract,
} from 'src/domain/accounting/tax-code-contract';
import { mockProfileCapabilities } from 'src/domain/accounting/adapters/mock/mock-profiles';

// One CRM policy, one destination code. The code stands for the whole value-added
// treatment, so the check is against the destination's own statement about that code —
// never against a rate typed on the connection.

const policy = {
  taxRateBasisPoints: '600',
  dutyRateBasisPoints: '300',
  totalRateBasisPoints: '900',
};

const catalog: TaxCodeContract[] = [
  {
    code: '64',
    label: 'مالیات ارزش افزوده ۹٪ (۶٪ مالیات + ۳٪ عوارض)',
    totalRateBasisPoints: '900',
    taxRateBasisPoints: '600',
    dutyRateBasisPoints: '300',
  },
  {
    code: '70',
    label: 'مالیات ارزش افزوده ۱۰٪ (۷٪ مالیات + ۳٪ عوارض)',
    totalRateBasisPoints: '1000',
    taxRateBasisPoints: '700',
    dutyRateBasisPoints: '300',
  },
  {
    code: '92',
    label: 'مالیات ارزش افزوده ۹٪ (۷٪ مالیات + ۲٪ عوارض)',
    totalRateBasisPoints: '900',
    taxRateBasisPoints: '700',
    dutyRateBasisPoints: '200',
  },
];

const match = (destinationCode: string, codes: TaxCodeContract[] | undefined = catalog) =>
  matchTaxPolicyToDestinationCode({ policy, destinationCode, catalog: codes });

describe('matching one policy to one destination code', () => {
  it('accepts a code whose total and internal split both match', () => {
    expect(match('64')).toEqual({ kind: 'MATCH' });
  });

  it('rejects a code whose total differs from the policy', () => {
    expect(match('70')).toMatchObject({ kind: 'MISMATCH', reason: 'TOTAL_RATE' });
  });

  it('tells two policies with the same 9% total apart by their split', () => {
    // 6% + 3% is code 64; 7% + 2% is also 9% but a different legal composition.
    expect(match('92')).toMatchObject({ kind: 'MISMATCH', reason: 'COMPOSITION' });
  });

  it('compares the total alone when the destination publishes no split', () => {
    const totalOnly: TaxCodeContract[] = [
      { code: '64', label: '۹٪', totalRateBasisPoints: '900' },
    ];

    expect(match('64', totalOnly)).toEqual({ kind: 'MATCH' });
  });

  it('does not claim a match when no catalog was published', () => {
    expect(
      matchTaxPolicyToDestinationCode({
        policy,
        destinationCode: '64',
        catalog: undefined,
      }),
    ).toEqual({ kind: 'UNVERIFIABLE', reason: 'NO_CATALOG' });
  });

  it('does not claim a match when the destination published an empty catalog', () => {
    expect(match('64', [])).toEqual({
      kind: 'UNVERIFIABLE',
      reason: 'NO_CATALOG',
    });
  });

  it('reports an unlisted code as unverifiable, not as a disagreement', () => {
    expect(match('777')).toEqual({
      kind: 'UNVERIFIABLE',
      reason: 'CODE_NOT_LISTED',
    });
  });

  it('does not treat a half-typed code as a match', () => {
    expect(match('')).toEqual({ kind: 'UNVERIFIABLE', reason: 'CODE_NOT_LISTED' });
  });

  it('reads the catalog with surrounding whitespace rather than failing', () => {
    expect(match(' 64 ')).toEqual({ kind: 'MATCH' });
  });

  it('refuses to guess when the policy rates are unreadable', () => {
    expect(
      matchTaxPolicyToDestinationCode({
        policy: {
          taxRateBasisPoints: '',
          dutyRateBasisPoints: '300',
          totalRateBasisPoints: '900',
        },
        destinationCode: '64',
        catalog,
      }),
    ).toEqual({ kind: 'UNVERIFIABLE', reason: 'CODE_NOT_LISTED' });
  });
});

describe('the sample catalog is illustrative, never hardcoded in the CRM', () => {
  it('keeps the mock catalog on the profile, not on the shared capability default', () => {
    const simple = mockProfileCapabilities('SIMPLE');
    const coded = mockProfileCapabilities('CODED');

    expect(simple.taxCodeCatalog).toBeUndefined();
    expect(coded.taxCodeCatalog?.map((entry) => entry.code)).toEqual(['64', '70']);
  });
});
