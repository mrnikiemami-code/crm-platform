import { useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import {
  ACCOUNTING_CONNECTION_ROUTE,
  ACCOUNTING_OUTBOUND_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import { Tabs } from 'src/components/accounting/accounting-business-ui';
import { AccountingCatalogSection } from 'src/components/accounting/accounting-catalog-section';
import { AccountingConnectionsSection } from 'src/components/accounting/accounting-connections-section';
import { AccountingCustomerSection } from 'src/components/accounting/accounting-customer-section';
import { AccountingDocumentsSection } from 'src/components/accounting/accounting-documents-section';
import { AccountingOverviewSection } from 'src/components/accounting/accounting-overview-section';
import {
  type ConnectionRecord,
  type FormState,
  type OperationRow,
  type PanelData,
  EMPTY_FORM,
  asRecord,
  parsePanelData,
  parseTaxPolicyMappingsText,
  readRows,
  readString,
  sharedStyles as styles,
  toForm,
} from 'src/components/accounting/accounting-shared';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

type SectionId = 'overview' | 'connections' | 'catalog' | 'customers' | 'documents';

// The workspace accounting settings page, as five business sections instead of one long
// developer-facing column.
//
// The shell owns three things: which connection is active, which section is open, and the
// authority the server granted (`canManage`). Each section owns its own one-page data, so
// opening "customers" does not read the catalog and does not re-read the connection list.
export const AccountingSettingsPanel = () => {
  const [data, setData] = useState<PanelData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<SectionId>('overview');
  const [testResult, setTestResult] = useState<{
    healthState: string;
    message: string;
    detail: string;
  } | null>(null);
  const [operations, setOperations] = useState<OperationRow[]>([]);
  const [pendingItems, setPendingItems] = useState(0);
  const [pendingCustomers, setPendingCustomers] = useState(0);

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

      const parsed = parsePanelData(response.data);

      setData(parsed);

      // The first load picks the first connection; later loads must not overwrite the one
      // the person is working on.
      setForm((current) => {
        if (current.id !== null) {
          const refreshed = parsed.connections.find(
            (entry) => entry.id === current.id,
          );

          return refreshed === undefined ? current : toForm(refreshed);
        }

        return parsed.connections.length > 0
          ? toForm(parsed.connections[0])
          : current;
      });
    } catch {
      setLoadError('ارتباط با سرور برقرار نشد.');
    }
  }, []);

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

  useEffect(() => {
    if (section !== 'documents' || activeConnectionId === null) {
      return;
    }

    void loadOperations();
    // Deliberately keyed on the connection and the section: re-opening the section is what
    // refreshes the history, not a timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, activeConnectionId]);

  // A new destination starts empty. Saving it is the same authority-checked route as an
  // edit, so "create" is not a second write path.
  const startNewConnection = () => {
    setForm({ ...EMPTY_FORM, name: 'اتصال آزمایشی جدید', adapterId: 'mock' });
    setTestResult(null);
    setOperations([]);
    setSection('connections');
  };

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

  const connection =
    data.connections.find((entry) => entry.id === activeConnectionId) ?? null;
  const moneyUnitLabel =
    form.moneyUnit === 'TOMAN'
      ? 'تومان'
      : form.moneyUnit === 'RIAL'
        ? 'ریال'
        : '';
  const taxMappingCount = Object.keys(
    parseTaxPolicyMappingsText(form.taxPolicyMappingsText),
  ).length;

  const tabs = [
    { id: 'overview', label: 'نمای کلی' },
    { id: 'connections', label: 'اتصال‌ها', count: data.connections.length },
    { id: 'catalog', label: 'کالاها و خدمات' },
    { id: 'customers', label: 'مشتریان' },
    { id: 'documents', label: 'اسناد و سوابق' },
  ];

  return (
    <div style={styles.root} dir="rtl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h2 style={styles.title}>حسابداری</h2>
        <p style={styles.meta}>
          {connection === null
            ? 'اتصال این فضای کاری به نرم‌افزار حسابداری، کالاها، مشتریان و سوابق.'
            : `اتصال فعال: ${connection.name} — ${
                connection.adapterId === 'mock'
                  ? 'حسابداری آزمایشی'
                  : 'نرم‌افزار حسابداری آسان'
              }`}
        </p>
      </div>

      <Tabs
        tabs={tabs}
        activeId={section}
        onSelect={(id) => setSection(id as SectionId)}
      />

      {section === 'overview' ? (
        <AccountingOverviewSection
          data={data}
          activeConnectionId={activeConnectionId}
          pendingItems={pendingItems}
          pendingCustomers={pendingCustomers}
          onGoTo={(id) => setSection(id as SectionId)}
        />
      ) : null}

      {section === 'connections' ? (
        <AccountingConnectionsSection
          data={data}
          form={form}
          canManage={data.canManage}
          busy={busy}
          activeConnectionId={activeConnectionId}
          testResult={testResult}
          onSelect={(entry) => {
            setForm(toForm(entry));
            setTestResult(null);
            setOperations([]);
          }}
          onChange={setForm}
          onSave={() => void save()}
          onTest={() => void test()}
          onStartNew={startNewConnection}
        />
      ) : null}

      {section === 'catalog' ? (
        <AccountingCatalogSection
          connectionId={activeConnectionId}
          canManage={data.canManage}
          moneyUnitLabel={moneyUnitLabel}
          onPendingCountChange={setPendingItems}
        />
      ) : null}

      {section === 'customers' ? (
        <AccountingCustomerSection
          connectionId={activeConnectionId}
          canManage={data.canManage}
          onPendingCountChange={setPendingCustomers}
        />
      ) : null}

      {section === 'documents' ? (
        <AccountingDocumentsSection
          connection={connection}
          operations={operations}
          busy={busy}
          canManage={data.canManage}
          outboundEnabled={data.flags.outboundEnabled}
          documentExportEnabled={data.flags.documentExportEnabled}
          taxMappingCount={taxMappingCount}
          onReload={() => void loadOperations()}
        />
      ) : null}
    </div>
  );
};
