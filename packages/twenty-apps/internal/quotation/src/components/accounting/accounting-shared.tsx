import { type CSSProperties, type ReactNode } from 'react';

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

export type PartyPreview = {
  rows: PartyRow[];
  summary: Record<string, number>;
  totalRemoteParties: number;
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

export const ItemPreviewTable = ({
  preview,
  selectedExternalIds,
  onToggle,
}: {
  preview: ItemPreview;
  selectedExternalIds?: string[];
  onToggle?: (externalItemId: string) => void;
}) => {
  const selectableDecisions = new Set([
    'CREATE',
    'LINK_SUGGESTED',
    'LINK_AMBIGUOUS',
    'REMOTE_CHANGED',
  ]);

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
      <table style={sharedStyles.table}>
        <thead>
          <tr>
            {onToggle === undefined ? null : <th style={sharedStyles.cell}> </th>}
            <th style={sharedStyles.cell}>کد</th>
            <th style={sharedStyles.cell}>نام</th>
            <th style={sharedStyles.cell}>تصمیم</th>
            <th style={sharedStyles.cell}>قیمت</th>
          </tr>
        </thead>
        <tbody>
          {preview.rows.slice(0, 100).map((row) => (
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
              <td style={sharedStyles.cell}>{row.planPrice}</td>
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

export const PartyPreviewTable = ({ preview }: { preview: PartyPreview }) => (
  <>
    <p style={sharedStyles.meta}>
      {`${preview.totalRemoteParties} مشتری در مقصد — هم‌خوان: ${
        preview.summary.IN_SYNC ?? 0
      } — نیازمند رکورد CRM: ${
        preview.summary.NEEDS_CRM_RECORD ?? 0
      } — تطبیق مبهم: ${preview.summary.AMBIGUOUS_CRM_MATCH ?? 0}`}
    </p>
    <table style={sharedStyles.table}>
      <thead>
        <tr>
          <th style={sharedStyles.cell}>کد</th>
          <th style={sharedStyles.cell}>نام</th>
          <th style={sharedStyles.cell}>کد ملی</th>
          <th style={sharedStyles.cell}>تصمیم</th>
        </tr>
      </thead>
      <tbody>
        {preview.rows.slice(0, 100).map((row) => (
          <tr key={row.externalPartyId}>
            <td style={sharedStyles.cell}>{row.code}</td>
            <td style={sharedStyles.cell}>{row.fullName}</td>
            <td style={sharedStyles.cell}>{row.nationalCode ?? '—'}</td>
            <td style={sharedStyles.cell}>
              {DECISION_LABELS[row.decision] ?? row.decision}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <p style={sharedStyles.notice}>
      اتصال هر مشتری به یک رکورد CRM باید صریح باشد؛ این بخش فقط پیش‌نمایش و
      تشخیص تکراری را نشان می‌دهد و از نام برای تطبیق استفاده نمی‌کند.
    </p>
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
