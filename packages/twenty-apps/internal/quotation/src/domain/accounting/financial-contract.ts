import {
  type AdapterCapabilities,
  currencyModeNeedsRate,
  currencyModeNeedsVendorValue,
  taxModeNeedsVendorCode,
} from 'src/domain/accounting/capabilities';
import {
  DEFAULT_MOCK_PROFILE,
  isMockProfile,
  type MockProfile,
} from 'src/domain/accounting/adapters/mock/mock-profiles';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// The financial half of a connection's configuration, decided by what the destination
// actually reads.
//
// Kept apart from `ConnectionSettings` only because it is a newer, optional block: reading a
// record written before it existed must not fail, and a missing block must behave like the
// conservative default below rather than like "no requirements".
//
// WHAT IS DELIBERATELY NOT HERE:
//  - the tax rate. It lives on the CRM tax policy, and copying it here would create a second
//    place where a rate is decided. The connection only maps a policy to a vendor code.
//  - the tax amount. It is computed once by the money domain and sealed into the revision.
//  - an FX rate for a single-currency destination. A rate with no consumer is a rate someone
//    will eventually apply by mistake.
export type FinancialSettings = {
  // The currency the destination books in. Only used by `SINGLE_CURRENCY`; a destination
  // that takes a code declares no base here.
  baseCurrency: string;
  // CRM currency code -> the destination's own code or text id. Only meaningful when the
  // adapter declares a code/name handling mode; kept otherwise so switching a mock profile
  // does not silently erase what an operator typed.
  currencyMappings: Record<string, string>;
  // Exact decimal conversion rate, only read by `CURRENCY_CODE_AND_RATE`. Empty means "not
  // provided", never "assume 1".
  conversionRate: string;
  // Test-only: which mock contract variant this connection simulates. Validated against a
  // closed set and refused for live adapters, so it can never describe a real vendor.
  mockProfile: MockProfile;
};

export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  baseCurrency: 'IRR',
  currencyMappings: {},
  conversionRate: '',
  mockProfile: DEFAULT_MOCK_PROFILE,
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

// Upper bounds exist so a stored record cannot grow without limit through the settings form.
export const MAX_CURRENCY_MAPPINGS = 40;
export const MAX_CURRENCY_VALUE_LENGTH = 32;

const readMappings = (value: unknown): Record<string, string> => {
  const raw = asRecord(value);
  const mappings: Record<string, string> = {};

  for (const [key, entry] of Object.entries(raw)) {
    const code = key.trim();
    const vendorValue = readString(entry);

    if (
      code !== '' &&
      vendorValue !== '' &&
      Object.keys(mappings).length < MAX_CURRENCY_MAPPINGS
    ) {
      mappings[code] = vendorValue;
    }
  }

  return mappings;
};

// Three-letter CRM currency codes. The CRM itself only issues rial quotations today, but the
// mapping table must be able to state the other codes an operator may need, so the shape is
// general while the gate below still refuses a non-rial document.
export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

// A currency conversion rate is an exact decimal. Six places is the scale the money domain
// already uses, and a rate that needs rounding is refused rather than rounded: a rounded
// rate changes what the customer owes.
export const CONVERSION_RATE_PATTERN = /^(0|[1-9]\d*)(\.\d{1,6})?$/;

export const isConversionRateUsable = (value: string): boolean =>
  CONVERSION_RATE_PATTERN.test(value.trim()) &&
  Number(value.trim()) > 0;

// Reads what was stored. A record from before this block existed gets the conservative
// default; an unreadable value never throws, because a settings page must still open.
export const financialSettingsFromRecord = (
  value: unknown,
): FinancialSettings => {
  const raw = asRecord(value);
  const baseCurrency = readString(raw.baseCurrency).toUpperCase();
  const conversionRate = readString(raw.conversionRate);
  const profile = raw.mockProfile;

  return {
    baseCurrency:
      CURRENCY_CODE_PATTERN.test(baseCurrency) ? baseCurrency : 'IRR',
    currencyMappings: readMappings(raw.currencyMappings),
    conversionRate: isConversionRateUsable(conversionRate)
      ? conversionRate
      : '',
    mockProfile: isMockProfile(profile) ? profile : DEFAULT_MOCK_PROFILE,
  };
};

// The write path. Invalid input is refused with a code the form can show next to the field,
// rather than stored and discovered at send time.
export const parseFinancialSettings = (
  value: unknown,
  options: { adapterId: string },
): Result<FinancialSettings> => {
  const raw = asRecord(value);
  const baseCurrency = readString(raw.baseCurrency).toUpperCase();

  if (baseCurrency !== '' && !CURRENCY_CODE_PATTERN.test(baseCurrency)) {
    return refused(
      'CURRENCY_BASE_INVALID',
      'base currency must be a three-letter code such as IRR',
    );
  }

  const mappings = readMappings(raw.currencyMappings);

  for (const [code, vendorValue] of Object.entries(mappings)) {
    if (!CURRENCY_CODE_PATTERN.test(code)) {
      return refused(
        'CURRENCY_CODE_INVALID',
        `"${code}" is not a three-letter currency code`,
      );
    }

    if (vendorValue.length > MAX_CURRENCY_VALUE_LENGTH) {
      return refused(
        'CURRENCY_CODE_INVALID',
        'a destination currency code or name is too long',
      );
    }
  }

  const rateText = readString(raw.conversionRate);

  if (rateText !== '' && !isConversionRateUsable(rateText)) {
    return refused(
      'CURRENCY_RATE_INVALID',
      'the conversion rate must be an exact positive decimal with at most six places',
    );
  }

  // A test profile on a live adapter would be a caller describing a capability the real
  // vendor never declared, so it is refused instead of ignored. An unknown adapter id (the
  // default when a caller reads a stored record) skips the check instead of refusing a
  // profile the record legitimately carries.
  const profile = raw.mockProfile;

  if (
    options.adapterId !== '' &&
    options.adapterId !== 'mock' &&
    profile !== undefined &&
    profile !== ''
  ) {
    return refused(
      'MOCK_PROFILE_NOT_ALLOWED',
      'a test profile can only be set on the mock adapter',
    );
  }

  if (
    options.adapterId === 'mock' &&
    profile !== undefined &&
    profile !== '' &&
    !isMockProfile(profile)
  ) {
    return refused(
      'MOCK_PROFILE_UNKNOWN',
      'the requested test profile does not exist',
    );
  }

  return accepted({
    baseCurrency,
    currencyMappings: mappings,
    conversionRate: rateText === '' ? '' : rateText,
    mockProfile: isMockProfile(profile) ? profile : DEFAULT_MOCK_PROFILE,
  });
};

// A single place that answers "may this document travel to this destination, given what it
// needs and what the destination declared?". Both the preview and the dispatch call it, so a
// screen cannot promise a send the dispatcher would refuse.
export type FinancialGateInput = {
  capabilities: AdapterCapabilities;
  financial: FinancialSettings;
  // CRM tax policy code -> the destination's own tax code, from this connection only. ONE
  // code per policy: the destination code represents the whole value-added treatment, so
  // there is no separate duty mapping to satisfy.
  taxPolicyMappings: Record<string, string>;
  document: {
    // The CRM tax policy the document carries, and whether it carries any tax at all.
    taxPolicyCode: string;
    hasTax: boolean;
    // Whether the document carries any duty. A duty-only policy is a real policy, so
    // this is checked on its own rather than inferred from `hasTax`.
    hasDuty?: boolean;
    currencyCode: string;
  };
};

export const checkFinancialRequirements = (
  input: FinancialGateInput,
): Result<null> => {
  const { capabilities, financial, document } = input;

  if (document.hasTax) {
    if (capabilities.taxHandling === 'UNSUPPORTED') {
      return refused(
        'TAX_UNSUPPORTED',
        'this destination cannot carry tax under its documented contract',
      );
    }

    // Only a code-based destination needs a policy mapping. A rate or amount destination
    // reads the figure from the document; asking for a code there would be inventing a
    // field the vendor does not read.
    if (taxModeNeedsVendorCode(capabilities.taxHandling)) {
      const policyCode = document.taxPolicyCode.trim();
      const vendorTaxCode = (input.taxPolicyMappings[policyCode] ?? '').trim();

      if (policyCode === '' || vendorTaxCode === '') {
        return refused(
          'TAX_POLICY_NOT_MAPPED',
          `tax policy "${policyCode}" has no destination tax code on this connection`,
        );
      }
    }
  }

  // Duty is a component of the same policy. A destination that documents no way to carry it
  // at all refuses the document instead of folding duty into tax, which would misstate both
  // figures. A destination that carries duty inside the single policy code needs no second
  // mapping: that code IS the whole policy.
  if (document.hasDuty === true) {
    if (capabilities.dutyHandling === 'UNSUPPORTED') {
      return refused(
        'DUTY_UNSUPPORTED',
        'this destination cannot carry duty under its documented contract',
      );
    }
  }

  if (capabilities.currencyHandling === 'UNSUPPORTED') {
    return refused(
      'CURRENCY_UNSUPPORTED',
      'this destination documents no usable currency contract',
    );
  }

  if (capabilities.currencyHandling === 'SINGLE_CURRENCY') {
    if (!CURRENCY_CODE_PATTERN.test(financial.baseCurrency)) {
      return refused(
        'CURRENCY_BASE_UNCONFIRMED',
        'the base currency of this destination is not confirmed',
      );
    }

    // The document is booked in the destination's own currency or not at all. A
    // document in another currency would need a rate this contract has no field for,
    // and inventing one changes what the customer owes.
    const documentCurrency = document.currencyCode.trim().toUpperCase();

    if (documentCurrency !== financial.baseCurrency) {
      return refused(
        'CURRENCY_BASE_MISMATCH',
        `the document is in ${documentCurrency || 'an unknown currency'} but this connection books every amount in ${financial.baseCurrency}`,
      );
    }

    return accepted(null);
  }

  const documentCurrency = document.currencyCode.trim().toUpperCase();
  const mapped = (financial.currencyMappings[documentCurrency] ?? '').trim();

  if (currencyModeNeedsVendorValue(capabilities.currencyHandling) && mapped === '') {
    return refused(
      capabilities.currencyHandling === 'CURRENCY_NAME'
        ? 'CURRENCY_NAME_MAPPING_REQUIRED'
        : 'CURRENCY_CODE_MAPPING_REQUIRED',
      `currency ${documentCurrency} has no destination code on this connection`,
    );
  }

  // A conversion rate is only needed when the document currency is not the destination's
  // own; converting rial to rial would invent a rounding step nobody asked for.
  if (
    currencyModeNeedsRate(capabilities.currencyHandling) &&
    documentCurrency !== financial.baseCurrency &&
    !isConversionRateUsable(financial.conversionRate)
  ) {
    return refused(
      'CURRENCY_RATE_REQUIRED',
      `currency ${documentCurrency} needs a valid conversion rate on this connection`,
    );
  }

  return accepted(null);
};
