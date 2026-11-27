// What a stored accounting destination may carry, decided at the server boundary.
//
// The app already parses its own settings, but a person's save now arrives here, and a
// value that only the browser validated is not validated: the destination address is
// what the worker will later call, so it is checked for transport and for the private
// networks a member must not be able to point the CRM at.

import { accountingAdapterContract } from 'src/modules/quotation/utils/accounting-adapter-contract.util';
import {
  checkStorableDestination,
  type AllowlistEntry,
} from 'src/modules/quotation/utils/accounting-destination-policy.util';

const ACCOUNTING_MONEY_UNITS = ['UNCONFIRMED', 'RIAL', 'TOMAN'] as const;

export type AccountingMoneyUnit = (typeof ACCOUNTING_MONEY_UNITS)[number];

// The closed set of destination contracts the mock adapter can stand in for. Because this is
// a list, a caller cannot describe a capability that does not exist: they may only name one
// of these profiles, and the server expands it into the capabilities it stores.
export const MOCK_PROFILES = [
  'SIMPLE',
  'PARTY_UAT', // Internal fixture dataset; same financial contract as SIMPLE.
  'CODED',
  'AMOUNT',
  'AGGREGATE',
  'TAX_ONLY',
  'NO_TAX',
] as const;

export type MockProfile = (typeof MOCK_PROFILES)[number];

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const CONVERSION_RATE_PATTERN = /^(0|[1-9]\d*)(\.\d{1,6})?$/;
const MAX_CURRENCY_MAPPINGS = 40;
const MAX_CURRENCY_VALUE_LENGTH = 32;

export type AccountingFinancialSettings = {
  baseCurrency: string;
  currencyMappings: Record<string, string>;
  conversionRate: string;
  mockProfile: MockProfile;
};

export type AccountingConnectionSettings = {
  baseUrl: string;
  remoteUserId: string;
  defaultStorageId: string;
  moneyUnit: AccountingMoneyUnit;
  transportApproved: boolean;
  specialCodes: {
    discount: boolean;
    duty: boolean;
    tax: boolean;
    // The installation's own special-row item codes. A row code identifies WHICH row an
    // amount is posted under; it is not a tax policy id and never a rate.
    specialItemCodes?: {
      discount?: string;
      duty?: string;
      tax?: string;
    };
    // ONE destination code per CRM tax policy. That code stands for the whole value-added
    // treatment (tax + duty); there is no separate duty mapping.
    taxPolicyMappings?: Record<string, string>;
  };
  financial: AccountingFinancialSettings;
};

export type ConnectionSettingRefusal = {
  ok: false;
  code: string;
  message: string;
};

export type ConnectionSettingAcceptance<TValue> = {
  ok: true;
  value: TValue;
};

export type ConnectionSettingResult<TValue> =
  | ConnectionSettingAcceptance<TValue>
  | ConnectionSettingRefusal;

const accepted = <TValue>(
  value: TValue,
): ConnectionSettingAcceptance<TValue> => ({ ok: true, value });

const refused = (
  code: string,
  message: string,
): ConnectionSettingRefusal => ({ ok: false, code, message });

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

export const isKnownAccountingAdapterId = (value: string): boolean =>
  accountingAdapterContract(value) !== null;

// A vendor address is typed by a person, so it is validated rather than trusted: it must
// be absolute and credential-free, because a password inside the URL ends up in a log
// line and in the connection record, which is exactly where a secret must never be.
export const parseAccountingBaseUrl = (
  value: string,
): ConnectionSettingResult<string> => {
  const trimmed = value.trim().replace(/\/+$/, '');

  if (trimmed === '') {
    return refused(
      'CONNECTION_BASE_URL_REQUIRED',
      'آدرس سرویس نرم‌افزار حسابداری لازم است',
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return refused(
      'CONNECTION_BASE_URL_INVALID',
      'آدرس سرویس باید یک نشانی کامل و معتبر باشد',
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return refused(
      'CONNECTION_BASE_URL_INVALID',
      'آدرس سرویس باید با http:// یا https:// شروع شود',
    );
  }

  if (parsed.username !== '' || parsed.password !== '') {
    return refused(
      'CONNECTION_BASE_URL_HAS_CREDENTIALS',
      'نام کاربری یا رمز را در آدرس سرویس نگذارید؛ رمزها فقط در متغیرهای برنامه نگهداری می‌شوند',
    );
  }

  if (parsed.search !== '' || parsed.hash !== '') {
    return refused(
      'CONNECTION_BASE_URL_INVALID',
      'آدرس سرویس نباید پارامتر یا بخش (fragment) داشته باشد',
    );
  }

  return accepted(trimmed);
};

const parseNumericSetting = (
  value: string,
  code: string,
  message: string,
): ConnectionSettingResult<string> => {
  if (value === '') {
    return accepted('');
  }

  return /^\d+$/.test(value) ? accepted(value) : refused(code, message);
};

const parseTaxPolicyMappings = (value: unknown): Record<string, string> => {
  const raw = asRecord(value);
  const mappings: Record<string, string> = {};

  for (const [key, entry] of Object.entries(raw)) {
    const code = key.trim();
    const vendorCode = readString(entry);

    if (code !== '' && vendorCode !== '') {
      mappings[code] = vendorCode;
    }
  }

  return mappings;
};

// The vendor's special-row item codes are numeric product ids; anything else is refused
// rather than stored as a product id the vendor would reject at send time.
const parseSpecialItemCodes = (
  value: unknown,
): NonNullable<AccountingConnectionSettings['specialCodes']['specialItemCodes']> => {
  const raw = asRecord(value);
  const codes: NonNullable<
    AccountingConnectionSettings['specialCodes']['specialItemCodes']
  > = {};

  for (const key of ['discount', 'duty', 'tax'] as const) {
    const code = readString(raw[key]);

    if (/^\d+$/.test(code)) {
      codes[key] = code;
    }
  }

  return codes;
};

const normalizeMoneyUnit = (value: unknown): AccountingMoneyUnit =>
  typeof value === 'string' &&
    (ACCOUNTING_MONEY_UNITS as readonly string[]).includes(value)
    ? (value as AccountingMoneyUnit)
    : 'UNCONFIRMED';

const isMockProfile = (value: unknown): value is MockProfile =>
  typeof value === 'string' && (MOCK_PROFILES as readonly string[]).includes(value);

const parseFinancialSettings = (
  value: unknown,
  adapterId: string,
): ConnectionSettingResult<AccountingFinancialSettings> => {
  const raw = asRecord(value);
  const baseCurrency = readString(raw.baseCurrency).toUpperCase();

  if (baseCurrency !== '' && !CURRENCY_CODE_PATTERN.test(baseCurrency)) {
    return refused(
      'CURRENCY_BASE_INVALID',
      'ارز پایه باید یک کد سه‌حرفی مانند IRR باشد',
    );
  }

  const mappings: Record<string, string> = {};
  const rawMappings = asRecord(raw.currencyMappings);

  for (const [key, entry] of Object.entries(rawMappings)) {
    const code = key.trim().toUpperCase();
    const vendorValue = readString(entry);

    if (vendorValue === '') {
      continue;
    }

    if (!CURRENCY_CODE_PATTERN.test(code)) {
      return refused(
        'CURRENCY_CODE_INVALID',
        'کد ارز CRM باید سه‌حرفی و با حروف بزرگ باشد',
      );
    }

    if (vendorValue.length > MAX_CURRENCY_VALUE_LENGTH) {
      return refused(
        'CURRENCY_CODE_INVALID',
        'کد یا نام ارز مقصد بیش از حد بلند است',
      );
    }

    if (Object.keys(mappings).length >= MAX_CURRENCY_MAPPINGS) {
      return refused(
        'CURRENCY_CODE_INVALID',
        'تعداد نگاشت‌های ارز بیش از حد مجاز است',
      );
    }

    mappings[code] = vendorValue;
  }

  const conversionRate = readString(raw.conversionRate);

  if (
    conversionRate !== '' &&
    (!CONVERSION_RATE_PATTERN.test(conversionRate) ||
      Number(conversionRate) <= 0)
  ) {
    return refused(
      'CURRENCY_RATE_INVALID',
      'نرخ تبدیل باید عددی مثبت و دقیق با حداکثر شش رقم اعشار باشد',
    );
  }

  // A test profile is only meaningful for the mock adapter. Refusing it for a live adapter
  // stops a caller from describing a capability the real vendor never declared.
  const profile = raw.mockProfile;

  if (adapterId !== 'mock' && profile !== undefined && profile !== '') {
    return refused(
      'MOCK_PROFILE_NOT_ALLOWED',
      'حالت آزمایشی فقط برای اتصال آزمایشی قابل انتخاب است',
    );
  }

  if (
    adapterId === 'mock' &&
    profile !== undefined &&
    profile !== '' &&
    !isMockProfile(profile)
  ) {
    return refused('MOCK_PROFILE_UNKNOWN', 'حالت آزمایشی انتخاب‌شده وجود ندارد');
  }

  return accepted({
    baseCurrency,
    currencyMappings: mappings,
    conversionRate,
    mockProfile: isMockProfile(profile) ? profile : 'SIMPLE',
  });
};

// The whole settings object, not a patch: a save replaces the destination's
// configuration, so a field the operator cleared must clear, not linger.
export const parseAccountingConnectionSettings = (
  input: unknown,
  options: {
    privateDestinationAllowlist?: readonly AllowlistEntry[];
    adapterId?: string;
  } = {},
): ConnectionSettingResult<AccountingConnectionSettings> => {
  const raw = asRecord(input);
  const baseUrl = parseAccountingBaseUrl(readString(raw.baseUrl));

  if (!baseUrl.ok) {
    return baseUrl;
  }

  const transportApproved = readBoolean(raw.transportApproved, false);
  const parsedUrl = new URL(baseUrl.value);
  const hostname = parsedUrl.hostname;
  const port =
    parsedUrl.port === '' ? null : Number.parseInt(parsedUrl.port, 10);

  // `transportApproved` says "an insecure transport may carry a write"; it is not an
  // egress permission. A private destination additionally needs an operator allowlist
  // entry, so approving the tunnel cannot silently grant the whole internal network.
  const destination = checkStorableDestination({
    hostname,
    port,
    transportApproved,
    allowlist: options.privateDestinationAllowlist ?? [],
  });

  if (!destination.ok) {
    return refused(destination.code, destination.message);
  }

  const remoteUserId = parseNumericSetting(
    readString(raw.remoteUserId),
    'CONNECTION_REMOTE_USER_INVALID',
    'شناسهٔ کاربر مقصد باید عدد باشد',
  );

  if (!remoteUserId.ok) {
    return remoteUserId;
  }

  const defaultStorageId = parseNumericSetting(
    readString(raw.defaultStorageId),
    'CONNECTION_STORAGE_INVALID',
    'شناسهٔ انبار باید عدد باشد',
  );

  if (!defaultStorageId.ok) {
    return defaultStorageId;
  }

  const specialCodes = asRecord(raw.specialCodes);
  // The settings page sends the tax codes at the top level of the settings object, while
  // records written before this field moved kept them inside `specialCodes`. Reading both
  // means a code typed today is stored instead of silently dropped, and an older record
  // still saves without losing what it already had.
  const taxPolicyMappings = {
    ...parseTaxPolicyMappings(specialCodes.taxPolicyMappings),
    ...parseTaxPolicyMappings(raw.taxPolicyMappings),
  };
  // Row codes may arrive nested or at the top level, for the same compatibility reason.
  const specialItemCodes = {
    ...parseSpecialItemCodes(specialCodes.specialItemCodes),
    ...parseSpecialItemCodes(raw.specialItemCodes),
  };
  const financial = parseFinancialSettings(
    raw.financial,
    options.adapterId ?? '',
  );

  if (!financial.ok) {
    return financial;
  }

  return accepted({
    baseUrl: baseUrl.value,
    remoteUserId: remoteUserId.value,
    defaultStorageId: defaultStorageId.value,
    moneyUnit: normalizeMoneyUnit(raw.moneyUnit),
    transportApproved,
    specialCodes: {
      discount: readBoolean(specialCodes.discount, false),
      duty: readBoolean(specialCodes.duty, false),
      tax: readBoolean(specialCodes.tax, false),
      ...(Object.keys(specialItemCodes).length === 0
        ? {}
        : { specialItemCodes }),
      ...(Object.keys(taxPolicyMappings).length === 0
        ? {}
        : { taxPolicyMappings }),
    },
    financial: financial.value,
  });
};

// The fields a settings write owns. `capabilities`, health and verification are not
// among them: they are evidence produced by a test, and a save must not fake them.
export const accountingConnectionColumnsFromSettings = (
  settings: AccountingConnectionSettings,
): Record<string, unknown> => ({
  baseUrl: settings.baseUrl,
  remoteUserId: settings.remoteUserId,
  defaultStorageId: settings.defaultStorageId,
  moneyUnit: settings.moneyUnit,
  transportApproved: settings.transportApproved,
  specialCodes: settings.specialCodes,
  financialSettings: settings.financial,
  // A changed address or unit makes any earlier green check meaningless.
  healthState: 'UNKNOWN',
  lastHealthMessage: 'تنظیمات اتصال تغییر کرد؛ آزمایش اتصال دوباره لازم است.',
});
