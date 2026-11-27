import { describe, expect, it } from 'vitest';

import {
  connectionFormFields,
} from 'src/components/accounting/accounting-connection-rules';
import {
  adapterDisplayLabel,
  resolveAdapterContractAvailability,
  resolveFinancialModes,
  type AdapterDescriptor,
} from 'src/components/accounting/accounting-shared';
import { ADAPTER_DESCRIPTORS } from 'src/domain/accounting/adapter-descriptors';

const adapters = ADAPTER_DESCRIPTORS as unknown as AdapterDescriptor[];

describe('resolveAdapterContractAvailability', () => {
  it('marks unknown adapter ids unavailable, never as mock', () => {
    expect(
      resolveAdapterContractAvailability({
        adapterId: 'sepidar',
        adapters,
      }),
    ).toEqual({ status: 'unavailable', reason: 'missing' });

    expect(
      resolveAdapterContractAvailability({
        adapterId: 'gone-vendor',
        adapters: [],
      }),
    ).toEqual({ status: 'unavailable', reason: 'missing' });
  });

  it('accepts asan and mock descriptors from the server list', () => {
    expect(
      resolveAdapterContractAvailability({ adapterId: 'asan', adapters }).status,
    ).toBe('available');
    expect(
      resolveAdapterContractAvailability({ adapterId: 'mock', adapters }).status,
    ).toBe('available');
  });

  it('marks undeclared descriptors unavailable', () => {
    const hollow: AdapterDescriptor = {
      id: 'hollow',
      label: 'Hollow',
      vendor: '—',
      contractVersion: 'x',
      isLive: false,
      transportIsSecure: true,
      readiness: 'UNKNOWN',
      summary: '',
      limitations: [],
      taxHandling: null,
      dutyHandling: null,
      currencyHandling: null,
      baseCurrency: '',
      requiresSpecialItemCodes: false,
      testProfiles: [],
    };

    expect(
      resolveAdapterContractAvailability({
        adapterId: 'hollow',
        adapters: [hollow],
      }),
    ).toEqual({ status: 'unavailable', reason: 'undeclared' });
  });
});

describe('resolveFinancialModes capability authority', () => {
  it('does not inherit Asan or Mock contracts for an unknown adapter', () => {
    expect(
      resolveFinancialModes({
        adapterId: 'unknown',
        adapters,
        financial: { baseCurrency: '', currencyMappings: {}, conversionRate: '', mockProfile: 'SIMPLE' },
      }),
    ).toEqual({
      taxHandling: 'UNSUPPORTED',
      dutyHandling: 'UNSUPPORTED',
      currencyHandling: 'UNSUPPORTED',
      baseCurrency: '',
      requiresSpecialItemCodes: false,
    });
  });

  it('reads Asan capabilities from the descriptor, not from isLive alone', () => {
    const modes = resolveFinancialModes({
      adapterId: 'asan',
      adapters,
      financial: {
        baseCurrency: 'IRR',
        currencyMappings: {},
        conversionRate: '',
        mockProfile: 'SIMPLE',
      },
    });

    expect(modes.currencyHandling).toBe('SINGLE_CURRENCY');
    expect(modes.taxHandling).toBe('TAX_AMOUNT');
    expect(modes.requiresSpecialItemCodes).toBe(true);
  });

  it('switches mock profile fields through declared profiles only', () => {
    const coded = resolveFinancialModes({
      adapterId: 'mock',
      adapters,
      financial: {
        baseCurrency: '',
        currencyMappings: {},
        conversionRate: '',
        mockProfile: 'CODED',
      },
    });
    const noTax = resolveFinancialModes({
      adapterId: 'mock',
      adapters,
      financial: {
        baseCurrency: '',
        currencyMappings: {},
        conversionRate: '',
        mockProfile: 'NO_TAX',
      },
    });

    expect(connectionFormFields(coded).taxCodeTable).toBe(true);
    expect(connectionFormFields(noTax).taxUnsupported).toBe(true);
    expect(connectionFormFields(noTax).taxCodeTable).toBe(false);
  });

  it('uses the SIMPLE financial contract for the isolated 100-customer dataset', () => {
    const settings = { baseCurrency: '', currencyMappings: {}, conversionRate: '' };
    expect(resolveFinancialModes({ adapterId: 'mock', adapters, financial: { ...settings, mockProfile: 'PARTY_UAT' } })).toEqual(
      resolveFinancialModes({ adapterId: 'mock', adapters, financial: { ...settings, mockProfile: 'SIMPLE' } }),
    );
  });

  it('covers every published mock profile without inventing unsupported ones', () => {
    const mock = adapters.find((entry) => entry.id === 'mock');
    const profiles = mock?.testProfiles ?? [];

    expect(profiles.map((profile) => profile.id).sort()).toEqual(
      ['AGGREGATE', 'AMOUNT', 'CODED', 'NO_TAX', 'SIMPLE', 'TAX_ONLY'].sort(),
    );

    for (const profile of profiles) {
      const modes = resolveFinancialModes({
        adapterId: 'mock',
        adapters,
        financial: {
          baseCurrency: '',
          currencyMappings: {},
          conversionRate: '',
          mockProfile: profile.id,
        },
      });

      expect(modes.taxHandling).toBe(profile.taxHandling);
      expect(modes.currencyHandling).toBe(profile.currencyHandling);
    }
  });
});

describe('adapter display metadata is not authorization', () => {
  it('labels a missing descriptor as unavailable, not experimental mock', () => {
    expect(adapterDisplayLabel(null)).toContain('در دسترس نیست');
    expect(adapterDisplayLabel(null)).not.toContain('آزمایشی');
  });

  it('keeps mock and live labels distinct when descriptor is present', () => {
    const asan = adapters.find((entry) => entry.id === 'asan');
    const mock = adapters.find((entry) => entry.id === 'mock');

    expect(adapterDisplayLabel(asan)).not.toContain('آزمایشی');
    expect(adapterDisplayLabel(mock)).toContain('آزمایشی');
  });
});
