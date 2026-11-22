import { useMemo, useState } from 'react';

import {
  Badge,
  Card,
  SearchField,
  SectionHeader,
  StatCard,
  StatGrid,
} from 'src/components/accounting/accounting-business-ui';
import {
  type AdapterDescriptor,
  type ConnectionRecord,
  type FormState,
  type PanelData,
  CapabilityTable,
  ConnectionStatus,
  HEALTH_LABELS,
  SEPIDAR_UNAVAILABLE,
  VERIFICATION_LABELS,
  parseTaxPolicyMappingsText,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';

// Connections: the vendor, the address, the money unit — as a list a person can scan and a
// form that only shows the technical half when asked.
//
// The previous screen put every connection in one wrapping row of chips and every field in
// one block. At three connections that was crowded; the real problem was that tax codes and
// special codes — which an accountant touches once — sat at the same level as the vendor
// name — which they check every visit. The advanced block is therefore folded away behind a
// summary, not removed.
export const AccountingConnectionsSection = ({
  data,
  form,
  canManage,
  busy,
  activeConnectionId,
  testResult,
  onSelect,
  onChange,
  onSave,
  onTest,
  onStartNew,
}: {
  data: PanelData;
  form: FormState;
  canManage: boolean;
  busy: boolean;
  activeConnectionId: string | null;
  testResult: { healthState: string; message: string; detail: string } | null;
  onSelect: (connection: ConnectionRecord) => void;
  onChange: (form: FormState) => void;
  onSave: () => void;
  onTest: () => void;
  onStartNew: () => void;
}) => {
  const [query, setQuery] = useState('');

  const connections = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (needle === '') {
      return data.connections;
    }

    return data.connections.filter((connection) =>
      [
        connection.name,
        connection.adapterId === 'mock' ? 'آزمایشی' : 'آسان',
        HEALTH_LABELS[connection.healthState] ?? connection.healthState,
      ].some((field) => field.toLowerCase().includes(needle)),
    );
  }, [data.connections, query]);

  const descriptor: AdapterDescriptor | null =
    data.adapters.find((entry) => entry.id === form.adapterId) ?? null;
  const connection =
    data.connections.find((entry) => entry.id === activeConnectionId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
      <StatGrid>
        <StatCard
          label="اتصال‌های ثبت‌شده"
          value={data.connections.length.toLocaleString('fa-IR')}
        />
        <StatCard
          label="اتصال انتخاب‌شده"
          value={connection?.name ?? 'انتخاب نشده'}
          hint={connection === null ? 'برای شروع یکی را انتخاب کنید' : undefined}
          tone={connection === null ? 'warning' : 'info'}
        />
        <StatCard
          label="آخرین آزمایش"
          value={
            connection === null
              ? '—'
              : (HEALTH_LABELS[connection.healthState] ?? connection.healthState)
          }
          tone={
            connection?.healthState === 'OK'
              ? 'success'
              : connection?.healthState === 'FAILED'
                ? 'danger'
                : 'neutral'
          }
        />
        <StatCard
          label="ارسال سند مالی"
          value={
            data.flags.documentExportEnabled ? 'فعال' : 'غیرفعال است'
          }
          hint="در این نسخه سندی ارسال نمی‌شود"
          tone={data.flags.documentExportEnabled ? 'danger' : 'success'}
        />
      </StatGrid>

      <SectionHeader
        title="اتصال‌ها"
        description="نرم‌افزار حسابداری‌ای که این فضای کاری با آن کار می‌کند. هر اتصال نام، آدرس و واحد پول خودش را دارد."
        actions={
          <button
            type="button"
            style={{
              ...styles.button,
              ...styles.buttonPrimary,
              ...(canManage ? {} : styles.buttonDisabled),
            }}
            disabled={!canManage}
            onClick={onStartNew}
          >
            + اتصال جدید
          </button>
        }
      />

      {data.connections.length === 0 ? (
        <p style={styles.notice}>
          هنوز اتصالی ثبت نشده است. با «اتصال جدید» یک اتصال بسازید، سپس آن را
          آزمایش کنید.
        </p>
      ) : (
        <>
          <SearchField
            label="جست‌وجو در اتصال‌ها"
            value={query}
            placeholder="نام اتصال یا نرم‌افزار"
            onChange={setQuery}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 'var(--t-spacing-2)',
            }}
          >
            {connections.map((entry) => {
              const selected = entry.id === activeConnectionId;

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelect(entry)}
                  aria-pressed={selected}
                  style={{
                    textAlign: 'right',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    border: selected
                      ? '2px solid var(--t-color-blue)'
                      : '1px solid var(--t-border-color-medium)',
                    borderRadius: 'var(--t-border-radius-sm)',
                    background: 'var(--t-background-primary)',
                    color: 'var(--t-font-color-primary)',
                    padding: 'var(--t-spacing-3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    minWidth: 0,
                  }}
                >
                  <span style={{ fontWeight: 'var(--t-font-weight-semi-bold)' }}>
                    {entry.name}
                  </span>
                  <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
                    {entry.adapterId === 'mock'
                      ? 'حسابداری آزمایشی (بدون تماس واقعی)'
                      : 'نرم‌افزار حسابداری آسان'}
                  </span>
                  <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <Badge
                      tone={
                        entry.healthState === 'OK'
                          ? 'success'
                          : entry.healthState === 'FAILED'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {HEALTH_LABELS[entry.healthState] ?? entry.healthState}
                    </Badge>
                    <Badge tone={entry.adapterId === 'mock' ? 'info' : 'neutral'}>
                      {entry.adapterId === 'mock'
                        ? 'اتصال آزمایشی'
                        : (VERIFICATION_LABELS[entry.verificationState] ??
                          'اتصال واقعی')}
                    </Badge>
                  </span>
                </button>
              );
            })}
            {connections.length === 0 ? (
              <p style={styles.meta}>اتصالی با این نام پیدا نشد.</p>
            ) : null}
          </div>
        </>
      )}

      <div style={styles.section}>
        <SectionHeader
          title={form.id === null ? 'اتصال جدید' : `تنظیم اتصال: ${form.name}`}
          description="نام، آدرس و واحد پول برای همه لازم است. کدهای ویژه و نگاشت مالیات در بخش پیشرفته است."
        />

        {!canManage ? (
          <p style={styles.warning}>
            شما مجوز تغییر تنظیمات حسابداری را ندارید. مقادیر فعلی فقط برای مشاهده
            نمایش داده می‌شوند.
          </p>
        ) : null}

        <div style={styles.row}>
          <Field label="نرم‌افزار حسابداری">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {data.adapters.map((adapter) => (
                <label
                  key={adapter.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: 'var(--t-font-size-sm)',
                  }}
                >
                  <input
                    type="radio"
                    name="adapter"
                    checked={adapter.id === form.adapterId}
                    disabled={!canManage}
                    onChange={() => onChange({ ...form, adapterId: adapter.id })}
                  />
                  {adapter.label}
                </label>
              ))}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: 'var(--t-font-size-sm)',
                  opacity: 0.55,
                }}
                title={SEPIDAR_UNAVAILABLE.summary}
              >
                <input type="radio" disabled checked={false} readOnly />
                {`${SEPIDAR_UNAVAILABLE.label} — پشتیبانی نشده`}
              </label>
            </div>
          </Field>

          <Field label="نام اتصال">
            <input
              style={styles.input}
              value={form.name}
              disabled={!canManage}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
            />
          </Field>

          <Field label="آدرس سرویس">
            <input
              style={{ ...styles.input, direction: 'ltr' }}
              value={form.baseUrl}
              disabled={!canManage}
              placeholder="https://accounting.example.ir/api"
              onChange={(event) =>
                onChange({ ...form, baseUrl: event.target.value })
              }
            />
          </Field>

          <Field label="واحد پول">
            <select
              style={styles.input}
              value={form.moneyUnit}
              disabled={!canManage}
              onChange={(event) =>
                onChange({ ...form, moneyUnit: event.target.value })
              }
            >
              <option value="UNCONFIRMED">تأییدنشده (ارسال مبلغ ممنوع)</option>
              <option value="RIAL">ریال</option>
              <option value="TOMAN">تومان</option>
            </select>
          </Field>
        </div>

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

        <details
          style={{
            border: '1px solid var(--t-border-color-light)',
            borderRadius: 'var(--t-border-radius-sm)',
            padding: 'var(--t-spacing-2)',
          }}
        >
          <summary style={{ cursor: 'pointer', fontSize: 'var(--t-font-size-sm)' }}>
            تنظیمات پیشرفته (کدهای ویژه، نگاشت مالیات، انبار و شناسهٔ کاربر مقصد)
          </summary>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-2)', marginTop: 'var(--t-spacing-2)' }}>
            <div style={styles.row}>
              <Field label="شناسهٔ کاربر مقصد">
                <input
                  style={styles.input}
                  value={form.remoteUserId}
                  disabled={!canManage}
                  inputMode="numeric"
                  onChange={(event) =>
                    onChange({ ...form, remoteUserId: event.target.value })
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
                    onChange({ ...form, defaultStorageId: event.target.value })
                  }
                />
              </Field>
            </div>

            <div style={styles.checkboxRow}>
              <label>
                <input
                  type="checkbox"
                  checked={form.transportApproved}
                  disabled={!canManage}
                  onChange={(event) =>
                    onChange({ ...form, transportApproved: event.target.checked })
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
                    onChange({ ...form, discount: event.target.checked })
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
                    onChange({ ...form, duty: event.target.checked })
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
                    onChange({ ...form, tax: event.target.checked })
                  }
                />{' '}
                کد ویژهٔ مالیات
              </label>
            </div>

            <Field label="اتصال کد مالیات CRM به کد مالیات حسابداری">
              <textarea
                style={styles.input}
                rows={3}
                value={form.taxPolicyMappingsText}
                disabled={!canManage}
                placeholder={'IR_VAT_9=999141'}
                onChange={(event) =>
                  onChange({
                    ...form,
                    taxPolicyMappingsText: event.target.value,
                  })
                }
              />
            </Field>
            <p style={styles.meta}>
              هر خط یک اتصال «کد سیاست مالیات CRM = کد مالیات مقصد». بدون این
              اتصال، سندی که مالیات دارد ارسال نمی‌شود؛ کدهای CRM و کدهای
              نرم‌افزار حسابداری یکی فرض نمی‌شوند.
            </p>

            <p style={styles.meta}>
              {`نگاشت‌های ثبت‌شده: ${
                Object.keys(
                  parseTaxPolicyMappingsText(form.taxPolicyMappingsText),
                ).length
              } مورد`}
            </p>
          </div>
        </details>

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
              onClick={onSave}
            >
              ذخیرهٔ تنظیمات
            </button>
            <button
              type="button"
              style={{ ...styles.button, ...(busy ? styles.buttonDisabled : {}) }}
              disabled={busy || activeConnectionId === null}
              onClick={onTest}
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

      {descriptor !== null ? (
        <Card>
          <p style={styles.subtitle}>این نرم‌افزار چه می‌تواند و چه نمی‌تواند</p>
          <p style={styles.meta}>{descriptor.summary}</p>
          <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
            {`وضعیت: ${
              VERIFICATION_LABELS[descriptor.readiness] ?? descriptor.readiness
            }`}
          </p>
          <ul style={{ ...styles.meta, margin: 0, paddingInlineStart: '1.1rem' }}>
            {descriptor.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
          {connection === null ? null : <CapabilityTable connection={connection} />}
        </Card>
      ) : null}

      <div style={styles.section}>
        <p style={styles.subtitle}>اطلاعات محرمانه</p>
        <p style={styles.meta}>
          رمزها و توکن‌ها فقط در متغیرهای محرمانهٔ برنامه نگهداری می‌شوند و در این
          صفحه، رکورد یا پاسخ API نمایش داده نمی‌شوند.
        </p>
        <p style={styles.meta}>
          {`توکن تونل: ${
            data.credentials.tunnelTokenConfigured ? 'تنظیم‌شده' : 'تنظیم‌نشده'
          } — تأیید انتقال ناامن: ${
            data.credentials.insecureWritesApproved ? 'دارد' : 'ندارد'
          }`}
        </p>
      </div>
    </div>
  );
};

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label style={styles.field}>
    <span style={styles.label}>{label}</span>
    {children}
  </label>
);
