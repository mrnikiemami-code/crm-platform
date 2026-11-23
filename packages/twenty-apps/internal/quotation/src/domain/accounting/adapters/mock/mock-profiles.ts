import {
  type AdapterCapabilities,
  type CurrencyHandlingMode,
  type TaxHandlingMode,
} from 'src/domain/accounting/capabilities';
import { ASAN_CAPABILITIES } from 'src/domain/accounting/adapters/asan/asan-capabilities';

// Test-only shapes of a destination. A real vendor declares ONE financial contract, and the
// CRM has to work with each without imposing the others' requirements. The mock therefore
// carries a closed set of profiles instead of a free-form capability object: a profile is
// chosen by name, validated on the server, and expanded here into capabilities. Nothing a
// caller sends can describe a capability that does not exist in this list.
//
// The names are deliberately about the CONTRACT, not about a vendor, so no reader mistakes
// a profile for a claim about how Asan or Sepidar behaves.
export const MOCK_PROFILES = ['SIMPLE', 'CODED', 'AMOUNT', 'NO_TAX'] as const;

export type MockProfile = (typeof MOCK_PROFILES)[number];

export const isMockProfile = (value: unknown): value is MockProfile =>
  typeof value === 'string' && (MOCK_PROFILES as readonly string[]).includes(value);

export const DEFAULT_MOCK_PROFILE: MockProfile = 'SIMPLE';

export const MOCK_PROFILE_DESCRIPTIONS: Record<
  MockProfile,
  {
    label: string;
    tax: TaxHandlingMode;
    currency: CurrencyHandlingMode;
    summary: string;
  }
> = {
  SIMPLE: {
    label: 'ساده: فقط نرخ مالیات و ارز ثابت',
    tax: 'TAX_RATE',
    currency: 'SINGLE_CURRENCY',
    summary:
      'نرم‌افزار ساده‌ای که نرخ مالیات را می‌گیرد و همه مبالغ را به یک ارز ثبت می‌کند؛ کد مالیات و کد ارز نمی‌خواهد.',
  },
  CODED: {
    label: 'کدمحور: کد مالیات و کد ارز',
    tax: 'TAX_CODE',
    currency: 'CURRENCY_CODE',
    summary:
      'نرم‌افزاری که برای هر سیاست مالیات یک کد ویژه و برای هر ارز یک کد می‌خواهد؛ بدون نگاشت معتبر، سند ارسال نمی‌شود.',
  },
  AMOUNT: {
    label: 'مبلغ‌محور: مبلغ مالیات و ارز ثابت',
    tax: 'TAX_AMOUNT',
    currency: 'SINGLE_CURRENCY',
    summary:
      'نرم‌افزاری که مبلغ نهایی مالیات را می‌گیرد و کد مالیات نمی‌خواهد؛ همه مبالغ به یک ارز ثبت می‌شود.',
  },
  NO_TAX: {
    label: 'بدون پشتیبانی مالیات',
    tax: 'UNSUPPORTED',
    currency: 'SINGLE_CURRENCY',
    summary:
      'قرارداد فعلی این مقصد امکان انتقال مالیات را ندارد؛ سند مشمول مالیات به‌جای ارسال بدون مالیات، رد می‌شود.',
  },
};

export const mockProfileCapabilities = (
  profile: MockProfile,
): AdapterCapabilities => {
  const entry = MOCK_PROFILE_DESCRIPTIONS[profile];

  return {
    ...ASAN_CAPABILITIES,
    taxHandling: entry.tax,
    currencyHandling: entry.currency,
    // A single-currency mock books rial, like a simple Iranian installation. A code-based
    // one has no fixed base and therefore declares none.
    baseCurrency: entry.currency === 'SINGLE_CURRENCY' ? 'IRR' : '',
    // Only a destination that identifies tax by a code needs a pre-existing tax row. A
    // destination that reads a rate or an amount has no such row, so the CRM must not ask
    // its user to confirm one.
    requiresSpecialItemCodes: entry.tax === 'TAX_CODE',
  };
};
