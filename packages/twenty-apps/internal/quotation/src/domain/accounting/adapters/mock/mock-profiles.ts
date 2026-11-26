import {
  type AdapterCapabilities,
  type CurrencyHandlingMode,
  type DutyHandlingMode,
  type TaxHandlingMode,
} from 'src/domain/accounting/capabilities';
import { PARTY_PROFILE_FIELDS } from 'src/domain/accounting/party-profile';
import { ASAN_CAPABILITIES } from 'src/domain/accounting/adapters/asan/asan-capabilities';
import { type TaxCodeContract } from 'src/domain/accounting/tax-code-contract';

// Test-only shapes of a destination. A real vendor declares ONE financial contract, and the
// CRM has to work with each without imposing the others' requirements. The mock therefore
// carries a closed set of profiles instead of a free-form capability object: a profile is
// chosen by name, validated on the server, and expanded here into capabilities. Nothing a
// caller sends can describe a capability that does not exist in this list.
//
// The names are deliberately about the CONTRACT, not about a vendor, so no reader mistakes
// a profile for a claim about how Asan or Sepidar behaves.
//
// Tax and duty are declared separately because they are two components of one CRM policy:
// a destination may take a rate for each, an amount for each, one code that means the whole
// policy, only their combined amount, or nothing at all. There is no "duty code" profile:
// a code-based destination maps ONE code per policy.
export const MOCK_PROFILES = [
  'SIMPLE',
  'PARTY_UAT',
  'CODED',
  'AMOUNT',
  'AGGREGATE',
  'TAX_ONLY',
  'NO_TAX',
] as const;

export type MockProfile = (typeof MOCK_PROFILES)[number];

export const isMockProfile = (value: unknown): value is MockProfile =>
  typeof value === 'string' && (MOCK_PROFILES as readonly string[]).includes(value);

export const DEFAULT_MOCK_PROFILE: MockProfile = 'SIMPLE';

// A destination that identifies the value-added treatment by code publishes the codes it
// defines. The mock's list is small on purpose: it is enough to show that a mapping is
// checked against the destination's own rate, that two policies with the same total but a
// different split are told apart, and that a code this destination does not list is
// reported as unverifiable rather than accepted.
const CODED_PROFILE_CATALOG: readonly TaxCodeContract[] = [
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
];

export const MOCK_PROFILE_DESCRIPTIONS: Record<
  MockProfile,
  {
    label: string;
    tax: TaxHandlingMode;
    duty: DutyHandlingMode;
    currency: CurrencyHandlingMode;
    taxCodeCatalog?: readonly TaxCodeContract[];
    summary: string;
  }
> = {
  SIMPLE: {
    label: 'ساده: فقط نرخ مالیات و عوارض، ارز ثابت',
    tax: 'TAX_RATE',
    duty: 'DUTY_RATE',
    currency: 'SINGLE_CURRENCY',
    summary:
      'نرم‌افزار ساده‌ای که نرخ مالیات و نرخ عوارض را جداگانه می‌گیرد و همه مبالغ را به یک ارز ثبت می‌کند؛ کد مالیات و کد ارز نمی‌خواهد.',
  },
  PARTY_UAT: {
    label: 'داده آزمایشی ۱۰۰ مشتری',
    tax: 'TAX_RATE', duty: 'DUTY_RATE', currency: 'SINGLE_CURRENCY',
    summary: 'فقط داده ساختگی برای آزمون همگام‌سازی، بدون ارتباط با حسابداری واقعی.',
  },
  CODED: {
    label: 'کدمحور: یک کد مالیات برای هر سیاست، کد ارز',
    tax: 'TAX_CODE',
    duty: 'DUTY_WITHIN_POLICY',
    currency: 'CURRENCY_CODE',
    taxCodeCatalog: CODED_PROFILE_CATALOG,
    summary:
      'نرم‌افزاری که برای هر سیاست یک کد مالیات واحد می‌خواهد؛ همان کد کل ارزش افزوده (مالیات + عوارض) را نمایندگی می‌کند و مقصد تفکیک را طبق تعریف خودش انجام می‌دهد.',
  },
  AMOUNT: {
    label: 'مبلغ‌محور: مبلغ مالیات و مبلغ عوارض، ارز ثابت',
    tax: 'TAX_AMOUNT',
    duty: 'DUTY_AMOUNT',
    currency: 'SINGLE_CURRENCY',
    summary:
      'نرم‌افزاری که مبلغ نهایی مالیات و مبلغ عوارض را جداگانه می‌گیرد و کد نمی‌خواهد؛ همه مبالغ به یک ارز ثبت می‌شود.',
  },
  AGGREGATE: {
    label: 'تجمیعی: فقط جمع مالیات و عوارض',
    tax: 'TAX_AMOUNT',
    duty: 'AGGREGATE',
    currency: 'SINGLE_CURRENCY',
    summary:
      'قرارداد صریحی که فقط جمع مالیات و عوارض را در یک فیلد می‌پذیرد؛ تفکیک دو مؤلفه در سند CRM می‌ماند و جمع به مقصد می‌رود.',
  },
  TAX_ONLY: {
    label: 'فقط مالیات؛ بدون قابلیت عوارض',
    tax: 'TAX_RATE',
    duty: 'UNSUPPORTED',
    currency: 'SINGLE_CURRENCY',
    summary:
      'نرم‌افزاری که مالیات را می‌پذیرد اما مفهوم عوارض ندارد؛ سیاست دارای عوارض به‌جای حذف بی‌صدا، رد می‌شود.',
  },
  NO_TAX: {
    label: 'بدون پشتیبانی مالیات و عوارض',
    tax: 'UNSUPPORTED',
    duty: 'UNSUPPORTED',
    currency: 'SINGLE_CURRENCY',
    summary:
      'قرارداد فعلی این مقصد امکان انتقال مالیات و عوارض را ندارد؛ سند مشمول مالیات به‌جای ارسال بدون مالیات، رد می‌شود.',
  },
};

export const mockProfileCapabilities = (
  profile: MockProfile,
): AdapterCapabilities => {
  const entry = MOCK_PROFILE_DESCRIPTIONS[profile];

  return {
    ...ASAN_CAPABILITIES,
    parties: { ...ASAN_CAPABILITIES.parties, fields: {
      contractVersion: '2', identity: 'EXTERNAL_ID',
      readable: ['code', 'fullName', 'mobile', 'nationalCode', ...PARTY_PROFILE_FIELDS],
      writable: ['fullName', 'mobile', 'nationalCode', ...PARTY_PROFILE_FIELDS],
    } },
    taxHandling: entry.tax,
    dutyHandling: entry.duty,
    currencyHandling: entry.currency,
    // A single-currency mock books rial, like a simple Iranian installation. A code-based
    // one has no fixed base and therefore declares none.
    baseCurrency: entry.currency === 'SINGLE_CURRENCY' ? 'IRR' : '',
    // The documented special-row codes belong to Asan, not to a mock destination. A mock
    // profile has no vendor installation, so it declares none — and a panel that showed a
    // row-code field for it would be describing a vendor it does not stand in for.
    requiresSpecialItemCodes: false,
    ...(entry.taxCodeCatalog === undefined
      ? {}
      : { taxCodeCatalog: entry.taxCodeCatalog }),
  };
};
