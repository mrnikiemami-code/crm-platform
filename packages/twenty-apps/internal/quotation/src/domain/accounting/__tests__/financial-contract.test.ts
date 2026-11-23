import { describe, expect, it } from 'vitest';

import {
  type AdapterCapabilities,
  type CurrencyHandlingMode,
  type TaxHandlingMode,
} from 'src/domain/accounting/capabilities';
import {
  CURRENCY_CODE_PATTERN,
  DEFAULT_FINANCIAL_SETTINGS,
  checkFinancialRequirements,
  financialSettingsFromRecord,
  isConversionRateUsable,
  parseFinancialSettings,
} from 'src/domain/accounting/financial-contract';
import { mockProfileCapabilities } from 'src/domain/accounting/adapters/mock/mock-profiles';

const capabilities = ({
  tax = 'TAX_RATE',
  currency = 'SINGLE_CURRENCY',
}: {
  tax?: TaxHandlingMode;
  currency?: CurrencyHandlingMode;
} = {}): AdapterCapabilities => ({
  ...mockProfileCapabilities('SIMPLE'),
  taxHandling: tax,
  currencyHandling: currency,
  baseCurrency: currency === 'SINGLE_CURRENCY' ? 'IRR' : '',
});

const gate = ({
  tax = 'TAX_RATE',
  currency = 'SINGLE_CURRENCY',
  hasTax = true,
  taxPolicyCode = 'IR_VAT_9',
  currencyCode = 'IRR',
  taxPolicyMappings = {} as Record<string, string>,
  baseCurrency = 'IRR',
  mappings = {} as Record<string, string>,
  conversionRate = '',
}: {
  tax?: TaxHandlingMode;
  currency?: CurrencyHandlingMode;
  hasTax?: boolean;
  taxPolicyCode?: string;
  currencyCode?: string;
  taxPolicyMappings?: Record<string, string>;
  baseCurrency?: string;
  mappings?: Record<string, string>;
  conversionRate?: string;
}) =>
  checkFinancialRequirements({
    capabilities: capabilities({ tax, currency }),
    financial: {
      ...DEFAULT_FINANCIAL_SETTINGS,
      baseCurrency,
      currencyMappings: mappings,
      conversionRate,
    },
    taxPolicyMappings,
    document: { hasTax, taxPolicyCode, currencyCode },
  });

describe('tax contract by capability', () => {
  it('sends a taxed document to a rate destination without any fiscal code', () => {
    expect(gate({ tax: 'TAX_RATE' }).ok).toBe(true);
  });

  it('sends a taxed document to an amount destination without any fiscal code', () => {
    expect(gate({ tax: 'TAX_AMOUNT' }).ok).toBe(true);
  });

  it('refuses a code destination whose policy has no mapped vendor code', () => {
    expect(gate({ tax: 'TAX_CODE' })).toMatchObject({
      ok: false,
      refusal: { code: 'TAX_POLICY_NOT_MAPPED' },
    });
  });

  it('accepts a code destination once the policy is mapped on this connection', () => {
    expect(
      gate({ tax: 'TAX_CODE', taxPolicyMappings: { IR_VAT_9: 'VAT-09' } }).ok,
    ).toBe(true);
  });

  it('refuses a code-and-amount destination without a mapped code', () => {
    expect(gate({ tax: 'TAX_CODE_AND_AMOUNT' })).toMatchObject({
      ok: false,
      refusal: { code: 'TAX_POLICY_NOT_MAPPED' },
    });
  });

  it('refuses a taxed document when the destination has no tax contract', () => {
    expect(gate({ tax: 'UNSUPPORTED' })).toMatchObject({
      ok: false,
      refusal: { code: 'TAX_UNSUPPORTED' },
    });
  });

  it('allows an untaxed document to reach a destination with no tax contract', () => {
    expect(gate({ tax: 'UNSUPPORTED', hasTax: false }).ok).toBe(true);
  });

  it('keeps the code refusal ahead of the currency one so the remedy is actionable', () => {
    expect(
      gate({
        tax: 'TAX_CODE',
        currency: 'CURRENCY_CODE',
        mappings: {},
        taxPolicyMappings: {},
      }),
    ).toMatchObject({ ok: false, refusal: { code: 'TAX_POLICY_NOT_MAPPED' } });
  });
});

describe('currency contract by capability', () => {
  it('sends a rial document to a single-currency destination with no currency code', () => {
    expect(gate({ currency: 'SINGLE_CURRENCY' }).ok).toBe(true);
  });

  it('refuses a single-currency destination whose base currency is unconfirmed', () => {
    expect(gate({ currency: 'SINGLE_CURRENCY', baseCurrency: '' })).toMatchObject({
      ok: false,
      refusal: { code: 'CURRENCY_BASE_UNCONFIRMED' },
    });
  });

  it('refuses a code destination without a mapping for the document currency', () => {
    expect(gate({ currency: 'CURRENCY_CODE' })).toMatchObject({
      ok: false,
      refusal: { code: 'CURRENCY_CODE_MAPPING_REQUIRED' },
    });
  });

  it('accepts a code destination once the document currency is mapped', () => {
    expect(gate({ currency: 'CURRENCY_CODE', mappings: { IRR: '1' } }).ok).toBe(
      true,
    );
  });

  it('asks for a name when the destination reads a text currency id', () => {
    expect(gate({ currency: 'CURRENCY_NAME' })).toMatchObject({
      ok: false,
      refusal: { code: 'CURRENCY_NAME_MAPPING_REQUIRED' },
    });
  });

  it('refuses a code-and-rate destination with no usable rate for a foreign currency', () => {
    expect(
      gate({
        currency: 'CURRENCY_CODE_AND_RATE',
        currencyCode: 'USD',
        mappings: { USD: '2' },
      }),
    ).toMatchObject({ ok: false, refusal: { code: 'CURRENCY_RATE_REQUIRED' } });
  });

  it('does not demand a rate when the document is already in the destination currency', () => {
    expect(
      gate({
        currency: 'CURRENCY_CODE_AND_RATE',
        currencyCode: 'IRR',
        baseCurrency: 'IRR',
        mappings: { IRR: '1' },
      }).ok,
    ).toBe(true);
  });

  it('refuses a destination with no usable currency contract', () => {
    expect(gate({ currency: 'UNSUPPORTED' })).toMatchObject({
      ok: false,
      refusal: { code: 'CURRENCY_UNSUPPORTED' },
    });
  });
});

describe('reading a stored financial block', () => {
  it('gives a record written before the block existed the conservative default', () => {
    expect(financialSettingsFromRecord(undefined)).toEqual(
      DEFAULT_FINANCIAL_SETTINGS,
    );
  });

  it('never throws on an unreadable value, because the settings page must open', () => {
    expect(financialSettingsFromRecord('garbage')).toEqual(
      DEFAULT_FINANCIAL_SETTINGS,
    );
  });

  it('drops a mapping with an empty destination value instead of storing it', () => {
    expect(
      financialSettingsFromRecord({ currencyMappings: { IRR: '', USD: '2' } })
        .currencyMappings,
    ).toEqual({ USD: '2' });
  });

  it('keeps only a usable conversion rate and never assumes 1', () => {
    expect(
      financialSettingsFromRecord({ conversionRate: '0' }).conversionRate,
    ).toBe('');
    expect(
      financialSettingsFromRecord({ conversionRate: '1.2345678' })
        .conversionRate,
    ).toBe('');
    expect(
      financialSettingsFromRecord({ conversionRate: '1.5' }).conversionRate,
    ).toBe('1.5');
  });

  it('replaces an unknown mock profile with the default one', () => {
    expect(
      financialSettingsFromRecord({ mockProfile: 'WISHFUL' }).mockProfile,
    ).toBe('SIMPLE');
  });
});

describe('validating a financial block on write', () => {
  it('refuses a base currency that is not a three-letter code', () => {
    expect(
      parseFinancialSettings({ baseCurrency: 'RIAL' }, { adapterId: 'mock' }),
    ).toMatchObject({ ok: false, refusal: { code: 'CURRENCY_BASE_INVALID' } });
  });

  it('normalizes a lowercase base currency instead of refusing it', () => {
    const parsed = parseFinancialSettings(
      { baseCurrency: 'irr' },
      { adapterId: 'mock' },
    );

    expect(parsed.ok && parsed.value.baseCurrency).toBe('IRR');
  });

  it('refuses an invalid conversion rate rather than storing a rounded one', () => {
    expect(
      parseFinancialSettings({ conversionRate: '1.2345678' }, { adapterId: 'mock' }),
    ).toMatchObject({ ok: false, refusal: { code: 'CURRENCY_RATE_INVALID' } });
  });

  it('refuses a test profile on a live adapter', () => {
    expect(
      parseFinancialSettings({ mockProfile: 'CODED' }, { adapterId: 'asan' }),
    ).toMatchObject({ ok: false, refusal: { code: 'MOCK_PROFILE_NOT_ALLOWED' } });
  });

  it('accepts a test profile on the mock adapter', () => {
    const parsed = parseFinancialSettings(
      { mockProfile: 'CODED' },
      { adapterId: 'mock' },
    );

    expect(parsed.ok && parsed.value.mockProfile).toBe('CODED');
  });

  it('refuses a test profile that does not exist', () => {
    expect(
      parseFinancialSettings({ mockProfile: 'WISHFUL' }, { adapterId: 'mock' }),
    ).toMatchObject({ ok: false, refusal: { code: 'MOCK_PROFILE_UNKNOWN' } });
  });

  it('reads a stored record without an adapter id instead of refusing its profile', () => {
    expect(
      parseFinancialSettings({ mockProfile: 'SIMPLE' }, { adapterId: '' }).ok,
    ).toBe(true);
  });
});

describe('currency patterns', () => {
  it('accepts only three uppercase letters as a currency code', () => {
    expect(CURRENCY_CODE_PATTERN.test('IRR')).toBe(true);
    expect(CURRENCY_CODE_PATTERN.test('irr')).toBe(false);
    expect(CURRENCY_CODE_PATTERN.test('RIAL')).toBe(false);
  });

  it('treats a rate that needs rounding as unusable', () => {
    expect(isConversionRateUsable('1')).toBe(true);
    expect(isConversionRateUsable('1.000001')).toBe(true);
    expect(isConversionRateUsable('1.0000001')).toBe(false);
    expect(isConversionRateUsable('0')).toBe(false);
    expect(isConversionRateUsable('-1')).toBe(false);
  });
});
