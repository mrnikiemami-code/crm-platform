import { useMemo, useState, type ReactNode } from 'react';

import {
  Badge,
  Card,
  Details,
  EmptyState,
  InlineAlert,
  PrimaryButton,
  SearchField,
  SecondaryButton,
  StateBlock,
  SubViewBar,
} from 'src/components/accounting/accounting-business-ui';
import {
  type AdapterDescriptor,
  CapabilityTable,
  type ConnectionRecord,
  type FormState,
  type PanelData,
  HEALTH_LABELS,
  SEPIDAR_UNAVAILABLE,
  parseTaxPolicyMappingsText,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';

// Connections: a list a person can scan, and one form that opens as an inner view.
//
// The list answers "which software am I connected to, and is it working?". The form answers
// "what do I change?" with three required fields; tax codes and ids — which an accountant
// touches once — live inside «جزئیات فنی», because putting them at the same level as the
// vendor name is what made the previous screen unreadable.
//
// The form is not a modal: it replaces the list inside the same section and carries a back
// bar, so a phone user never has to find an X in a corner to get out.

const ADAPTER_HELP: Record<string, string> = {
  mock: 'بدون تماس واقعی با نرم‌افزار حسابداری؛ برای تمرین و نمایش.',
  asan: 'اتصال به نرم‌افزار حسابداری آسان از طریق آدرس سرویس.',
};

export const AccountingConnectionsSection = ({
  data,
  form,
  canManage,
  busy,
  activeConnectionId,
  testResult,
  view,
  onOpenList,
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
  view: 'list' | 'form';
  onOpenList: () => void;
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
  const selectedAdapterIsLive = descriptor?.isLive === true;
  const savedConnection =
    data.connections.find((entry) => entry.id === activeConnectionId) ?? null;

  if (view === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--t-spacing-2)',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <SearchField
              label="جست‌وجو در اتصال‌ها"
              value={query}
              placeholder="نام اتصال یا نرم‌افزار"
              onChange={setQuery}
            />
          </div>
          <PrimaryButton
            label="+ اتصال جدید"
            onClick={onStartNew}
            disabled={!canManage}
          />
        </div>

        {!canManage ? (
          <InlineAlert tone="info">
            شما مجوز تغییر تنظیمات حسابداری را ندارید؛ اتصال‌ها فقط قابل مشاهده‌اند.
          </InlineAlert>
        ) : null}

        {data.connections.length === 0 ? (
          <EmptyState
            title="هنوز اتصالی ساخته نشده است"
            description="برای دیدن کالاها و مشتریان حسابداری، ابتدا یک اتصال بسازید. با اتصال آزمایشی می‌توانید بدون تماس واقعی تمرین کنید."
            action={
              <PrimaryButton
                label="ساخت اولین اتصال"
                onClick={onStartNew}
                disabled={!canManage}
              />
            }
          />
        ) : (
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table
                aria-label="اتصال‌های حسابداری"
                style={{ ...styles.table, minWidth: '560px' }}
              >
                <thead>
                  <tr>
                    <th style={styles.cell}>اتصال</th>
                    <th style={styles.cell}>نرم‌افزار</th>
                    <th style={styles.cell}>وضعیت</th>
                    <th style={styles.cell}> </th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map((entry) => {
                    const selected = entry.id === activeConnectionId;

                    return (
                      <tr key={entry.id}>
                        <td style={styles.cell}>
                          <span style={{ fontWeight: 'var(--t-font-weight-semi-bold)' }}>
                            {entry.name}
                          </span>
                          {selected ? (
                            <span
                              style={{
                                ...styles.meta,
                                display: 'block',
                                fontSize: 'var(--t-font-size-xs)',
                              }}
                            >
                              اتصال فعال این صفحه
                            </span>
                          ) : null}
                        </td>
                        <td style={styles.cell}>
                          {entry.adapterId === 'mock'
                            ? 'حسابداری آزمایشی'
                            : 'نرم‌افزار حسابداری آسان'}
                        </td>
                        <td style={styles.cell}>
                          <Badge
                            tone={
                              entry.healthState === 'OK'
                                ? 'success'
                                : entry.healthState === 'FAILED'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {HEALTH_LABELS[entry.healthState] ?? entry.healthState}
                          </Badge>
                        </td>
                        <td style={styles.cell}>
                          <button
                            type="button"
                            style={styles.button}
                            onClick={() => onSelect(entry)}
                          >
                            {selected ? 'ویرایش تنظیمات' : 'انتخاب و ویرایش'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {connections.length === 0 ? (
                    <tr>
                      <td style={styles.cell} colSpan={4}>
                        {`اتصالی با «${query}» پیدا نشد.`}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)', marginTop: '6px' }}>
              برای تغییر نام، آدرس یا واحد پول، اتصال را انتخاب کنید.
            </p>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
      <SubViewBar
        backLabel="بازگشت به فهرست اتصال‌ها"
        label={
          form.id === null
            ? 'اتصال تازه؛ پس از ذخیره، آزمایش کنید.'
            : `در حال ویرایش: ${form.name}`
        }
        onBack={onOpenList}
      />

      {!canManage ? (
        <InlineAlert tone="warning">
          شما مجوز تغییر تنظیمات حسابداری را ندارید. مقادیر فعلی فقط برای مشاهده نمایش داده
          می‌شوند.
        </InlineAlert>
      ) : null}

      <Card>
        <p style={styles.subtitle}>۱. نرم‌افزار حسابداری</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {data.adapters.map((adapter) => (
            <label
              key={adapter.id}
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                border:
                  adapter.id === form.adapterId
                    ? '1px solid var(--t-color-blue)'
                    : '1px solid var(--t-border-color-light)',
                borderRadius: 'var(--t-border-radius-sm)',
                padding: 'var(--t-spacing-2)',
                cursor: canManage ? 'pointer' : 'not-allowed',
              }}
            >
              <input
                type="radio"
                name="adapter"
                checked={adapter.id === form.adapterId}
                disabled={!canManage}
                onChange={() => onChange({ ...form, adapterId: adapter.id })}
                style={{ marginTop: '3px' }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <span style={{ fontSize: 'var(--t-font-size-sm)' }}>{adapter.label}</span>
                <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
                  {ADAPTER_HELP[adapter.id] ?? adapter.summary}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <p style={styles.subtitle}>۲. نام، آدرس و واحد پول</p>
        <div style={styles.row}>
          <Field label="نام اتصال">
            <input
              style={styles.input}
              value={form.name}
              disabled={!canManage}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
            />
          </Field>

          {selectedAdapterIsLive ? (
            <Field label="آدرس سرویس">
              <input
                style={{ ...styles.input, direction: 'ltr', textAlign: 'left' }}
                value={form.baseUrl}
                disabled={!canManage}
                placeholder="https://accounting.example.ir/api"
                onChange={(event) =>
                  onChange({ ...form, baseUrl: event.target.value })
                }
              />
            </Field>
          ) : (
            <Field label="آدرس سرویس">
              <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-sm)' }}>
                لازم نیست؛ این نوع اتصال به سرور بیرونی وصل نمی‌شود.
              </span>
            </Field>
          )}
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
          <InlineAlert title="واحد پول تأیید نشده است">
            تا وقتی ریال یا تومان را انتخاب نکنید، مبلغی به حسابداری فرستاده نمی‌شود.
          </InlineAlert>
        ) : null}

        {!data.credentials.tunnelTokenConfigured &&
        form.baseUrl.trim().toLowerCase().startsWith('http://') ? (
          <InlineAlert title="ارتباط امن تنظیم نشده است">
            آدرس با http شروع می‌شود و توکن تونل امن تنظیم نشده است. خواندن انجام می‌شود،
            اما نوشتن فقط با تأیید صریح در «جزئیات فنی» ممکن است.
          </InlineAlert>
        ) : null}

        <div style={{ display: 'flex', gap: 'var(--t-spacing-2)', flexWrap: 'wrap', marginTop: '6px' }}>
          <PrimaryButton
            label="ذخیرهٔ تنظیمات"
            onClick={onSave}
            disabled={busy || !canManage}
          />
          <SecondaryButton
            label={busy ? 'در حال اجرا…' : 'آزمایش اتصال'}
            onClick={onTest}
            disabled={busy || activeConnectionId === null}
          />
        </div>

        {testResult === null ? null : (
          <InlineAlert
            tone={testResult.healthState === 'OK' ? 'success' : 'warning'}
            title={
              testResult.healthState === 'OK'
                ? 'اتصال برقرار است'
                : 'اتصال برقرار نشد'
            }
          >
            {testResult.message}
            {testResult.detail ? ` — ${testResult.detail}` : ''}
          </InlineAlert>
        )}

        {savedConnection === null ? (
          <p style={styles.meta}>هنوز ذخیره نشده است؛ پس از ذخیره می‌توانید آزمایش کنید.</p>
        ) : (
          <InlineAlert
            tone={savedConnection.healthState === 'OK' ? 'success' : 'warning'}
            title={`وضعیت ذخیره‌شده: ${
              HEALTH_LABELS[savedConnection.healthState] ?? savedConnection.healthState
            }`}
          >
            {savedConnection.lastHealthCheckAt === null
              ? 'این اتصال هنوز آزمایش نشده است.'
              : `آخرین آزمایش: ${savedConnection.lastHealthCheckAt}`}
            {savedConnection.lastHealthMessage === null
              ? ''
              : ` — ${savedConnection.lastHealthMessage}`}
          </InlineAlert>
        )}
      </Card>

      <Details summary="جزئیات فنی: کدهای ویژه، نگاشت مالیات، انبار و شناسهٔ کاربر مقصد">
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
              onChange={(event) => onChange({ ...form, duty: event.target.checked })}
            />{' '}
            کد ویژهٔ عوارض
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.tax}
              disabled={!canManage}
              onChange={(event) => onChange({ ...form, tax: event.target.checked })}
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
        <span>
          هر خط یک اتصال «کد سیاست مالیات CRM = کد مالیات مقصد». تا وقتی این نگاشت خالی
          است، سند دارای مالیات به حسابداری فرستاده نمی‌شود.
        </span>
        <span>
          {`نگاشت‌های ثبت‌شده: ${Object.keys(
            parseTaxPolicyMappingsText(form.taxPolicyMappingsText),
          ).length.toLocaleString('fa-IR')} مورد`}
        </span>

        {descriptor === null ? null : (
          <>
            <span style={{ fontWeight: 'var(--t-font-weight-semi-bold)' }}>
              این نرم‌افزار چه می‌تواند و چه نمی‌تواند
            </span>
            <span>{descriptor.summary}</span>
            <ul style={{ margin: 0, paddingInlineStart: '1.1rem' }}>
              {descriptor.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
            {savedConnection === null ? null : (
              <CapabilityTable connection={savedConnection} />
            )}
          </>
        )}

        <span>
          {`نرم‌افزار سپیدار: ${SEPIDAR_UNAVAILABLE.summary}`}
        </span>
        <span>
          {`توکن تونل: ${
            data.credentials.tunnelTokenConfigured ? 'تنظیم‌شده' : 'تنظیم‌نشده'
          } — تأیید انتقال ناامن: ${
            data.credentials.insecureWritesApproved ? 'دارد' : 'ندارد'
          }`}
        </span>
        <span>
          رمزها و توکن‌ها فقط در متغیرهای محرمانهٔ برنامه نگهداری می‌شوند و در این صفحه،
          رکورد یا پاسخ API نمایش داده نمی‌شوند.
        </span>
      </Details>

      {busy ? (
        <StateBlock
          state="loading"
          title="در حال ارتباط با نرم‌افزار حسابداری…"
          description="تا پایان این عملیات دوباره تلاش نکنید."
        />
      ) : null}
    </div>
  );
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
