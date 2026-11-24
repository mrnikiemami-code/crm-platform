import { type CSSProperties, type ReactNode } from 'react';

import { type QuotationDocumentPreview } from 'src/domain/accounting/document-preview';

// Shared vocabulary for the two accounting surfaces: the workspace settings page and the
// quotation record tab. Both read the same records and label them the same way; neither
// keeps its own copy of the connection form or of the adapter contract.

export type CapabilityRow = {
  area: string;
  key: string;
  label: string;
  value: string;
};

export type TaxCodeContractView = {
  code: string;
  label: string;
  totalRateBasisPoints: string;
  taxRateBasisPoints?: string;
  dutyRateBasisPoints?: string;
};

export type AdapterDescriptor = {
  id: string;
  label: string;
  vendor: string;
  contractVersion: string;
  isLive: boolean;
  transportIsSecure: boolean;
  readiness: string;
  summary: string;
  limitations: string[];
  // Present for an adapter that declares one financial contract. A mock declares `null`
  // because its contract comes from the profile stored on the connection.
  taxHandling?: string | null;
  // Duty is declared apart from tax: a destination may carry one component, both, only
  // their sum, or carry duty inside the single tax code it already requires.
  dutyHandling?: string | null;
  currencyHandling?: string | null;
  baseCurrency?: string;
  requiresSpecialItemCodes?: boolean;
  // The destination's own tax codes and the rates they stand for, when it publishes them.
  taxCodeCatalog?: TaxCodeContractView[];
  testProfiles?: {
    id: string;
    label: string;
    summary: string;
    taxHandling: string;
    dutyHandling: string;
    currencyHandling: string;
    baseCurrency?: string;
    requiresSpecialItemCodes?: boolean;
    taxCodeCatalog?: TaxCodeContractView[];
  }[];
};

export type ConnectionFinancialSettings = {
  baseCurrency: string;
  currencyMappings: Record<string, string>;
  conversionRate: string;
  mockProfile: string;
};

export type ConnectionSettings = {
  baseUrl: string;
  remoteUserId: string;
  defaultStorageId: string;
  moneyUnit: string;
  transportApproved: boolean;
  specialCodes: { discount: boolean; duty: boolean; tax: boolean };
  // The installation's own special-row item codes (Asan's 999123 / 999140 / 999141, or
  // whatever this installation numbered them). A row code identifies WHICH row an amount is
  // posted under; it is not a tax policy id and never a rate.
  specialItemCodes?: { discount?: string; duty?: string; tax?: string };
  // CRM tax policy -> ONE destination code for that policy. The destination code represents
  // the whole value-added treatment, so there is no duty-specific mapping.
  taxPolicyMappings?: Record<string, string>;
  financial?: ConnectionFinancialSettings;
};

export type ConnectionRecord = {
  id: string;
  name: string;
  adapterId: string;
  adapterVersion: string | null;
  isActive: boolean;
  isDefault: boolean;
  settings: ConnectionSettings;
  healthState: string;
  lastHealthCheckAt: string | null;
  lastHealthMessage: string | null;
  verificationState: string;
  capabilityRows?: CapabilityRow[];
};

export type ItemRow = {
  externalItemId: string;
  code: string;
  name: string;
  decision: string;
  suggestedInternalItemId: string | null;
  existingLinkId: string | null;
  planPrice: string;
  crmPriceMicros: string | null;
  priceDifferenceMicros: string | null;
  warnings: string[];
};

export type ItemPreview = {
  moneyUnit: string;
  rows: ItemRow[];
  summary: Record<string, number>;
  totalRemoteItems: number;
};

export type PartyRow = {
  externalPartyId: string;
  code: string;
  fullName: string;
  mobile: string | null;
  nationalCode: string | null;
  decision: string;
  warnings: string[];
};

export type PartyCandidate = {
  id: string;
  name: string;
  partyType: 'PERSON' | 'COMPANY';
};

export type PartyPreview = {
  rows: PartyRow[];
  summary: Record<string, number>;
  totalRemoteParties: number;
  crmCandidates?: PartyCandidate[];
};

export type OperationRow = {
  id: string;
  kind: string;
  state: string;
  attempts: number;
  externalDocumentId: string | null;
};

export type AccountingFlags = {
  outboundEnabled: boolean;
  documentExportEnabled: boolean;
};

export type PanelData = {
  connections: ConnectionRecord[];
  adapters: AdapterDescriptor[];
  credentials: { tunnelTokenConfigured: boolean; insecureWritesApproved: boolean };
  flags: AccountingFlags;
  canManage: boolean;
};

export type FormState = {
  id: string | null;
  name: string;
  adapterId: string;
  baseUrl: string;
  remoteUserId: string;
  defaultStorageId: string;
  moneyUnit: string;
  transportApproved: boolean;
  discount: boolean;
  duty: boolean;
  tax: boolean;
  // `CODE=VENDOR_CODE`, one per line. The CRM policy code is not the vendor's fiscal code;
  // an operator states the mapping explicitly. ONE destination code per policy: that code
  // stands for the whole value-added treatment, including duty.
  taxPolicyMappingsText: string;
  // The installation's special-row item codes. Separate from the policy mapping above
  // because a row code says WHICH row an amount is posted under, not which policy it is.
  specialDiscountCode: string;
  specialDutyCode: string;
  specialTaxCode: string;
  // Currency contract of the destination. Under `SINGLE_CURRENCY` only `baseCurrency` is
  // read; under a code mode only `currencyMappingsText` is read.
  baseCurrency: string;
  currencyMappingsText: string;
  conversionRate: string;
  // Test-only mock contract. Refused by the server for a live adapter.
  mockProfile: string;
};

export const EMPTY_FORM: FormState = {
  id: null,
  name: 'آسان',
  adapterId: 'asan',
  baseUrl: '',
  remoteUserId: '',
  defaultStorageId: '',
  moneyUnit: 'UNCONFIRMED',
  transportApproved: false,
  discount: false,
  duty: false,
  tax: false,
  taxPolicyMappingsText: '',
  specialDiscountCode: '',
  specialDutyCode: '',
  specialTaxCode: '',
  baseCurrency: 'IRR',
  currencyMappingsText: '',
  conversionRate: '',
  mockProfile: 'SIMPLE',
};

export const formatTaxPolicyMappingsText = (
  mappings: Record<string, string> | undefined,
): string =>
  Object.entries(mappings ?? {})
    .map(([code, vendorCode]) => `${code}=${vendorCode}`)
    .join('\n');

// The same `CODE=VALUE` text shape is used for both mapping editors, so one parser keeps the
// stored form and the shown form identical. Blank or half-typed lines are dropped rather
// than stored: a code with no destination value is not a mapping.
export const parseKeyValueLines = (text: string): Record<string, string> => {
  const mappings: Record<string, string> = {};

  for (const line of text.split(/\r?\n/)) {
    const separatorIndex = line.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const code = line.slice(0, separatorIndex).trim();
    const vendorCode = line.slice(separatorIndex + 1).trim();

    if (code !== '' && vendorCode !== '') {
      mappings[code] = vendorCode;
    }
  }

  return mappings;
};

export const formatKeyValueLines = (
  mappings: Record<string, string> | undefined,
): string =>
  Object.entries(mappings ?? {})
    .map(([code, vendorCode]) => `${code}=${vendorCode}`)
    .join('\n');

// Writes one row of a mapping table back into the same text the parser reads, keeping every
// other row (and any duplicate keys an operator typed) intact.
export const setMappingRow = (
  text: string,
  code: string,
  vendorValue: string,
): string => {
  const next = vendorValue.trim();
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  let replaced = false;

  const rewritten = lines.map((line) => {
    const separatorIndex = line.indexOf('=');

    if (separatorIndex < 0) {
      return line;
    }

    if (line.slice(0, separatorIndex).trim() !== code) {
      return line;
    }

    replaced = true;

    return next === '' ? '' : `${code}=${next}`;
  });

  if (!replaced && next !== '') {
    rewritten.push(`${code}=${next}`);
  }

  return rewritten.filter((line) => line !== '').join('\n');
};

export const parseTaxPolicyMappingsText = (
  text: string,
): Record<string, string> => parseKeyValueLines(text);

export const DECISION_LABELS: Record<string, string> = {
  CREATE: 'ایجاد در CRM',
  LINK_SUGGESTED: 'پیشنهاد اتصال',
  LINK_AMBIGUOUS: 'اتصال مبهم',
  IN_SYNC: 'هم‌اکنون هم‌خوان',
  REMOTE_CHANGED: 'تغییر در مقصد',
  DUPLICATE_REMOTE_CODE: 'کد تکراری در مقصد',
  NEEDS_CRM_RECORD: 'نیازمند رکورد CRM',
  AMBIGUOUS_CRM_MATCH: 'تطبیق مبهم در CRM',
};

export const VERIFICATION_LABELS: Record<string, string> = {
  MOCK: 'آزمایشی (بدون تماس واقعی)',
  MOCK_ONLY: 'فقط آزمایشی (بدون تماس واقعی)',
  LIVE_UNVERIFIED: 'فعال، تأییدنشده',
  LIVE_VERIFIED: 'فعال و تأییدشده',
};

// Five honest states, never fewer. A green badge means a real server answered; a mock's
// success is labelled simulated, and a destination that was configured but never probed says
// so instead of borrowing the word "connected".
export const CONNECTION_HEALTH_STATES = [
  'MOCK',
  'CONFIGURED_NOT_TESTED',
  'LIVE_VERIFIED',
  'FAILED',
  'INCOMPLETE',
] as const;

export type ConnectionHealthState = (typeof CONNECTION_HEALTH_STATES)[number];

export const CONNECTION_HEALTH_LABELS: Record<ConnectionHealthState, string> = {
  MOCK: 'آزمایشی — Mock',
  CONFIGURED_NOT_TESTED: 'تنظیم‌شده، بررسی‌نشده',
  LIVE_VERIFIED: 'اتصال واقعی تأییدشده',
  FAILED: 'ارتباط برقرار نشد',
  INCOMPLETE: 'تنظیمات ناقص',
};

export const isLiveConnectionConfigured = (
  settings: ConnectionSettings,
): boolean =>
  settings.baseUrl.trim() !== '' && settings.moneyUnit !== 'UNCONFIRMED';

export const connectionHealthState = (
  connection: Pick<
    ConnectionRecord,
    'adapterId' | 'healthState' | 'verificationState' | 'settings'
  >,
): ConnectionHealthState => {
  if (connection.adapterId === 'mock' || connection.verificationState === 'MOCK') {
    return 'MOCK';
  }

  if (!isLiveConnectionConfigured(connection.settings)) {
    return 'INCOMPLETE';
  }

  if (connection.healthState === 'FAILED') {
    return 'FAILED';
  }

  if (
    connection.healthState === 'OK' &&
    connection.verificationState === 'LIVE_VERIFIED'
  ) {
    return 'LIVE_VERIFIED';
  }

  return 'CONFIGURED_NOT_TESTED';
};

export const HEALTH_LABELS: Record<string, string> = {
  UNKNOWN: 'آزمایش نشده',
  OK: 'پاسخ داد',
  FAILED: 'بی‌پاسخ',
};

// What the destination reads, resolved from the server-provided descriptor. The screen must
// never decide this itself: a UI that guessed "this vendor takes a rate" would hide the
// fiscal code the vendor actually needs.
export type FinancialModes = {
  taxHandling: string;
  // How the destination wants duty expressed, declared separately from tax. A destination
  // that declares nothing reads as UNSUPPORTED rather than inheriting the tax contract.
  dutyHandling: string;
  currencyHandling: string;
  baseCurrency: string;
  // Whether this destination identifies a non-product amount by a pre-existing item-row
  // code. A rate/amount destination has no such row, so the panel must not ask for its code.
  requiresSpecialItemCodes: boolean;
  taxCodeCatalog?: TaxCodeContractView[];
};

export const resolveFinancialModes = ({
  adapterId,
  adapters,
  financial,
}: {
  adapterId: string;
  adapters: AdapterDescriptor[];
  financial: ConnectionFinancialSettings | undefined;
}): FinancialModes => {
  const descriptor = adapters.find((entry) => entry.id === adapterId) ?? null;

  if (
    descriptor !== null &&
    typeof descriptor.taxHandling === 'string' &&
    typeof descriptor.currencyHandling === 'string'
  ) {
    return {
      taxHandling: descriptor.taxHandling,
      dutyHandling: descriptor.dutyHandling ?? 'UNSUPPORTED',
      currencyHandling: descriptor.currencyHandling,
      baseCurrency: descriptor.baseCurrency ?? 'IRR',
      requiresSpecialItemCodes: descriptor.requiresSpecialItemCodes === true,
      ...(descriptor.taxCodeCatalog === undefined
        ? {}
        : { taxCodeCatalog: descriptor.taxCodeCatalog }),
    };
  }

  const profile =
    descriptor?.testProfiles?.find(
      (entry) => entry.id === (financial?.mockProfile ?? ''),
    ) ??
    descriptor?.testProfiles?.[0] ??
    null;

  if (profile !== null && profile !== undefined) {
    return {
      taxHandling: profile.taxHandling,
      dutyHandling: profile.dutyHandling ?? 'UNSUPPORTED',
      currencyHandling: profile.currencyHandling,
      baseCurrency: profile.baseCurrency ?? 'IRR',
      requiresSpecialItemCodes: profile.requiresSpecialItemCodes === true,
      ...(profile.taxCodeCatalog === undefined
        ? {}
        : { taxCodeCatalog: profile.taxCodeCatalog }),
    };
  }

  // Nothing declared: the same fail-closed reading the domain uses.
  return {
    taxHandling: 'UNSUPPORTED',
    dutyHandling: 'UNSUPPORTED',
    currencyHandling: 'SINGLE_CURRENCY',
    baseCurrency: 'IRR',
    requiresSpecialItemCodes: false,
  };
};

export const TAX_MODE_NEEDS_CODE = (mode: string): boolean =>
  mode === 'TAX_CODE' || mode === 'TAX_CODE_AND_AMOUNT';

export const TAX_MODE_LABELS: Record<string, string> = {
  TAX_RATE: 'فقط نرخ مالیات',
  TAX_AMOUNT: 'فقط مبلغ مالیات',
  TAX_CODE: 'یک کد مالیات برای هر سیاست',
  TAX_CODE_AND_AMOUNT: 'کد و مبلغ مالیات',
  UNSUPPORTED: 'بدون پشتیبانی مالیات',
};

export const DUTY_MODE_LABELS: Record<string, string> = {
  DUTY_RATE: 'فقط نرخ عوارض',
  DUTY_AMOUNT: 'فقط مبلغ عوارض',
  DUTY_WITHIN_POLICY: 'عوارض داخل کد واحد سیاست',
  AGGREGATE: 'فقط جمع مالیات و عوارض',
  UNSUPPORTED: 'بدون پشتیبانی عوارض',
};

export const CURRENCY_MODE_LABELS: Record<string, string> = {
  SINGLE_CURRENCY: 'تک‌ارزی، بدون کد ارز',
  CURRENCY_CODE: 'کد ارز',
  CURRENCY_NAME: 'نام ارز',
  CURRENCY_CODE_AND_RATE: 'کد ارز و نرخ تبدیل',
  UNSUPPORTED: 'قرارداد ارزی نامشخص',
};

// The CRM's own currency codes. The quotation domain currently issues rial only; the list
// exists so an operator can state the mapping for a code the destination will see later, and
// an unknown code can still be added by typing it.
export const CRM_CURRENCY_CODES = ['IRR', 'USD', 'EUR'] as const;

export type TaxPolicyView = {
  code: string;
  name: string;
  ratePercent: string;
  // The second component of the same policy. Absent on a policy written before duty
  // existed; the mapping screens read it as 0% rather than making the row unusable.
  dutyRatePercent: string;
  totalRatePercent: string;
  // Exact basis points, so a destination code can be checked without re-parsing a
  // localized percentage string.
  rateBasisPoints: string;
  dutyRateBasisPoints: string;
  totalRateBasisPoints: string;
  isActive: boolean;
  isDefault: boolean;
  isExempt: boolean;
};

export const readTaxPolicies = (value: unknown): TaxPolicyView[] =>
  readRows(value).flatMap((row) => {
    const code = readString(row.code);
    const name = readString(row.name);

    if (code === '') {
      return [];
    }

    return [
      {
        code,
        name: name === '' ? code : name,
        ratePercent: readString(row.ratePercent),
        dutyRatePercent: readString(row.dutyRatePercent),
        totalRatePercent: readString(row.totalRatePercent),
        rateBasisPoints: readString(row.rateBasisPoints),
        dutyRateBasisPoints: readString(row.dutyRateBasisPoints),
        totalRateBasisPoints: readString(row.totalRateBasisPoints),
        isActive: row.isActive !== false,
        isDefault: row.isDefault === true,
        isExempt: row.isExempt === true,
      },
    ];
  });

export const OPERATION_STATE_LABELS: Record<string, string> = {
  PENDING: 'در انتظار',
  IN_FLIGHT: 'در حال ارسال',
  SUCCEEDED: 'موفق',
  FAILED_RETRYABLE: 'خطای قابل تکرار',
  FAILED_FINAL: 'خطای قطعی',
  MANUAL_EXPORT_REQUIRED: 'نیازمند اقدام دستی',
  CANCELLED: 'لغو شده',
};

// Why a preview row cannot be applied, in the words a person can act on. A code shown raw
// would leave the dangerous cases (duplicate, missing mapping, unconfirmed unit) looking
// like the ordinary ones.
export const WARNING_LABELS: Record<string, string> = {
  DUPLICATE_REMOTE_NAME: 'نام تکراری در مقصد',
  DUPLICATE_REMOTE_NATIONAL_CODE: 'کد ملی تکراری در مقصد',
  PRICE_UNIT_UNCONFIRMED: 'واحد پول تأیید نشده',
  NO_CRM_CANDIDATE: 'رکورد CRM متناظر پیدا نشد',
  REMOTE_ID_NOT_NUMERIC: 'شناسهٔ مقصد عددی نیست؛ برای سند مالی قابل استفاده نیست',
  REMOTE_ITEM_INACTIVE: 'کالا در مقصد غیرفعال است',
  REMOTE_PRICE_MISSING: 'قیمت در مقصد ثبت نشده است',
  LINE_HAS_NO_PRODUCT_LINK: 'ردیف به کالای مقصد نگاشت نشده است',
};

export type DocumentCheck = {
  code: string;
  ok: boolean;
};

export type DocumentFactorLine = {
  ProductID: number;
  Count: number;
  Price: number;
  StorageID: number;
  Description?: string;
};

// Shape produced by the server preview (`buildQuotationDocumentPreview`), reused here so the
// screen and the payload cannot drift apart.
export type DocumentPreview = QuotationDocumentPreview;

// A check code is stable and machine-readable; the sentence a person reads lives here.
export const DOCUMENT_CHECK_LABELS: Record<string, string> = {
  OUTBOUND_ENABLED: 'سوئیچ ارسال به حسابداری',
  DOCUMENT_EXPORT_ENABLED: 'سوئیچ ثبت سند مالی',
  TRANSPORT_APPROVED: 'تأیید انتقال امن',
  QUOTATION_STATUS_EXPORTABLE: 'وضعیت مجاز پیش‌فاکتور برای حسابداری',
  REVISION_PRESENT: 'نسخهٔ قطعی‌شده سند',
  CURRENCY_IRR: 'واحد پول ریالی سند',
  MONEY_UNIT_CONFIRMED: 'واحد پول مقصد تأیید شده',
  VENDOR_USER_ID: 'شناسهٔ کاربر مقصد',
  STORAGE_ID: 'شناسهٔ انبار مقصد',
  CUSTOMER_LINKED: 'نگاشت مشتری به مقصد',
  PROFORMA_CAPABILITY: 'قابلیت ثبت پیش‌فاکتور در مقصد',
  DISCOUNT_CODE_PRESENT: 'کد ویژهٔ تخفیف',
  TAX_CODE_PRESENT: 'کد ویژهٔ ردیف مالیات',
  DUTY_CODE_PRESENT: 'کد ویژهٔ ردیف عوارض',
  TAX_POLICY_MAPPED: 'نگاشت سیاست مالیات به کد مقصد',
  TAX_CODE_VERIFIED: 'تأیید تطابق کد مالیات با نرخ و ترکیب سیاست',
  DUTY_POLICY_SUPPORTED: 'پشتیبانی مقصد از عوارض',
  CURRENCY_MAPPING: 'قرارداد ارز مقصد (ارز پایه یا کد ارز)',
  ALL_LINES_LINKED: 'نگاشت همهٔ ردیف‌ها به کالای مقصد',
};

// Why the simulated document cannot be built yet, in act-on-able words.
export const DOCUMENT_ERROR_LABELS: Record<string, string> = {
  REVISION_NOT_FOUND: 'نسخهٔ قطعی‌شده‌ای برای این سند وجود ندارد.',
  CUSTOMER_NOT_LINKED: 'مشتری این سند به رکورد مقصد نگاشت نشده است.',
  ADAPTER_NOT_CONFIGURED:
    'شناسهٔ کاربر یا انبار مقصد نامعتبر است؛ پیش‌نمایش سند ساختنی نیست.',
  MONEY_UNIT_UNCONFIRMED:
    'واحد پول مقصد تأیید نشده است؛ مبلغ سند قابل تبدیل نیست.',
  LINE_HAS_NO_PRODUCT_LINK:
    'دست‌کم یک ردیف به کالای مقصد نگاشت نشده است؛ سند کامل نیست.',
  AMOUNT_NOT_WHOLE_UNIT:
    'مبلغ ردیف به واحد صحیح مقصد تبدیل نمی‌شود و گردکردن آن مجاز نیست.',
  TAX_POLICY_NOT_MAPPED: 'سیاست مالیات سند به کد مالیات مقصد نگاشت نشده است.',
  TAX_UNSUPPORTED:
    'این مقصد امکان ثبت مالیات را ندارد؛ سند دارای مالیات ارسال نمی‌شود تا مالیات حذف‌شده ثبت نشود.',
  DUTY_UNSUPPORTED:
    'این مقصد امکان ثبت عوارض را ندارد؛ سند دارای عوارض ارسال نمی‌شود تا عوارض حذف‌شده ثبت نشود.',
  DUTY_CODE_NOT_MAPPED:
    'کد عوارض جداگانه در این نسخه پشتیبانی نمی‌شود؛ کد واحد سیاست کل ارزش افزوده را نمایندگی می‌کند.',
  DUTY_AGGREGATE_ONLY:
    'این مقصد فقط جمع مالیات و عوارض را در یک فیلد می‌پذیرد و تفکیک دو مؤلفه را در سند ممکن نمی‌کند.',
  DUTY_RATE_NOT_ACCEPTED:
    'این مقصد نرخ عوارض را نمی‌گیرد؛ مبلغ عوارض باید از سند خوانده شود.',
  CURRENCY_UNSUPPORTED:
    'قرارداد ارزی این مقصد مشخص نیست؛ ارز سند قابل اثبات نیست.',
  CURRENCY_BASE_UNCONFIRMED:
    'ارز پایهٔ مقصد تأیید نشده است؛ در تنظیمات اتصال آن را مشخص کنید.',
  CURRENCY_CODE_MAPPING_REQUIRED:
    'کد ارز این سند در مقصد تعریف نشده است؛ در تنظیمات اتصال نگاشت ارز را وارد کنید.',
  CURRENCY_NAME_MAPPING_REQUIRED:
    'نام ارز این سند در مقصد تعریف نشده است؛ در تنظیمات اتصال آن را وارد کنید.',
  CURRENCY_RATE_REQUIRED:
    'نرخ تبدیل معتبر برای این ارز در تنظیمات اتصال ثبت نشده است.',
  TAX_CODE_RATE_MISMATCH:
    'نرخ کل سیاست مالیات سند با نرخی که مقصد برای کد مالیات انتخاب‌شده اعلام کرده یکسان نیست؛ ارسال متوقف شده تا مالیات با نرخ اشتباه ثبت نشود.',
  TAX_CODE_COMPOSITION_MISMATCH:
    'جمع نرخ‌ها برابر است اما تفکیک مالیات و عوارض با تعریف مقصد برای کد انتخاب‌شده یکسان نیست؛ ارسال متوقف شده تا سهم مالیات و عوارض جابه‌جا ثبت نشود.',
  SPECIAL_CODE_NOT_CONFIGURED:
    'کد ویژهٔ ردیف مالیات یا تخفیف در این اتصال تنظیم نشده است.',
};

// Non-blocking findings. A warned document can still be sent; the warning says what an
// accountant should look at first, not what the CRM refuses.
export const DOCUMENT_WARNING_LABELS: Record<string, string> = {
  TAX_CODE_UNVERIFIED:
    'مقصد کاتالوگ معتبری از کدهای مالیات منتشر نکرده یا این کد در آن نیست؛ تطابق کد با نرخ سیاست تأیید نشده است.',
};


// Display-only readiness of a vendor the app has no operational adapter for. It is not an
// adapter entry: it exists so the selector can say "unavailable" instead of pretending a
// destination is ready.
export const SEPIDAR_UNAVAILABLE = {
  id: 'sepidar',
  label: 'سپیدار',
  readiness: 'UNAVAILABLE',
  summary:
    'برای سپیدار آداپتور عملیاتی وجود ندارد؛ تا افزودن آداپتور، این نرم‌افزار به‌عنوان اتصال آماده معرفی نمی‌شود.',
} as const;

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const readString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

export const readRows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        const row = asRecord(entry);

        return row === null ? [] : [row];
      })
    : [];

export const toForm = (connection: ConnectionRecord): FormState => ({
  id: connection.id,
  name: connection.name,
  adapterId: connection.adapterId,
  baseUrl: connection.settings.baseUrl,
  remoteUserId: connection.settings.remoteUserId,
  defaultStorageId: connection.settings.defaultStorageId,
  moneyUnit: connection.settings.moneyUnit,
  transportApproved: connection.settings.transportApproved,
  discount: connection.settings.specialCodes.discount,
  duty: connection.settings.specialCodes.duty,
  tax: connection.settings.specialCodes.tax,
  taxPolicyMappingsText: formatTaxPolicyMappingsText(
    connection.settings.taxPolicyMappings,
  ),
  specialDiscountCode: connection.settings.specialItemCodes?.discount ?? '',
  specialDutyCode: connection.settings.specialItemCodes?.duty ?? '',
  specialTaxCode: connection.settings.specialItemCodes?.tax ?? '',
  baseCurrency: connection.settings.financial?.baseCurrency ?? 'IRR',
  currencyMappingsText: formatKeyValueLines(
    connection.settings.financial?.currencyMappings,
  ),
  conversionRate: connection.settings.financial?.conversionRate ?? '',
  mockProfile: connection.settings.financial?.mockProfile ?? 'SIMPLE',
});

export const parsePanelData = (data: Record<string, unknown>): PanelData => ({
  connections: readRows(data.connections).flatMap((node) => {
    const id = readString(node.id) || readString(node.recordId);

    if (id === '') {
      return [];
    }

    return [
      {
        ...(node as unknown as ConnectionRecord),
        id,
        isActive: node.isActive !== false,
        isDefault: node.isDefault === true,
      },
    ];
  }),
  adapters: readRows(data.adapters).map(
    (node) => node as unknown as AdapterDescriptor,
  ),
  credentials: {
    tunnelTokenConfigured: asRecord(data.credentials)?.tunnelTokenConfigured === true,
    insecureWritesApproved:
      asRecord(data.credentials)?.insecureWritesApproved === true,
  },
  flags: {
    outboundEnabled: asRecord(data.flags)?.outboundEnabled === true,
    documentExportEnabled:
      asRecord(data.flags)?.documentExportEnabled === true,
  },
  canManage: data.canManage === true,
});

export const sharedStyles: Record<string, CSSProperties> = {
  root: {
    direction: 'rtl',
    fontFamily: 'var(--t-font-family)',
    color: 'var(--t-font-color-primary)',
    padding: 'var(--t-spacing-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--t-spacing-3)',
    height: '100%',
    boxSizing: 'border-box',
    overflowY: 'auto',
  },
  section: {
    border: '1px solid var(--t-border-color-medium)',
    borderRadius: 'var(--t-border-radius-sm)',
    padding: 'var(--t-spacing-3)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--t-spacing-2)',
  },
  title: {
    margin: 0,
    fontSize: 'var(--t-font-size-md)',
    fontWeight: 'var(--t-font-weight-semi-bold)',
  },
  subtitle: {
    margin: 0,
    fontSize: 'var(--t-font-size-sm)',
    fontWeight: 'var(--t-font-weight-semi-bold)',
  },
  meta: {
    margin: 0,
    fontSize: 'var(--t-font-size-sm)',
    color: 'var(--t-font-color-secondary)',
  },
  notice: {
    margin: 0,
    fontSize: 'var(--t-font-size-sm)',
    color: 'var(--t-font-color-secondary)',
    background: 'var(--t-background-secondary)',
    padding: 'var(--t-spacing-2)',
    borderRadius: 'var(--t-border-radius-sm)',
  },
  warning: {
    margin: 0,
    fontSize: 'var(--t-font-size-sm)',
    color: 'var(--t-color-orange)',
    background: 'var(--t-background-secondary)',
    padding: 'var(--t-spacing-2)',
    borderRadius: 'var(--t-border-radius-sm)',
  },
  error: {
    margin: 0,
    fontSize: 'var(--t-font-size-sm)',
    color: 'var(--t-color-red)',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--t-spacing-2)',
    alignItems: 'center',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--t-spacing-1)',
    minWidth: '160px',
    flex: '1 1 160px',
  },
  label: {
    fontSize: 'var(--t-font-size-sm)',
    color: 'var(--t-font-color-secondary)',
  },
  input: {
    border: '1px solid var(--t-border-color-medium)',
    borderRadius: 'var(--t-border-radius-sm)',
    background: 'var(--t-background-primary)',
    color: 'var(--t-font-color-primary)',
    padding: 'var(--t-spacing-1) var(--t-spacing-2)',
    fontFamily: 'inherit',
    fontSize: 'var(--t-font-size-sm)',
  },
  checkboxRow: {
    display: 'flex',
    gap: 'var(--t-spacing-3)',
    flexWrap: 'wrap',
    fontSize: 'var(--t-font-size-sm)',
  },
  button: {
    border: '1px solid var(--t-border-color-medium)',
    background: 'var(--t-background-primary)',
    color: 'var(--t-font-color-primary)',
    borderRadius: 'var(--t-border-radius-sm)',
    padding: 'var(--t-spacing-2) var(--t-spacing-3)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'var(--t-font-size-sm)',
  },
  buttonPrimary: {
    background: 'var(--t-color-blue)',
    color: 'var(--t-font-color-inverted)',
    borderColor: 'var(--t-color-blue)',
  },
  buttonDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 'var(--t-font-size-sm)',
  },
  cell: {
    borderBottom: '1px solid var(--t-border-color-light)',
    padding: 'var(--t-spacing-1)',
    textAlign: 'right',
    verticalAlign: 'top',
  },
};

export const Field = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <label style={sharedStyles.field}>
    <span style={sharedStyles.label}>{label}</span>
    {children}
  </label>
);

export const ConnectionStatus = ({
  connection,
}: {
  connection: ConnectionRecord;
}) => (
  <p style={sharedStyles.meta}>
    وضعیت ذخیره‌شده: {HEALTH_LABELS[connection.healthState] ?? connection.healthState}
    {connection.lastHealthMessage ? ` — ${connection.lastHealthMessage}` : ''}
    {` — ${VERIFICATION_LABELS[connection.verificationState] ?? connection.verificationState}`}
    {connection.lastHealthCheckAt ? ` — آخرین آزمایش: ${connection.lastHealthCheckAt}` : ''}
  </p>
);

export const CapabilityTable = ({ connection }: { connection: ConnectionRecord }) =>
  connection.capabilityRows === undefined ? (
    <p style={sharedStyles.meta}>
      قابلیت‌ها پس از ذخیرهٔ اتصال و بارگذاری مجدد نمایش داده می‌شوند.
    </p>
  ) : (
    <table aria-label="قابلیت‌های این اتصال" style={sharedStyles.table}>
      <thead>
        <tr>
          <th style={sharedStyles.cell}>قابلیت</th>
          <th style={sharedStyles.cell}>وضعیت</th>
        </tr>
      </thead>
      <tbody>
        {connection.capabilityRows.map((row) => (
          <tr key={`${row.area}-${row.key}`}>
            <td style={sharedStyles.cell}>{row.label}</td>
            <td style={sharedStyles.cell}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

// Exact micros text with the six-digit fraction removed only when it is zero, so a nonzero
// fraction stays visible instead of being rounded away for display.
const displayExact = (text: string | null): string => {
  if (text === null) {
    return '—';
  }

  const trimmed = text.replace(/0+$/, '').replace(/\.$/, '');

  return trimmed === '' || trimmed === '-' ? '0' : trimmed;
};

export const DocumentPreviewPanel = ({
  preview,
}: {
  preview: DocumentPreview;
}) => (
  <>
    <p style={sharedStyles.meta}>
      {`واحد مبلغ: ${
        preview.moneyUnit === 'UNCONFIRMED' ? 'تأییدنشده' : preview.moneyUnit
      } — شناسهٔ مشتری مقصد: ${
        preview.customerExternalId ?? 'نگاشت نشده'
      } — ارسال واقعی: ${
        preview.outboundEnabled ? 'فعال' : 'خاموش (همین نسخه)'
      } — ثبت سند مالی: ${preview.documentExportEnabled ? 'فعال' : 'خاموش'}`}
    </p>
    <table aria-label="بررسی‌های آمادگی سند" style={sharedStyles.table}>
      <thead>
        <tr>
          <th style={sharedStyles.cell}>بررسی</th>
          <th style={sharedStyles.cell}>نتیجه</th>
        </tr>
      </thead>
      <tbody>
        {preview.checks.map((check) => (
          <tr key={check.code}>
            <td style={sharedStyles.cell}>
              {DOCUMENT_CHECK_LABELS[check.code] ?? check.code}
            </td>
            <td style={sharedStyles.cell}>{check.ok ? 'برقرار' : 'نقص دارد'}</td>
          </tr>
        ))}
      </tbody>
    </table>

    {preview.warnings.length === 0 ? null : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {preview.warnings.map((warning) => (
          <p key={warning.code} style={sharedStyles.warning}>
            {DOCUMENT_WARNING_LABELS[warning.code] ?? warning.detail}
          </p>
        ))}
      </div>
    )}

    <p style={sharedStyles.subtitle}>نگاشت ردیف‌های سند</p>    <table aria-label="نگاشت ردیف‌های سند" style={sharedStyles.table}>
      <thead>
        <tr>
          <th style={sharedStyles.cell}>شرح</th>
          <th style={sharedStyles.cell}>کد کالای مقصد</th>
          <th style={sharedStyles.cell}>تعداد</th>
          <th style={sharedStyles.cell}>مبلغ ردیف</th>
          <th style={sharedStyles.cell}>مالیات</th>
          <th style={sharedStyles.cell}>وضعیت</th>
        </tr>
      </thead>
      <tbody>
        {preview.lines.map((line) => (
          <tr key={line.lineId}>
            <td style={sharedStyles.cell}>{line.description}</td>
            <td style={{ ...sharedStyles.cell, direction: 'ltr' }}>
              {line.externalItemId ?? '—'}
            </td>
            <td style={sharedStyles.cell}>{line.quantity ?? '—'}</td>
            <td style={sharedStyles.cell}>{displayExact(line.totalMicros)}</td>
            <td style={sharedStyles.cell}>{displayExact(line.taxMicros)}</td>
            <td style={sharedStyles.cell}>
              {line.problem === null
                ? 'نگاشت شده'
                : WARNING_LABELS[line.problem] ?? line.problem}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    {preview.document === null ? (
      <p style={sharedStyles.warning}>
        {DOCUMENT_ERROR_LABELS[preview.documentError?.code ?? ''] ??
          'پیش‌نمایش سند کامل نیست؛ ابتدا موارد بالا را برطرف کنید.'}
        {preview.documentError === null ? '' : ` — کد: ${preview.documentError.code}`}
      </p>
    ) : (
      <>
        <p style={sharedStyles.subtitle}>سند مقصد (پیش‌نمایش آزمایشی)</p>
        <p style={sharedStyles.meta}>
          {`شناسهٔ مشتری: ${preview.document.CustomerID} — کاربر مقصد: ${
            preview.document.UserID
          } — تاریخ: ${preview.document.FactorDate} — شمارهٔ سند: خودکار توسط مقصد (${
            preview.document.FactorNumber
          })`}
        </p>
        <table aria-label="ردیف‌های سند حسابداری" style={sharedStyles.table}>
          <thead>
            <tr>
              <th style={sharedStyles.cell}>کد کالا</th>
              <th style={sharedStyles.cell}>تعداد</th>
              <th style={sharedStyles.cell}>مبلغ</th>
              <th style={sharedStyles.cell}>انبار</th>
              <th style={sharedStyles.cell}>شرح</th>
            </tr>
          </thead>
          <tbody>
            {preview.document.FactorDetails.map((detail, index) => (
              <tr key={`${detail.ProductID}-${index}`}>
                <td style={{ ...sharedStyles.cell, direction: 'ltr' }}>
                  {detail.ProductID}
                </td>
                <td style={sharedStyles.cell}>{detail.Count}</td>
                <td style={sharedStyles.cell}>{detail.Price}</td>
                <td style={sharedStyles.cell}>{detail.StorageID}</td>
                <td style={sharedStyles.cell}>{detail.Description ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={sharedStyles.notice}>
          این سند فقط پیش‌نمایش در حافظه است؛ هیچ درخواستی به آسان یا سپیدار
          فرستاده نشده و ثبت واقعی سند مالی در این نسخه غیرفعال است.
        </p>
      </>
    )}
  </>
);

export const OperationTable = ({ operations }: { operations: OperationRow[] }) =>
  operations.length === 0 ? (
    <p style={sharedStyles.meta}>عملیاتی ثبت نشده است.</p>
  ) : (
    <table aria-label="سوابق عملیات حسابداری" style={sharedStyles.table}>
      <thead>
        <tr>
          <th style={sharedStyles.cell}>نوع</th>
          <th style={sharedStyles.cell}>وضعیت</th>
          <th style={sharedStyles.cell}>تلاش</th>
          <th style={sharedStyles.cell}>شناسهٔ سند مقصد</th>
        </tr>
      </thead>
      <tbody>
        {operations.map((operation) => (
          <tr key={operation.id}>
            <td style={sharedStyles.cell}>{operation.kind}</td>
            <td style={sharedStyles.cell}>
              {OPERATION_STATE_LABELS[operation.state] ?? operation.state}
            </td>
            <td style={sharedStyles.cell}>{operation.attempts}</td>
            <td style={{ ...sharedStyles.cell, direction: 'ltr' }}>
              {operation.externalDocumentId ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
