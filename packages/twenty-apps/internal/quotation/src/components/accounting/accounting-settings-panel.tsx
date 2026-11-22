import { useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import {
  ACCOUNTING_CONNECTION_ROUTE,
  ACCOUNTING_IMPORT_ROUTE,
  ACCOUNTING_OUTBOUND_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import {
  type ConnectionRecord,
  type FormState,
  type ItemPreview,
  type OperationRow,
  type PanelData,
  type PartyPreview,
  CapabilityTable,
  ConnectionStatus,
  EMPTY_FORM,
  Field,
  HEALTH_LABELS,
  ItemPreviewTable,
  OPERATION_STATE_LABELS,
  OperationTable,
  PartyPreviewTable,
  SEPIDAR_UNAVAILABLE,
  VERIFICATION_LABELS,
  asRecord,
  parsePanelData,
  parseTaxPolicyMappingsText,
  readRows,
  readString,
  sharedStyles as styles,
  toForm,
} from 'src/components/accounting/accounting-shared';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';
import { MOCK_OPERATION_HISTORY_SAMPLES } from 'src/domain/accounting/adapters/mock/mock-dataset';

// The workspace accounting settings page. It owns the connection — which vendor, which
// address, which unit — and nothing about a particular quotation. Whether the visitor may
// change it is decided by the server (`canManage`), and the form is simply not painted
// when the answer is no: the gate itself is the server's.
export const AccountingSettingsPanel = () => {
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
  const [operations, setOperations] = useState<OperationRow[]>([]);

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

      if (parsed.connections.length > 0 && form.id === null) {
        setForm(toForm(parsed.connections[0]));
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

      if (preview !== null) {
        setItemPreview(preview as unknown as ItemPreview);
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

  // A new destination starts empty. Saving it is the same authority-checked route as an
  // edit, so "create" is not a second write path.
  const startNewConnection = () => {
    setForm({ ...EMPTY_FORM, name: 'اتصال آزمایشی جدید', adapterId: 'mock' });
    setTestResult(null);
    setItemPreview(null);
    setPartyPreview(null);
    setOperations([]);
  };

  const connection =
    data?.connections.find((entry) => entry.id === activeConnectionId) ?? null;
  const descriptor =
    data?.adapters.find((entry) => entry.id === form.adapterId) ?? null;
  const canManage = data?.canManage === true;

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
      <h2 style={styles.title}>تنظیمات حسابداری</h2>
      <p style={styles.meta}>
        نرم‌افزار مقصد، آدرس سرویس، واحد پول و نگاشت‌های این فضای کاری. این صفحه
        به یک پیش‌فاکتور خاص وابسته نیست؛ ارسال سند مالی در این نسخه غیرفعال است.
      </p>

      {!canManage ? (
        <p style={styles.warning}>
          شما مجوز تغییر تنظیمات حسابداری را ندارید. مقادیر فعلی فقط برای مشاهده
          نمایش داده می‌شوند.
        </p>
      ) : null}

      <div style={styles.section}>
        <p style={styles.subtitle}>نرم‌افزار مقصد</p>
        <div style={styles.row}>
          {data.adapters.map((adapter) => {
            const selected = adapter.id === form.adapterId;

            return (
              <button
                key={adapter.id}
                type="button"
                disabled={!canManage}
                style={{
                  ...styles.button,
                  ...(selected ? styles.buttonPrimary : {}),
                  ...(canManage ? {} : styles.buttonDisabled),
                }}
                onClick={() => setForm({ ...form, adapterId: adapter.id })}
              >
                {adapter.label}
              </button>
            );
          })}
          <button
            type="button"
            disabled
            style={{ ...styles.button, ...styles.buttonDisabled }}
            title={SEPIDAR_UNAVAILABLE.summary}
          >
            {SEPIDAR_UNAVAILABLE.label} — آداپتور ندارد
          </button>
        </div>
        <p style={styles.meta}>{SEPIDAR_UNAVAILABLE.summary}</p>

        {descriptor !== null ? (
          <>
            <p style={styles.meta}>{descriptor.summary}</p>
            <p style={styles.warning}>
              وضعیت این آداپتور «
              {VERIFICATION_LABELS[descriptor.readiness] ?? descriptor.readiness}
              » است: قابلیت‌ها از مستندات استخراج شده‌اند و تا پاسخ سرور واقعی،
              نتیجهٔ همگام‌سازی اثبات‌شده نیست.
            </p>
            {descriptor.isLive ? (
              <p style={styles.warning}>
                این آداپتور برای آزمایش کامل نیازمند اتصال واقعی به سرور مقصد
                است؛ با اطلاعات آزمایشی فقط خطاهای اتصال و نگاشت قابل مشاهده‌اند
                و هیچ موفقیت ساختگی نمایش داده نمی‌شود.
              </p>
            ) : null}
            <ul style={{ ...styles.meta, margin: 0, paddingInlineStart: '1rem' }}>
              {descriptor.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div style={styles.section}>
        <p style={styles.subtitle}>اتصال‌های ثبت‌شده</p>
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
              }}
            >
              {`${entry.name} — ${entry.adapterId === 'mock' ? 'آزمایشی' : 'آسان'} — ${
                HEALTH_LABELS[entry.healthState] ?? entry.healthState
              }`}
            </button>
          ))}
          <button
            type="button"
            disabled={!canManage}
            style={{ ...styles.button, ...(canManage ? {} : styles.buttonDisabled) }}
            onClick={startNewConnection}
          >
            + اتصال آزمایشی جدید
          </button>
        </div>
        <p style={styles.meta}>
          ساخت اتصال جدید از همین فرم و با تغییر نام ذخیره می‌شود؛ هیچ رکوردی حذف
          نمی‌شود.
        </p>
      </div>

      <div style={styles.section}>
        <p style={styles.subtitle}>تنظیم اتصال</p>

        <div style={styles.row}>
          <Field label="نام اتصال">
            <input
              style={styles.input}
              value={form.name}
              disabled={!canManage}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label="آدرس سرویس">
            <input
              style={{ ...styles.input, direction: 'ltr' }}
              value={form.baseUrl}
              disabled={!canManage}
              placeholder="https://accounting.example.ir/api"
              onChange={(event) =>
                setForm({ ...form, baseUrl: event.target.value })
              }
            />
          </Field>
          <Field label="شناسهٔ کاربر مقصد">
            <input
              style={styles.input}
              value={form.remoteUserId}
              disabled={!canManage}
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
              disabled={!canManage}
              inputMode="numeric"
              onChange={(event) =>
                setForm({ ...form, defaultStorageId: event.target.value })
              }
            />
          </Field>
          <Field label="واحد پول">
            <select
              style={styles.input}
              value={form.moneyUnit}
              disabled={!canManage}
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
              disabled={!canManage}
              onChange={(event) =>
                setForm({ ...form, transportApproved: event.target.checked })
              }
            />{' '}
            انتقال امن (TLS/تونل) تأیید شد
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.discount}
              disabled={!canManage}
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
              disabled={!canManage}
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
              disabled={!canManage}
              onChange={(event) =>
                setForm({ ...form, tax: event.target.checked })
              }
            />{' '}
            کد ویژهٔ مالیات
          </label>
        </div>

        <Field label="نگاشت کد مالیات CRM به کد مالیات مقصد">
          <textarea
            style={styles.input}
            rows={3}
            value={form.taxPolicyMappingsText}
            disabled={!canManage}
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
          هر خط یک نگاشت «کد سیاست مالیات CRM = کد مالیات مقصد». بدون این نگاشت،
          سندی که مالیات دارد ارسال نمی‌شود؛ سیاست‌های CRM و کدهای مالیاتی
          نرم‌افزار حسابداری یکی فرض نمی‌شوند.
        </p>

        {form.moneyUnit === 'UNCONFIRMED' ? (
          <p style={styles.warning}>
            واحد پول تأیید نشده است؛ انتقال مالی مسدود می‌ماند تا حسابدار ریال یا
            تومان را تعیین کند.
          </p>
        ) : null}

        {!data.credentials.tunnelTokenConfigured &&
        form.baseUrl.trim().toLowerCase().startsWith('http://') ? (
          <p style={styles.warning}>
            توکن تونل امن تنظیم نشده است. ارسال نوشتن روی آدرس بدون TLS فقط با
            تأیید صریح انجام می‌شود.
          </p>
        ) : null}

        {canManage ? (
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
        ) : null}

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
          <ConnectionStatus connection={connection} />
        ) : (
          <p style={styles.meta}>
            هنوز اتصالی ذخیره نشده است. تنظیمات را ذخیره و سپس آزمایش کنید.
          </p>
        )}
      </div>

      <div style={styles.section}>
        <p style={styles.subtitle}>وضعیت اطلاعات محرمانه</p>
        <p style={styles.meta}>
          رمزها و توکن‌ها فقط در متغیرهای محرمانهٔ برنامه نگهداری می‌شوند و در این
          صفحه، رکورد یا پاسخ API نمایش داده نمی‌شوند.
        </p>
        <p style={styles.meta}>
          توکن تونل:{' '}
          {data.credentials.tunnelTokenConfigured ? 'تنظیم‌شده' : 'تنظیم‌نشده'} —
          تأیید انتقال ناامن:{' '}
          {data.credentials.insecureWritesApproved ? 'دارد' : 'ندارد'}
        </p>
      </div>

      <div style={styles.section}>
        <p style={styles.subtitle}>قابلیت‌های اعلام‌شده آداپتور</p>
        {connection !== null ? (
          <CapabilityTable connection={connection} />
        ) : (
          <p style={styles.meta}>
            قابلیت‌ها پس از ذخیرهٔ اتصال و بارگذاری مجدد نمایش داده می‌شوند.
          </p>
        )}
      </div>

      <div style={styles.section}>
        <p style={styles.subtitle}>وضعیت قفل ارسال</p>
        <p style={styles.meta}>
          ارسال به مقصد: {data.flags.outboundEnabled ? 'فعال' : 'خاموش'} — ثبت
          سند مالی: {data.flags.documentExportEnabled ? 'فعال' : 'خاموش'}
        </p>
        {data.flags.outboundEnabled || data.flags.documentExportEnabled ? (
          <p style={styles.warning}>
            یکی از سوئیچ‌های ارسال فعال است؛ این صفحه خودش هیچ سندی ارسال نمی‌کند.
          </p>
        ) : (
          <p style={styles.notice}>
            هر دو سوئیچ ارسال خاموش‌اند؛ هیچ عملیات نوشتنی به نرم‌افزار حسابداری
            انجام نمی‌شود.
          </p>
        )}
      </div>

      <div style={styles.section}>
        <p style={styles.subtitle}>پیش‌نمایش کالاها و مشتریان مقصد</p>
        <p style={styles.meta}>
          پیش‌نمایش هیچ رکوردی نمی‌سازد و فقط برای کاربر مجاز اجرا می‌شود.
        </p>

        {canManage ? (
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
        ) : (
          <p style={styles.meta}>
            پیش‌نمایش دریافت داده فقط برای مدیر فضای کاری یا هویت برنامهٔ مجاز
            در دسترس است.
          </p>
        )}

        {itemPreview !== null ? (
          <ItemPreviewTable preview={itemPreview} />
        ) : null}

        {partyPreview !== null ? (
          <PartyPreviewTable preview={partyPreview} />
        ) : null}
      </div>

      {form.adapterId === 'mock' ? (
        <div style={styles.section}>
          <p style={styles.subtitle}>تاریخچهٔ نمایشی عملیات (ثبت نمی‌شود)</p>
          <p style={styles.meta}>
            این ردیف‌ها از دادهٔ ثابت آداپتور آزمایشی می‌آیند و در پایگاه داده نوشته
            نمی‌شوند؛ برای تمرین خواندن نتیجهٔ موفق، ناموفق و نیازمند اقدام دستی.
          </p>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>وضعیت</th>
                <th style={styles.cell}>نوع</th>
                <th style={styles.cell}>مرجع</th>
                <th style={styles.cell}>تلاش</th>
                <th style={styles.cell}>پیام</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_OPERATION_HISTORY_SAMPLES.map((sample) => (
                <tr key={`${sample.kind}:${sample.reference}`}>
                  <td style={styles.cell}>
                    {OPERATION_STATE_LABELS[sample.state] ?? sample.state}
                  </td>
                  <td style={styles.cell}>{sample.kind}</td>
                  <td style={{ ...styles.cell, direction: 'ltr' }}>
                    {sample.reference}
                  </td>
                  <td style={styles.cell}>{sample.attempts}</td>
                  <td style={styles.cell}>{sample.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div style={styles.section}>
        <div style={styles.row}>
          <p style={{ ...styles.subtitle, flex: 1 }}>وضعیت همگام‌سازی و خطاها</p>
          <button
            type="button"
            style={{ ...styles.button, ...(busy ? styles.buttonDisabled : {}) }}
            disabled={busy || activeConnectionId === null}
            onClick={() => void loadOperations()}
          >
            بارگذاری تاریخچه
          </button>
        </div>
        <OperationTable operations={operations} />
      </div>
    </div>
  );
};
