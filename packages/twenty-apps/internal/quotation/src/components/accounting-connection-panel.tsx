import { type CSSProperties, type ReactNode, useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar, useSelectedRecordIds } from 'twenty-sdk/front-component';

import {
  ACCOUNTING_CONNECTION_ROUTE,
  ACCOUNTING_IMPORT_ROUTE,
  ACCOUNTING_OUTBOUND_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

type CapabilityRow = {
  area: string;
  key: string;
  label: string;
  value: string;
};

type AdapterDescriptor = {
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

type ConnectionSettings = {
  baseUrl: string;
  remoteUserId: string;
  defaultStorageId: string;
  moneyUnit: string;
  transportApproved: boolean;
  specialCodes: { discount: boolean; duty: boolean; tax: boolean };
  taxPolicyMappings?: Record<string, string>;
};

type ConnectionRecord = {
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

type ImportRow = {
  externalItemId: string;
  code: string;
  name: string;
  decision: string;
  suggestedInternalItemId: string | null;
  existingLinkId: string | null;
  planPrice: string;
  warnings: string[];
};

type ItemPreview = {
  moneyUnit: string;
  rows: ImportRow[];
  summary: Record<string, number>;
  totalRemoteItems: number;
};

type PartyRow = {
  externalPartyId: string;
  code: string;
  fullName: string;
  mobile: string | null;
  nationalCode: string | null;
  decision: string;
  warnings: string[];
};

type PartyPreview = {
  rows: PartyRow[];
  summary: Record<string, number>;
  totalRemoteParties: number;
};

type OperationRow = {
  id: string;
  kind: string;
  state: string;
  attempts: number;
  externalDocumentId: string | null;
};

type PanelData = {
  connections: ConnectionRecord[];
  adapters: AdapterDescriptor[];
  credentials: { tunnelTokenConfigured: boolean; insecureWritesApproved: boolean };
  flags: { outboundEnabled: boolean; documentExportEnabled: boolean };
};

type FormState = {
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

const EMPTY_FORM: FormState = {
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

const formatTaxPolicyMappingsText = (
  mappings: Record<string, string> | undefined,
): string =>
  Object.entries(mappings ?? {})
    .map(([code, vendorCode]) => `${code}=${vendorCode}`)
    .join('\n');

const parseTaxPolicyMappingsText = (
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

const DECISION_LABELS: Record<string, string> = {
  CREATE: 'ایجاد در CRM',
  LINK_SUGGESTED: 'پیشنهاد اتصال',
  LINK_AMBIGUOUS: 'اتصال مبهم',
  IN_SYNC: 'هم‌اکنون هم‌خوان',
  REMOTE_CHANGED: 'تغییر در مقصد',
  DUPLICATE_REMOTE_CODE: 'کد تکراری در مقصد',
  NEEDS_CRM_RECORD: 'نیازمند رکورد CRM',
  AMBIGUOUS_CRM_MATCH: 'تطبیق مبهم در CRM',
};

const VERIFICATION_LABELS: Record<string, string> = {
  MOCK: 'آزمایشی (بدون تماس واقعی)',
  LIVE_UNVERIFIED: 'فعال، تأییدنشده',
  LIVE_VERIFIED: 'فعال و تأییدشده',
};

const HEALTH_LABELS: Record<string, string> = {
  UNKNOWN: 'آزمایش نشده',
  OK: 'پاسخ داد',
  FAILED: 'بی‌پاسخ',
};

const OPERATION_STATE_LABELS: Record<string, string> = {
  PENDING: 'در انتظار',
  IN_FLIGHT: 'در حال ارسال',
  SUCCEEDED: 'موفق',
  FAILED_RETRYABLE: 'خطای قابل تکرار',
  FAILED_FINAL: 'خطای قطعی',
  MANUAL_EXPORT_REQUIRED: 'نیازمند اقدام دستی',
  CANCELLED: 'لغو شده',
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const readRows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        const row = asRecord(entry);

        return row === null ? [] : [row];
      })
    : [];

const toForm = (connection: ConnectionRecord): FormState => ({
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

const styles: Record<string, CSSProperties> = {
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

const Field = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <label style={styles.field}>
    <span style={styles.label}>{label}</span>
    {children}
  </label>
);

export const AccountingConnectionPanel = () => {
  const selectedIds = useSelectedRecordIds();
  const quotationId = selectedIds[0] ?? null;
  const [data, setData] = useState<PanelData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<{
    healthState: string;
    message: string;
    detail: string;
    verificationState: string;
  } | null>(null);
  const [itemPreview, setItemPreview] = useState<ItemPreview | null>(null);
  const [partyPreview, setPartyPreview] = useState<PartyPreview | null>(null);
  const [selectedExternalIds, setSelectedExternalIds] = useState<string[]>([]);
  const [allowRemoteVersionUpdate, setAllowRemoteVersionUpdate] = useState(false);
  const [applyPrices, setApplyPrices] = useState(false);
  const [importOutcome, setImportOutcome] = useState<string | null>(null);
  const [operations, setOperations] = useState<OperationRow[]>([]);
  const [exportPreview, setExportPreview] = useState<string | null>(null);

  const activeConnectionId = form.id;

  const loadPanel = useCallback(async () => {
    setLoadError(null);

    try {
      const response = await callAppRoute(ACCOUNTING_CONNECTION_ROUTE, {
        action: 'list',
      });

      if (!response.ok || response.data.success !== true) {
        setLoadError(
          toPersianUiMessage(
            readString(response.data.message),
            'بارگذاری تنظیمات اتصال حسابداری انجام نشد.',
          ),
        );
        return;
      }

      const connections = readRows(response.data.connections).map(
        (node) => node as unknown as ConnectionRecord,
      );
      const adapters = readRows(response.data.adapters).map(
        (node) => node as unknown as AdapterDescriptor,
      );

      setData({
        connections,
        adapters,
        credentials: {
          tunnelTokenConfigured:
            asRecord(response.data.credentials)?.tunnelTokenConfigured === true,
          insecureWritesApproved:
            asRecord(response.data.credentials)?.insecureWritesApproved === true,
        },
        flags: {
          outboundEnabled: asRecord(response.data.flags)?.outboundEnabled === true,
          documentExportEnabled:
            asRecord(response.data.flags)?.documentExportEnabled === true,
        },
      });

      if (connections.length > 0 && form.id === null) {
        setForm(toForm(connections[0]));
      }
    } catch {
      setLoadError('ارتباط با سرور برقرار نشد.');
    }
  }, [form.id]);

  useEffect(() => {
    void loadPanel();
  }, [loadPanel]);

  const save = async () => {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      const response = await callAppRoute(ACCOUNTING_CONNECTION_ROUTE, {
        action: 'save',
        name: form.name,
        adapterId: form.adapterId,
        ...(form.id === null ? {} : { id: form.id }),
        settings: {
          baseUrl: form.baseUrl,
          remoteUserId: form.remoteUserId,
          defaultStorageId: form.defaultStorageId,
          moneyUnit: form.moneyUnit,
          transportApproved: form.transportApproved,
          specialCodes: {
            discount: form.discount,
            duty: form.duty,
            tax: form.tax,
          },
          taxPolicyMappings: parseTaxPolicyMappingsText(
            form.taxPolicyMappingsText,
          ),
        },
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'ذخیرهٔ تنظیمات اتصال انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      const saved = asRecord(response.data.connection);

      if (saved !== null) {
        setForm(toForm(saved as unknown as ConnectionRecord));
      }

      setTestResult(null);
      await enqueueSnackbar({
        message: 'تنظیمات اتصال ذخیره شد؛ آزمایش اتصال را اجرا کنید.',
        variant: 'success',
      });
      await loadPanel();
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (busy || activeConnectionId === null) {
      await enqueueSnackbar({
        message: 'ابتدا تنظیمات اتصال را ذخیره کنید، سپس آزمایش کنید.',
        variant: 'info',
      });
      return;
    }

    setBusy(true);

    try {
      const response = await callAppRoute(ACCOUNTING_CONNECTION_ROUTE, {
        action: 'test',
        connectionId: activeConnectionId,
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'آزمایش اتصال انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      setTestResult({
        healthState: readString(response.data.healthState),
        message: readString(response.data.message),
        detail: readString(response.data.detail),
        verificationState: readString(response.data.verificationState),
      });

      await enqueueSnackbar({
        message: readString(response.data.message),
        variant:
          readString(response.data.healthState) === 'OK' ? 'success' : 'warning',
      });
      await loadPanel();
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const previewItems = async () => {
    if (busy || activeConnectionId === null) {
      return;
    }

    setBusy(true);

    try {
      const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
        action: 'preview-items',
        connectionId: activeConnectionId,
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'دریافت پیش‌نمایش کالاها انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      const preview = asRecord(response.data.preview);

      if (preview === null) {
        return;
      }

      setItemPreview(preview as unknown as ItemPreview);
      setImportOutcome(null);
      setSelectedExternalIds([]);
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const previewParties = async () => {
    if (busy || activeConnectionId === null) {
      return;
    }

    setBusy(true);

    try {
      const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
        action: 'preview-parties',
        connectionId: activeConnectionId,
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'دریافت پیش‌نمایش مشتریان انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      const preview = asRecord(response.data.preview);

      if (preview !== null) {
        setPartyPreview(preview as unknown as PartyPreview);
      }
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const applyItems = async () => {
    if (busy || activeConnectionId === null || selectedExternalIds.length === 0) {
      return;
    }

    setBusy(true);

    try {
      const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
        action: 'apply-items',
        connectionId: activeConnectionId,
        selections: selectedExternalIds.map((externalItemId) => ({
          externalItemId,
        })),
        allowRemoteVersionUpdate,
        applyPrices,
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'اعمال موارد انتخاب‌شده انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      const outcome = asRecord(response.data.outcome);

      if (outcome !== null) {
        setImportOutcome(
          `کالای ساخته‌شده: ${String(outcome.createdItems ?? 0)} — پیوند ساخته‌شده: ${String(
            outcome.createdLinks ?? 0,
          )} — پیوند به‌روزشده: ${String(outcome.updatedLinks ?? 0)} — قیمت ثبت‌شده: ${String(
            outcome.createdPrices ?? 0,
          )} — رد‌شده: ${String(readRows(outcome.refused).length)}`,
        );
      }

      await enqueueSnackbar({
        message: 'اعمال موارد انتخاب‌شده انجام شد.',
        variant: 'success',
      });
      await previewItems();
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const loadOperations = async () => {
    if (busy || activeConnectionId === null) {
      return;
    }

    setBusy(true);

    try {
      const response = await callAppRoute(ACCOUNTING_OUTBOUND_ROUTE, {
        action: 'operations',
        connectionId: activeConnectionId,
      });

      if (response.ok && response.data.success === true) {
        setOperations(
          readRows(response.data.operations).map(
            (node) => node as unknown as OperationRow,
          ),
        );
      }
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const previewQuotationExport = async () => {
    if (busy || activeConnectionId === null || quotationId === null) {
      return;
    }

    setBusy(true);

    try {
      const response = await callAppRoute(ACCOUNTING_OUTBOUND_ROUTE, {
        action: 'preview-quotation-export',
        connectionId: activeConnectionId,
        quotationId,
      });

      if (!response.ok || response.data.success !== true) {
        setExportPreview(
          toPersianUiMessage(
            readString(response.data.message),
            'پیش‌نمایش ثبت پیش‌فاکتور انجام نشد.',
          ),
        );
        return;
      }

      const decision = asRecord(asRecord(response.data.preview)?.decision);

      if (decision === null) {
        setExportPreview('پاسخ پیش‌نمایش نامعتبر بود.');
        return;
      }

      setExportPreview(
        decision.kind === 'READY'
          ? 'پیش‌فاکتور تأییدشده آمادهٔ ثبت در حسابداری است.'
          : decision.kind === 'BLOCKED'
            ? `ثبت انجام نمی‌شود: ${readString(decision.detail)}`
            : `وضعیت: ${readString(decision.kind)}`,
      );
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const executeQuotationExport = async () => {
    if (busy || activeConnectionId === null || quotationId === null) {
      return;
    }

    setBusy(true);

    try {
      const response = await callAppRoute(ACCOUNTING_OUTBOUND_ROUTE, {
        action: 'execute-quotation-export',
        connectionId: activeConnectionId,
        quotationId,
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'ثبت پیش‌فاکتور در حسابداری انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      const outcome = asRecord(response.data.outcome);

      await enqueueSnackbar({
        message: `سند حسابداری ثبت شد: ${readString(outcome?.documentNumber)}`,
        variant: 'success',
      });
      setExportPreview(null);
      await loadOperations();
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const connection =
    data?.connections.find((entry) => entry.id === activeConnectionId) ?? null;
  const descriptor =
    data?.adapters.find((entry) => entry.id === form.adapterId) ?? null;

  const toggleExternalId = (externalItemId: string) => {
    setSelectedExternalIds((current) =>
      current.includes(externalItemId)
        ? current.filter((entry) => entry !== externalItemId)
        : [...current, externalItemId],
    );
  };

  const selectableDecisions = new Set([
    'CREATE',
    'LINK_SUGGESTED',
    'LINK_AMBIGUOUS',
    'REMOTE_CHANGED',
  ]);

  if (loadError !== null) {
    return (
      <div style={styles.root} dir="rtl">
        <p style={styles.error}>{loadError}</p>
        <button type="button" style={styles.button} onClick={() => void loadPanel()}>
          تلاش دوباره
        </button>
      </div>
    );
  }

  if (data === null) {
    return (
      <div style={styles.root} dir="rtl">
        <p style={styles.meta}>در حال بارگذاری تنظیمات حسابداری…</p>
      </div>
    );
  }

  return (
    <div style={styles.root} dir="rtl">
      <h2 style={styles.title}>اتصال حسابداری</h2>
      <p style={styles.meta}>
        اتصال، تنظیمات و آزمایش پاسخ نرم‌افزار حسابداری. دادهٔ واقعی تا تأیید
        انتقال امن و واحد مبلغ ارسال نمی‌شود.
      </p>

      {data.connections.length > 1 ? (
        <div style={styles.row}>
          {data.connections.map((entry) => (
            <button
              key={entry.id}
              type="button"
              style={{
                ...styles.button,
                ...(entry.id === activeConnectionId ? styles.buttonPrimary : {}),
              }}
              onClick={() => {
                setForm(toForm(entry));
                setTestResult(null);
                setItemPreview(null);
                setPartyPreview(null);
                setOperations([]);
                setExportPreview(null);
              }}
            >
              {entry.name}
            </button>
          ))}
        </div>
      ) : null}

      <div style={styles.section}>
        <p style={styles.subtitle}>تنظیم نرم‌افزار مقصد</p>

        <div style={styles.row}>
          <Field label="نوع نرم‌افزار">
            <select
              style={styles.input}
              value={form.adapterId}
              onChange={(event) =>
                setForm({ ...form, adapterId: event.target.value })
              }
            >
              {data.adapters.map((adapter) => (
                <option key={adapter.id} value={adapter.id}>
                  {adapter.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="نام اتصال">
            <input
              style={styles.input}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
        </div>

        {descriptor !== null ? (
          <>
            <p style={styles.meta}>{descriptor.summary}</p>
            {descriptor.readiness !== 'MOCK_ONLY' ? (
              <p style={styles.warning}>
                وضعیت این آداپتور «{VERIFICATION_LABELS[descriptor.readiness] ?? descriptor.readiness}»
                است: قابلیت‌ها از مستندات استخراج شده‌اند و تا پاسخ سرور واقعی،
                نتیجهٔ همگام‌سازی اثبات‌شده نیست.
              </p>
            ) : null}
            <ul style={{ ...styles.meta, margin: 0, paddingInlineStart: '1rem' }}>
              {descriptor.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </>
        ) : null}

        {form.adapterId === 'asan' ? (
          <>
            <div style={styles.row}>
              <Field label="آدرس سرویس">
                <input
                  style={{ ...styles.input, direction: 'ltr' }}
                  value={form.baseUrl}
                  placeholder="http://127.0.0.1:8080"
                  onChange={(event) =>
                    setForm({ ...form, baseUrl: event.target.value })
                  }
                />
              </Field>
              <Field label="شناسهٔ کاربر حسابداری">
                <input
                  style={styles.input}
                  value={form.remoteUserId}
                  inputMode="numeric"
                  onChange={(event) =>
                    setForm({ ...form, remoteUserId: event.target.value })
                  }
                />
              </Field>
              <Field label="شناسهٔ انبار پیش‌فرض">
                <input
                  style={styles.input}
                  value={form.defaultStorageId}
                  inputMode="numeric"
                  onChange={(event) =>
                    setForm({ ...form, defaultStorageId: event.target.value })
                  }
                />
              </Field>
            </div>

            <div style={styles.row}>
              <Field label="واحد مبلغ در آسان">
                <select
                  style={styles.input}
                  value={form.moneyUnit}
                  onChange={(event) =>
                    setForm({ ...form, moneyUnit: event.target.value })
                  }
                >
                  <option value="UNCONFIRMED">تأییدنشده (ارسال مبلغ ممنوع)</option>
                  <option value="RIAL">ریال</option>
                  <option value="TOMAN">تومان</option>
                </select>
              </Field>
            </div>

            <div style={styles.checkboxRow}>
              <label>
                <input
                  type="checkbox"
                  checked={form.transportApproved}
                  onChange={(event) =>
                    setForm({ ...form, transportApproved: event.target.checked })
                  }
                />{' '}
                انتقال امن (تونل) تأیید شد
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.discount}
                  onChange={(event) =>
                    setForm({ ...form, discount: event.target.checked })
                  }
                />{' '}
                کد ویژهٔ تخفیف تنظیم شده است
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.duty}
                  onChange={(event) =>
                    setForm({ ...form, duty: event.target.checked })
                  }
                />{' '}
                کد ویژهٔ عوارض
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.tax}
                  onChange={(event) =>
                    setForm({ ...form, tax: event.target.checked })
                  }
                />{' '}
                کد ویژهٔ مالیات
              </label>
            </div>

            <Field label="نگاشت مالیات CRM به کد مالیات مقصد">
              <textarea
                style={styles.input}
                rows={3}
                value={form.taxPolicyMappingsText}
                placeholder={'IR_VAT_9=999141'}
                onChange={(event) =>
                  setForm({
                    ...form,
                    taxPolicyMappingsText: event.target.value,
                  })
                }
              />
            </Field>
            <p style={styles.meta}>
              هر خط یک نگاشت «کد سیاست مالیات CRM = کد مالیات مقصد». بدون این
              نگاشت، سندی که مالیات دارد ارسال نمی‌شود؛ سیاست‌های CRM و کدهای
              مالیاتی نرم‌افزار حسابداری یکی فرض نمی‌شوند.
            </p>

            {form.moneyUnit === 'UNCONFIRMED' ? (
              <p style={styles.warning}>
                تا زمانی که واحد مبلغ آسان مشخص نشود، هیچ مبلغی ارسال نمی‌شود.
                این تصمیم باید توسط حسابدار تأیید شود.
              </p>
            ) : null}

            {!data.credentials.tunnelTokenConfigured &&
            form.baseUrl.trim().toLowerCase().startsWith('http://') ? (
              <p style={styles.warning}>
                توکن تونل امن تنظیم نشده است. ارسال نوشتن روی آدرس بدون TLS فقط
                با تأیید صریح انجام می‌شود.
              </p>
            ) : null}
          </>
        ) : null}

        <div style={styles.row}>
          <button
            type="button"
            style={{
              ...styles.button,
              ...styles.buttonPrimary,
              ...(busy ? styles.buttonDisabled : {}),
            }}
            disabled={busy}
            onClick={() => void save()}
          >
            ذخیرهٔ تنظیمات
          </button>
          <button
            type="button"
            style={{ ...styles.button, ...(busy ? styles.buttonDisabled : {}) }}
            disabled={busy}
            onClick={() => void test()}
          >
            آزمایش اتصال
          </button>
        </div>

        {testResult !== null ? (
          <p
            style={
              testResult.healthState === 'OK' ? styles.notice : styles.warning
            }
          >
            {testResult.message}
            {testResult.detail ? ` — ${testResult.detail}` : ''}
            {` — وضعیت تأیید: ${
              VERIFICATION_LABELS[testResult.verificationState] ??
              testResult.verificationState
            }`}
          </p>
        ) : null}

        {connection !== null ? (
          <p style={styles.meta}>
            وضعیت ذخیره‌شده: {HEALTH_LABELS[connection.healthState] ?? connection.healthState}
            {connection.lastHealthMessage
              ? ` — ${connection.lastHealthMessage}`
              : ''}
            {` — ${VERIFICATION_LABELS[connection.verificationState] ?? connection.verificationState}`}
          </p>
        ) : (
          <p style={styles.meta}>
            هنوز اتصالی ذخیره نشده است. تنظیمات را ذخیره و سپس آزمایش کنید.
          </p>
        )}
      </div>

      <div style={styles.section}>
        <p style={styles.subtitle}>قابلیت‌های اعلام‌شده و مجوزها</p>
        <p style={styles.meta}>
          ارسال از CRM: {data.flags.outboundEnabled ? 'فعال' : 'خاموش'} — ثبت
          سند: {data.flags.documentExportEnabled ? 'فعال' : 'خاموش'} — توکن تونل:{' '}
          {data.credentials.tunnelTokenConfigured ? 'تنظیم‌شده' : 'تنظیم‌نشده'}
        </p>

        {connection?.capabilityRows !== undefined ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>قابلیت</th>
                <th style={styles.cell}>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {connection.capabilityRows.map((row) => (
                <tr key={`${row.area}-${row.key}`}>
                  <td style={styles.cell}>{row.label}</td>
                  <td style={styles.cell}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={styles.meta}>
            قابلیت‌ها پس از ذخیرهٔ اتصال و بارگذاری مجدد نمایش داده می‌شوند.
          </p>
        )}
      </div>

      <div style={styles.section}>
        <p style={styles.subtitle}>پیش‌نمایش دریافت از حسابداری</p>
        <p style={styles.meta}>
          پیش‌نمایش هیچ رکوردی نمی‌سازد. فقط ردیف‌های تأییدشده اعمال می‌شوند و
          تطبیق فقط از طریق کد مشترک پیشنهاد می‌شود، نه نام.
        </p>

        <div style={styles.row}>
          <button
            type="button"
            style={{ ...styles.button, ...(busy ? styles.buttonDisabled : {}) }}
            disabled={busy || activeConnectionId === null}
            onClick={() => void previewItems()}
          >
            پیش‌نمایش کالاها و قیمت‌ها
          </button>
          <button
            type="button"
            style={{ ...styles.button, ...(busy ? styles.buttonDisabled : {}) }}
            disabled={busy || activeConnectionId === null}
            onClick={() => void previewParties()}
          >
            پیش‌نمایش مشتریان
          </button>
        </div>

        {itemPreview !== null ? (
          <>
            <p style={styles.meta}>
              {`${itemPreview.totalRemoteItems} کالا در مقصد — ایجاد: ${
                itemPreview.summary.CREATE ?? 0
              } — پیشنهاد اتصال: ${itemPreview.summary.LINK_SUGGESTED ?? 0} — هم‌خوان: ${
                itemPreview.summary.IN_SYNC ?? 0
              } — تغییرکرده: ${itemPreview.summary.REMOTE_CHANGED ?? 0} — کد تکراری: ${
                itemPreview.summary.DUPLICATE_REMOTE_CODE ?? 0
              }`}
            </p>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.cell}> </th>
                  <th style={styles.cell}>کد</th>
                  <th style={styles.cell}>نام</th>
                  <th style={styles.cell}>تصمیم</th>
                  <th style={styles.cell}>قیمت</th>
                </tr>
              </thead>
              <tbody>
                {itemPreview.rows.slice(0, 100).map((row) => (
                  <tr key={row.externalItemId}>
                    <td style={styles.cell}>
                      <input
                        type="checkbox"
                        disabled={!selectableDecisions.has(row.decision)}
                        checked={selectedExternalIds.includes(row.externalItemId)}
                        onChange={() => toggleExternalId(row.externalItemId)}
                      />
                    </td>
                    <td style={styles.cell}>{row.code}</td>
                    <td style={styles.cell}>{row.name}</td>
                    <td style={styles.cell}>
                      {DECISION_LABELS[row.decision] ?? row.decision}
                    </td>
                    <td style={styles.cell}>{row.planPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {itemPreview.moneyUnit === 'UNCONFIRMED' ? (
              <p style={styles.warning}>
                واحد مبلغ تأیید نشده است؛ قیمت‌ها نمایش داده می‌شوند ولی قابل
                اعمال نیستند.
              </p>
            ) : null}

            <div style={styles.checkboxRow}>
              <label>
                <input
                  type="checkbox"
                  checked={applyPrices}
                  onChange={(event) => setApplyPrices(event.target.checked)}
                />{' '}
                ثبت قیمت در فهرست پیش‌فرض
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={allowRemoteVersionUpdate}
                  onChange={(event) =>
                    setAllowRemoteVersionUpdate(event.target.checked)
                  }
                />{' '}
                تأیید به‌روزرسانی نسخهٔ ردیف‌های تغییرکرده
              </label>
            </div>

            <button
              type="button"
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                ...(busy || selectedExternalIds.length === 0
                  ? styles.buttonDisabled
                  : {}),
              }}
              disabled={busy || selectedExternalIds.length === 0}
              onClick={() => void applyItems()}
            >
              اعمال ردیف‌های انتخاب‌شده
            </button>

            {importOutcome !== null ? (
              <p style={styles.notice}>{importOutcome}</p>
            ) : null}
          </>
        ) : null}

        {partyPreview !== null ? (
          <>
            <p style={styles.meta}>
              {`${partyPreview.totalRemoteParties} مشتری در مقصد — هم‌خوان: ${
                partyPreview.summary.IN_SYNC ?? 0
              } — نیازمند رکورد CRM: ${
                partyPreview.summary.NEEDS_CRM_RECORD ?? 0
              } — تطبیق مبهم: ${
                partyPreview.summary.AMBIGUOUS_CRM_MATCH ?? 0
              }`}
            </p>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.cell}>کد</th>
                  <th style={styles.cell}>نام</th>
                  <th style={styles.cell}>کد ملی</th>
                  <th style={styles.cell}>تصمیم</th>
                </tr>
              </thead>
              <tbody>
                {partyPreview.rows.slice(0, 100).map((row) => (
                  <tr key={row.externalPartyId}>
                    <td style={styles.cell}>{row.code}</td>
                    <td style={styles.cell}>{row.fullName}</td>
                    <td style={styles.cell}>{row.nationalCode ?? '—'}</td>
                    <td style={styles.cell}>
                      {DECISION_LABELS[row.decision] ?? row.decision}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={styles.notice}>
              اتصال هر مشتری به یک رکورد CRM باید صریح باشد؛ این پنل فقط پیش‌نمایش
              و تشخیص تکراری را نشان می‌دهد و از نام برای تطبیق استفاده نمی‌کند.
            </p>
          </>
        ) : null}
      </div>

      <div style={styles.section}>
        <p style={styles.subtitle}>ثبت پیش‌فاکتور تأییدشده</p>
        {quotationId === null ? (
          <p style={styles.meta}>
            این بخش روی صفحهٔ یک پیش‌فاکتور نمایش داده می‌شود.
          </p>
        ) : (
          <>
            <p style={styles.meta}>
              فقط پیش‌فاکتور تأییدشده، ریالی و با مشتری و ردیف‌های متصل قابل ثبت
              است. پیش‌نویس هرگز به حسابداری منتقل نمی‌شود.
            </p>
            <div style={styles.row}>
              <button
                type="button"
                style={{ ...styles.button, ...(busy ? styles.buttonDisabled : {}) }}
                disabled={busy || activeConnectionId === null}
                onClick={() => void previewQuotationExport()}
              >
                بررسی امکان ثبت
              </button>
              <button
                type="button"
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  ...(busy || activeConnectionId === null
                    ? styles.buttonDisabled
                    : {}),
                }}
                disabled={busy || activeConnectionId === null}
                onClick={() => void executeQuotationExport()}
              >
                ثبت در حسابداری
              </button>
            </div>
            {exportPreview !== null ? (
              <p style={styles.notice}>{exportPreview}</p>
            ) : null}
          </>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.row}>
          <p style={{ ...styles.subtitle, flex: 1 }}>تاریخچهٔ عملیات</p>
          <button
            type="button"
            style={{ ...styles.button, ...(busy ? styles.buttonDisabled : {}) }}
            disabled={busy || activeConnectionId === null}
            onClick={() => void loadOperations()}
          >
            بارگذاری تاریخچه
          </button>
        </div>

        {operations.length === 0 ? (
          <p style={styles.meta}>عملیاتی ثبت نشده است.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>نوع</th>
                <th style={styles.cell}>وضعیت</th>
                <th style={styles.cell}>تلاش</th>
                <th style={styles.cell}>شناسهٔ سند مقصد</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((operation) => (
                <tr key={operation.id}>
                  <td style={styles.cell}>{operation.kind}</td>
                  <td style={styles.cell}>
                    {OPERATION_STATE_LABELS[operation.state] ?? operation.state}
                  </td>
                  <td style={styles.cell}>{operation.attempts}</td>
                  <td style={{ ...styles.cell, direction: 'ltr' }}>
                    {operation.externalDocumentId ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
