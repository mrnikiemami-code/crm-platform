import { useState, type CSSProperties, type ReactNode } from 'react';

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
};

export type ConnectionSettings = {
  baseUrl: string;
  remoteUserId: string;
  defaultStorageId: string;
  moneyUnit: string;
  transportApproved: boolean;
  specialCodes: { discount: boolean; duty: boolean; tax: boolean };
  taxPolicyMappings?: Record<string, string>;
};

export type ConnectionRecord = {
  id: string;
  name: string;
  adapterId: string;
  adapterVersion: string | null;
  isActive: boolean;
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
  // `CODE=VENDOR_CODE`, one per line. The CRM policy code is not the vendor's
  // fiscal code; an operator states the mapping explicitly.
  taxPolicyMappingsText: string;
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
};

export const formatTaxPolicyMappingsText = (
  mappings: Record<string, string> | undefined,
): string =>
  Object.entries(mappings ?? {})
    .map(([code, vendorCode]) => `${code}=${vendorCode}`)
    .join('\n');

export const parseTaxPolicyMappingsText = (
  text: string,
): Record<string, string> => {
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

export const HEALTH_LABELS: Record<string, string> = {
  UNKNOWN: 'آزمایش نشده',
  OK: 'پاسخ داد',
  FAILED: 'بی‌پاسخ',
};

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
  TAX_CODE_PRESENT: 'کد ویژهٔ مالیات',
  TAX_POLICY_MAPPED: 'نگاشت سیاست مالیات به کد مقصد',
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
});

export const parsePanelData = (data: Record<string, unknown>): PanelData => ({
  connections: readRows(data.connections).map(
    (node) => node as unknown as ConnectionRecord,
  ),
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
    <table style={sharedStyles.table}>
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

const describeDifference = (difference: string | null): string => {
  if (difference === null) {
    return 'قابل مقایسه نیست';
  }

  const value = displayExact(difference);

  if (value === '0') {
    return 'بدون اختلاف';
  }

  return value.startsWith('-')
    ? `CRM ${displayExact(difference.slice(1))} بیشتر`
    : `مقصد ${value} بیشتر`;
};

export const ItemPreviewTable = ({
  preview,
  selectedExternalIds,
  onToggle,
}: {
  preview: ItemPreview;
  selectedExternalIds?: string[];
  onToggle?: (externalItemId: string) => void;
}) => {
  const [search, setSearch] = useState('');
  const selectableDecisions = new Set([
    'CREATE',
    'LINK_SUGGESTED',
    'LINK_AMBIGUOUS',
    'REMOTE_CHANGED',
  ]);
  const needle = search.trim().toLowerCase();
  // The filter only hides rows: a confirmed selection is kept while the person narrows the
  // list, so searching never silently drops a checkbox.
  const visibleRows =
    needle === ''
      ? preview.rows
      : preview.rows.filter(
          (row) =>
            row.code.toLowerCase().includes(needle) ||
            row.name.toLowerCase().includes(needle) ||
            row.externalItemId.toLowerCase().includes(needle),
        );

  return (
    <>
      <p style={sharedStyles.meta}>
        {`${preview.totalRemoteItems} کالا در مقصد — ایجاد: ${
          preview.summary.CREATE ?? 0
        } — پیشنهاد اتصال: ${preview.summary.LINK_SUGGESTED ?? 0} — هم‌خوان: ${
          preview.summary.IN_SYNC ?? 0
        } — تغییرکرده: ${preview.summary.REMOTE_CHANGED ?? 0} — کد تکراری: ${
          preview.summary.DUPLICATE_REMOTE_CODE ?? 0
        }`}
      </p>
      <input
        style={sharedStyles.input}
        type="search"
        value={search}
        placeholder="جست‌وجو با کد یا نام کالا"
        onChange={(event) => setSearch(event.target.value)}
      />
      <p style={sharedStyles.meta}>
        {`${visibleRows.length} ردیف از ${preview.rows.length} ردیف نمایش داده می‌شود`}
      </p>
      <table style={sharedStyles.table}>
        <thead>
          <tr>
            {onToggle === undefined ? null : <th style={sharedStyles.cell}> </th>}
            <th style={sharedStyles.cell}>کد</th>
            <th style={sharedStyles.cell}>نام</th>
            <th style={sharedStyles.cell}>تصمیم</th>
            <th style={sharedStyles.cell}>شناسهٔ مقصد</th>
            <th style={sharedStyles.cell}>قیمت مقصد</th>
            <th style={sharedStyles.cell}>قیمت CRM</th>
            <th style={sharedStyles.cell}>اختلاف</th>
            <th style={sharedStyles.cell}>دلیل / هشدار</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.slice(0, 100).map((row) => (
            <tr key={row.externalItemId}>
              {onToggle === undefined ? null : (
                <td style={sharedStyles.cell}>
                  <input
                    type="checkbox"
                    disabled={!selectableDecisions.has(row.decision)}
                    checked={(selectedExternalIds ?? []).includes(row.externalItemId)}
                    onChange={() => onToggle(row.externalItemId)}
                  />
                </td>
              )}
              <td style={sharedStyles.cell}>{row.code}</td>
              <td style={sharedStyles.cell}>{row.name}</td>
              <td style={sharedStyles.cell}>
                {DECISION_LABELS[row.decision] ?? row.decision}
              </td>
              <td style={{ ...sharedStyles.cell, direction: 'ltr' }}>
                {row.externalItemId}
              </td>
              <td style={sharedStyles.cell}>{row.planPrice}</td>
              <td style={sharedStyles.cell}>
                {row.crmPriceMicros === null
                  ? '—'
                  : displayExact(row.crmPriceMicros)}
              </td>
              <td style={sharedStyles.cell}>
                {describeDifference(row.priceDifferenceMicros)}
              </td>
              <td style={sharedStyles.cell}>
                {row.warnings.length === 0
                  ? '—'
                  : row.warnings
                      .map((warning) => WARNING_LABELS[warning] ?? warning)
                      .join('؛ ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {preview.moneyUnit === 'UNCONFIRMED' ? (
        <p style={sharedStyles.warning}>
          واحد مبلغ تأیید نشده است؛ قیمت‌ها نمایش داده می‌شوند ولی قابل اعمال
          نیستند.
        </p>
      ) : null}
    </>
  );
};

export const PartyPreviewTable = ({ preview }: { preview: PartyPreview }) => {
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<Record<string, string>>({});
  const needle = search.trim().toLowerCase();
  const visibleRows =
    needle === ''
      ? preview.rows
      : preview.rows.filter(
          (row) =>
            row.code.toLowerCase().includes(needle) ||
            row.fullName.toLowerCase().includes(needle) ||
            (row.nationalCode ?? '').includes(needle),
        );
  const candidates = preview.crmCandidates ?? [];

  return (
    <>
      <p style={sharedStyles.meta}>
        {`${preview.totalRemoteParties} مشتری در مقصد — هم‌خوان: ${
          preview.summary.IN_SYNC ?? 0
        } — نیازمند رکورد CRM: ${
          preview.summary.NEEDS_CRM_RECORD ?? 0
        } — تطبیق مبهم: ${preview.summary.AMBIGUOUS_CRM_MATCH ?? 0} — کد تکراری: ${
          preview.summary.DUPLICATE_REMOTE_CODE ?? 0
        }`}
      </p>
      <input
        style={sharedStyles.input}
        type="search"
        value={search}
        placeholder="جست‌وجو با نام، کد یا کد ملی"
        onChange={(event) => setSearch(event.target.value)}
      />
      <p style={sharedStyles.meta}>
        {`${visibleRows.length} ردیف از ${preview.rows.length} ردیف نمایش داده می‌شود`}
      </p>
      <table style={sharedStyles.table}>
        <thead>
          <tr>
            <th style={sharedStyles.cell}>کد</th>
            <th style={sharedStyles.cell}>نام</th>
            <th style={sharedStyles.cell}>موبایل</th>
            <th style={sharedStyles.cell}>کد ملی</th>
            <th style={sharedStyles.cell}>تصمیم</th>
            <th style={sharedStyles.cell}>دلیل / هشدار</th>
            <th style={sharedStyles.cell}>انتخاب مشتری CRM</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.slice(0, 100).map((row) => (
            <tr key={row.externalPartyId}>
              <td style={sharedStyles.cell}>{row.code}</td>
              <td style={sharedStyles.cell}>{row.fullName}</td>
              <td style={{ ...sharedStyles.cell, direction: 'ltr' }}>
                {row.mobile ?? '—'}
              </td>
              <td style={{ ...sharedStyles.cell, direction: 'ltr' }}>
                {row.nationalCode ?? '—'}
              </td>
              <td style={sharedStyles.cell}>
                {DECISION_LABELS[row.decision] ?? row.decision}
              </td>
              <td style={sharedStyles.cell}>
                {row.warnings.length === 0
                  ? '—'
                  : row.warnings
                      .map((warning) => WARNING_LABELS[warning] ?? warning)
                      .join('؛ ')}
              </td>
              <td style={sharedStyles.cell}>
                <select
                  style={sharedStyles.input}
                  value={selection[row.externalPartyId] ?? ''}
                  disabled={
                    row.decision === 'DUPLICATE_REMOTE_CODE' ||
                    row.decision === 'IN_SYNC'
                  }
                  onChange={(event) =>
                    setSelection({
                      ...selection,
                      [row.externalPartyId]: event.target.value,
                    })
                  }
                >
                  <option value="">انتخاب نشده</option>
                  {candidates.map((candidate) => (
                    <option key={`${candidate.partyType}-${candidate.id}`} value={candidate.id}>
                      {`${candidate.partyType === 'PERSON' ? 'شخص' : 'شرکت'} — ${candidate.name}`}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={sharedStyles.notice}>
        این انتخاب فقط پیش‌نمایش است و هیچ اتصالی ذخیره نمی‌کند. اتصال هر مشتری به
        یک رکورد CRM باید صریح باشد؛ نام برای تطبیق خودکار استفاده نمی‌شود و کد
        تکراری مقصد تا اصلاح در نرم‌افزار حسابداری قابل اتصال نیست.
      </p>
    </>
  );
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
    <table style={sharedStyles.table}>
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

    <p style={sharedStyles.subtitle}>نگاشت ردیف‌های سند</p>
    <table style={sharedStyles.table}>
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
        <table style={sharedStyles.table}>
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
    <table style={sharedStyles.table}>
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
