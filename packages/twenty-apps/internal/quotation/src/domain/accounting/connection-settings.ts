import { accepted, refused, type Result } from 'src/domain/shared/result';
import {
  ACCOUNTING_MONEY_UNITS,
  type AccountingMoneyUnit,
  type ConnectionSettings,
} from 'src/domain/accounting/adapter-contract';

// What a connection record may carry. Only NON-SECRET configuration lives here: the record
// is readable through the API, appears in exports and is copied into backups, so a token in
// it would leak. Credentials stay in the platform's encrypted application variables and are
// never written to this record.
export const DEFAULT_CONNECTION_SETTINGS: ConnectionSettings = {
  baseUrl: '',
  remoteUserId: '',
  defaultStorageId: '',
  moneyUnit: 'UNCONFIRMED',
  transportApproved: false,
  specialCodes: { discount: false, duty: false, tax: false },
  taxPolicyMappings: {},
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

// A mapping entry is only kept when both sides are usable: a blank vendor code is
// indistinguishable from "not mapped" and must not authorize a tax line.
const parseTaxPolicyMappings = (
  value: unknown,
): Record<string, string> => {
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

// Mappings used to live inside `specialCodes`; the current shape keeps them at the
// top level. Reading both means an older record keeps working, and a top-level
// entry wins because it is the one the settings page writes.
const readTaxPolicyMappings = (
  raw: Record<string, unknown>,
  specialCodes: Record<string, unknown>,
): Record<string, string> => ({
  ...parseTaxPolicyMappings(specialCodes.taxPolicyMappings),
  ...parseTaxPolicyMappings(raw.taxPolicyMappings),
});

export const normalizeMoneyUnit = (value: unknown): AccountingMoneyUnit =>
  typeof value === 'string' &&
  (ACCOUNTING_MONEY_UNITS as readonly string[]).includes(value)
    ? (value as AccountingMoneyUnit)
    : 'UNCONFIRMED';

// A vendor base URL is typed by a person, so it is validated rather than trusted. It must
// be absolute and credential-free: a password inside the URL would end up in a log line
// and in the connection record, which is exactly where a secret must never be.
export const parseBaseUrl = (value: string): Result<string> => {
  const trimmed = value.trim().replace(/\/+$/, '');

  if (trimmed === '') {
    return refused(
      'CONNECTION_BASE_URL_REQUIRED',
      'a connection needs the vendor service address',
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return refused(
      'CONNECTION_BASE_URL_INVALID',
      'the service address is not a valid absolute URL',
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return refused(
      'CONNECTION_BASE_URL_INVALID',
      'the service address must start with http:// or https://',
    );
  }

  if (parsed.username !== '' || parsed.password !== '') {
    return refused(
      'CONNECTION_BASE_URL_HAS_CREDENTIALS',
      'do not put a user name or password in the service address',
    );
  }

  if (parsed.search !== '' || parsed.hash !== '') {
    return refused(
      'CONNECTION_BASE_URL_INVALID',
      'the service address must not carry a query string or a fragment',
    );
  }

  return accepted(trimmed);
};

const parseNumericSetting = (
  value: string,
  code: string,
  label: string,
): Result<string> => {
  if (value === '') {
    return accepted('');
  }

  if (!/^\d+$/.test(value)) {
    return refused(code, `${label} must be a whole number`);
  }

  return accepted(value);
};

export const parseConnectionSettings = (
  input: unknown,
): Result<ConnectionSettings> => {
  const raw = asRecord(input);
  const baseUrl = parseBaseUrl(readString(raw.baseUrl));

  if (!baseUrl.ok) {
    return baseUrl;
  }

  const remoteUserId = parseNumericSetting(
    readString(raw.remoteUserId),
    'CONNECTION_REMOTE_USER_INVALID',
    'the vendor user id',
  );

  if (!remoteUserId.ok) {
    return remoteUserId;
  }

  const defaultStorageId = parseNumericSetting(
    readString(raw.defaultStorageId),
    'CONNECTION_STORAGE_INVALID',
    'the warehouse id',
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
    transportApproved: readBoolean(raw.transportApproved, false),
    specialCodes: {
      discount: readBoolean(specialCodes.discount, false),
      duty: readBoolean(specialCodes.duty, false),
      tax: readBoolean(specialCodes.tax, false),
    },
    taxPolicyMappings: readTaxPolicyMappings(raw, specialCodes),
  });
};

// Reads back what was stored. A record written before a field existed reads as the safe
// default instead of failing, so an upgraded workspace can still open its connection.
export const connectionSettingsFromRecord = (
  record: unknown,
): ConnectionSettings => {
  const raw = asRecord(record);
  const specialCodes = asRecord(raw.specialCodes);
  const baseUrl = readString(raw.baseUrl);
  const parsedUrl = baseUrl === '' ? null : parseBaseUrl(baseUrl);

  return {
    baseUrl: parsedUrl?.ok === true ? parsedUrl.value : baseUrl,
    remoteUserId: readString(raw.remoteUserId),
    defaultStorageId: readString(raw.defaultStorageId),
    moneyUnit: normalizeMoneyUnit(raw.moneyUnit),
    transportApproved: readBoolean(raw.transportApproved, false),
    specialCodes: {
      discount: readBoolean(specialCodes.discount, false),
      duty: readBoolean(specialCodes.duty, false),
      tax: readBoolean(specialCodes.tax, false),
    },
    taxPolicyMappings: readTaxPolicyMappings(raw, specialCodes),
  };
};

// Writes are refused for a destination that cannot carry them safely: real money must not
// cross a transport nobody approved, and a document with amounts must not be sent while the
// remote unit is unconfirmed.
export const checkConnectionWritable = ({
  settings,
  requiresMoney,
}: {
  settings: ConnectionSettings;
  requiresMoney: boolean;
}): Result<ConnectionSettings> => {
  if (!settings.transportApproved) {
    return refused(
      'TRANSPORT_NOT_APPROVED',
      'this destination documents an insecure transport; approve a tunnel before any write',
    );
  }

  if (requiresMoney && settings.moneyUnit === 'UNCONFIRMED') {
    return refused(
      'MONEY_UNIT_UNCONFIRMED',
      'the vendor amount unit is not confirmed; amounts must not be transferred yet',
    );
  }

  return accepted(settings);
};
