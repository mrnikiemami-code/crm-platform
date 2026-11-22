// What a stored accounting destination may carry, decided at the server boundary.
//
// The app already parses its own settings, but a person's save now arrives here, and a
// value that only the browser validated is not validated: the destination address is
// what the worker will later call, so it is checked for transport and for the private
// networks a member must not be able to point the CRM at.

const ACCOUNTING_MONEY_UNITS = ['UNCONFIRMED', 'RIAL', 'TOMAN'] as const;

const ACCOUNTING_ADAPTER_IDS = ['mock', 'asan'] as const;

export type AccountingMoneyUnit = (typeof ACCOUNTING_MONEY_UNITS)[number];

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
    taxPolicyMappings?: Record<string, string>;
  };
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
  (ACCOUNTING_ADAPTER_IDS as readonly string[]).includes(value);

// A host literal that names the machine itself or a network behind it. Resolving DNS
// here would make validation depend on the resolver's answer at save time, which is not
// the answer the worker gets later; literal ranges are the part that can be decided now.
const isPrivateNetworkHost = (hostname: string): boolean => {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host.endsWith('.localhost')) {
    return true;
  }

  if (host === '::1' || host === '::' || host.startsWith('fd') || host.startsWith('fc')) {
    return true;
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);

  if (ipv4 === null) {
    return false;
  }

  const [first, second] = [Number(ipv4[1]), Number(ipv4[2])];

  if (first === 127 || first === 10 || first === 0) {
    return true;
  }

  if (first === 169 && second === 254) {
    return true;
  }

  if (first === 192 && second === 168) {
    return true;
  }

  return first === 172 && second >= 16 && second <= 31;
};

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

const normalizeMoneyUnit = (value: unknown): AccountingMoneyUnit =>
  typeof value === 'string' &&
  (ACCOUNTING_MONEY_UNITS as readonly string[]).includes(value)
    ? (value as AccountingMoneyUnit)
    : 'UNCONFIRMED';

// The whole settings object, not a patch: a save replaces the destination's
// configuration, so a field the operator cleared must clear, not linger.
export const parseAccountingConnectionSettings = (
  input: unknown,
): ConnectionSettingResult<AccountingConnectionSettings> => {
  const raw = asRecord(input);
  const baseUrl = parseAccountingBaseUrl(readString(raw.baseUrl));

  if (!baseUrl.ok) {
    return baseUrl;
  }

  const transportApproved = readBoolean(raw.transportApproved, false);
  const hostname = new URL(baseUrl.value).hostname;

  // A destination inside the private network is reachable only after a person approved
  // the transport. Otherwise a settings save would be a way to aim the worker at an
  // internal address it can reach and the member cannot.
  if (isPrivateNetworkHost(hostname) && !transportApproved) {
    return refused(
      'CONNECTION_PRIVATE_NETWORK_NOT_APPROVED',
      'آدرس سرویس در شبکهٔ داخلی است؛ برای این مقصد تأیید انتقال امن لازم است',
    );
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
      ...(Object.keys(parseTaxPolicyMappings(specialCodes.taxPolicyMappings))
        .length === 0
        ? {}
        : {
            taxPolicyMappings: parseTaxPolicyMappings(
              specialCodes.taxPolicyMappings,
            ),
          }),
    },
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
  // A changed address or unit makes any earlier green check meaningless.
  healthState: 'UNKNOWN',
  lastHealthMessage: 'تنظیمات اتصال تغییر کرد؛ آزمایش اتصال دوباره لازم است.',
});
