import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

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
  CONNECTION_HEALTH_LABELS,
  CRM_CURRENCY_CODES,
  CURRENCY_MODE_LABELS,
  type ConnectionRecord,
  connectionHealthState,
  type FormState,
  type FinancialModes,
  type PanelData,
  SEPIDAR_UNAVAILABLE,
  TAX_MODE_LABELS,
  type TaxPolicyView,
  parseKeyValueLines,
  parseTaxPolicyMappingsText,
  setMappingRow,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';
import {
  connectionFormFields,
  orderConnections,
  validateConnectionForm,
} from 'src/components/accounting/accounting-connection-rules';

// Connections: a list a person can scan, and one form that opens as an inner view.
//
// The list answers "which software am I connected to, and is it working?". The selected
// connection is pinned first and marked, and SELECTING it is a separate action from editing
// it: choosing which destination the rest of the CRM talks to must not open a form, and must
// not look like an edit.
//
// The form is capability-driven. A destination that books one currency is never asked for a
// currency code; a destination that takes a tax rate is never asked for a fiscal code. The
// fields that do not exist for this adapter are absent, not disabled, so nobody types a value
// that will never be read.

const ADAPTER_HELP: Record<string, string> = {
  mock: 'بدون تماس واقعی با نرم‌افزار حسابداری؛ برای تمرین و نمایش.',
  asan: 'اتصال به نرم‌افزار حسابداری آسان از طریق آدرس سرویس.',
};

const CURRENCY_MODE_HELP: Record<string, string> = {
  SINGLE_CURRENCY:
    'این مقصد همهٔ مبالغ را به یک ارز ثبت می‌کند و کد ارز نمی‌خواهد. فقط ارز پایه و واحد مبلغ را مشخص کنید.',
  CURRENCY_CODE:
    'این مقصد برای هر ارز یک کد می‌خواهد. ارز CRM را به کد همان نرم‌افزار حسابداری نگاشت کنید؛ تا نگاشت کامل نشود سند ارسال نمی‌شود.',
  CURRENCY_NAME:
    'این مقصد نام ارز را می‌خواهد. نام مورد انتظار نرم‌افزار حسابداری را برای هر ارز وارد کنید.',
  CURRENCY_CODE_AND_RATE:
    'این مقصد هم کد ارز و هم نرخ تبدیل می‌خواهد. بدون نرخ معتبر و تأییدشده، سندی ارسال نمی‌شود.',
  UNSUPPORTED:
    'قرارداد ارزی این مقصد مشخص نیست؛ تا روشن‌شدن آن، هیچ سندی ارسال نمی‌شود.',
};

const TAX_MODE_HELP: Record<string, string> = {
  TAX_RATE:
    'این مقصد نرخ مالیات را می‌گیرد. نرخ از سیاست مالیات CRM خوانده می‌شود و کد مالیات لازم نیست.',
  TAX_AMOUNT:
    'این مقصد مبلغ مالیات را می‌گیرد. مبلغ در CRM محاسبه و در نسخهٔ قطعی‌شدهٔ سند ذخیره می‌شود؛ کد مالیات لازم نیست.',
  TAX_CODE:
    'این مقصد برای هر سیاست مالیات یک کد ویژه می‌خواهد. هر سیاست CRM را به کد همان اتصال نگاشت کنید؛ بدون نگاشت، سند دارای مالیات ارسال نمی‌شود.',
  TAX_CODE_AND_AMOUNT:
    'این مقصد هم کد ردیف مالیات و هم مبلغ آن را می‌خواهد. کد سیاست CRM را به کد این اتصال نگاشت کنید؛ مبلغ از سند خوانده می‌شود.',
  UNSUPPORTED:
    'قرارداد فعلی این مقصد امکان انتقال مالیات را ندارد. سند مشمول مالیات به‌جای ارسال بدون مالیات، متوقف می‌شود.',
};

export const AccountingConnectionsSection = ({
  data,
  form,
  modes,
  policies,
  canManage,
  busy,
  selectedConnectionId,
  testResult,
  view,
  focus,
  onOpenList,
  onSelectConnection,
  onEditConnection,
  onChange,
  onSave,
  onTest,
  onStartNew,
}: {
  data: PanelData;
  form: FormState;
  modes: FinancialModes;
  policies: TaxPolicyView[];
  canManage: boolean;
  busy: boolean;
  selectedConnectionId: string | null;
  testResult: { healthState: string; message: string; detail: string } | null;
  view: 'list' | 'form';
  focus: 'money' | 'tax' | null;
  onOpenList: () => void;
  onSelectConnection: (connection: ConnectionRecord) => void;
  onEditConnection: (connection: ConnectionRecord) => void;
  onChange: (form: FormState) => void;
  onSave: () => void;
  onTest: () => void;
  onStartNew: () => void;
}) => {
  const [query, setQuery] = useState('');
  const [attemptedSave, setAttemptedSave] = useState(false);
  const moneyRef = useRef<HTMLDivElement | null>(null);
  const taxRef = useRef<HTMLDivElement | null>(null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (needle === '') {
      return data.connections;
    }

    return data.connections.filter((connection) =>
      [
        connection.name,
        connection.adapterId === 'mock' ? 'آزمایشی' : 'آسان',
        CONNECTION_HEALTH_LABELS[connectionHealthState(connection)],
        connection.settings.baseUrl,
      ].some((field) => field.toLowerCase().includes(needle)),
    );
  }, [data.connections, query]);

  // Selected first, everything else in the order the server returned it. The badge and the
  // row styling are decided by id, not by position, so a refresh cannot silently move the
  // "selected" word onto a different destination.
  const ordered = useMemo(
    () => orderConnections(filtered, selectedConnectionId),
    [filtered, selectedConnectionId],
  );

  const descriptor: AdapterDescriptor | null =
    data.adapters.find((entry) => entry.id === form.adapterId) ?? null;
  const selectedAdapterIsLive = descriptor?.isLive === true;
  const savedConnection =
    data.connections.find((entry) => entry.id === form.id) ?? null;
  const fields = connectionFormFields(modes);
  const taxPolicies = policies.filter((policy) => policy.isActive);

  const issues = validateConnectionForm({
    form,
    adapterIsLive: selectedAdapterIsLive,
    modes,
  });

  useEffect(() => {
    if (view !== 'form' || focus === null) {
      return;
    }

    const target = focus === 'money' ? moneyRef.current : taxRef.current;

    if (target === null) {
      return;
    }

    // The host that renders this panel is not guaranteed to be the browser DOM: a remote
    // one answers querySelector and focus but has no scrollIntoView. Scrolling is a nicety,
    // so it is skipped when absent instead of throwing the whole panel into an error state.
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    const firstControl = target.querySelector?.<HTMLElement>(
      'select, input:not([type="radio"]):not([type="checkbox"]), textarea',
    );

    if (typeof firstControl?.focus === 'function') {
      firstControl.focus();
    }
  }, [view, focus, form.id]);

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
                style={{ ...styles.table, minWidth: '720px' }}
              >
                <thead>
                  <tr>
                    <th style={styles.cell}>اتصال</th>
                    <th style={styles.cell}>نرم‌افزار و مقصد</th>
                    <th style={styles.cell}>وضعیت</th>
                    <th style={styles.cell}>اقدام</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((entry) => {
                    const selected = entry.id === selectedConnectionId;
                    const health = connectionHealthState(entry);

                    return (
                      <tr
                        key={entry.id}
                        data-connection-id={entry.id}
                        data-selected={selected ? 'true' : 'false'}
                        style={
                          selected
                            ? {
                                background:
                                  'color-mix(in srgb, var(--t-color-blue) 9%, transparent)',
                              }
                            : undefined
                        }
                      >
                        <td
                          style={{
                            ...styles.cell,
                            borderInlineStart: selected
                              ? '3px solid var(--t-color-blue)'
                              : undefined,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: selected
                                ? 'var(--t-font-weight-semi-bold)'
                                : undefined,
                              display: 'block',
                            }}
                          >
                            {entry.name}
                          </span>
                          {selected ? (
                            <span style={{ display: 'inline-block', marginTop: '4px' }}>
                              <Badge tone="info">اتصال انتخاب‌شده</Badge>
                            </span>
                          ) : null}
                        </td>
                        <td style={styles.cell}>
                          <span style={{ display: 'block' }}>
                            {entry.adapterId === 'mock'
                              ? 'حسابداری آزمایشی'
                              : 'نرم‌افزار حسابداری آسان'}
                          </span>
                          <span
                            style={{
                              ...styles.meta,
                              display: 'block',
                              fontSize: 'var(--t-font-size-xs)',
                              direction: 'ltr',
                              textAlign: 'right',
                            }}
                          >
                            {entry.adapterId === 'mock'
                              ? 'بدون سرور بیرونی'
                              : entry.settings.baseUrl || 'آدرس سرویس ثبت نشده'}
                          </span>
                        </td>
                        <td style={styles.cell}>
                          <Badge tone={healthTone(health)}>
                            {CONNECTION_HEALTH_LABELS[health]}
                          </Badge>
                        </td>
                        <td style={styles.cell}>
                          <div
                            style={{
                              display: 'flex',
                              gap: '4px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <SecondaryButton
                              label={
                                selected ? 'اتصال انتخاب‌شده' : 'انتخاب این اتصال'
                              }
                              disabled={selected || !canManage}
                              onClick={() => onSelectConnection(entry)}
                            />
                            <SecondaryButton
                              label="ویرایش تنظیمات"
                              disabled={!canManage}
                              onClick={() => onEditConnection(entry)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {ordered.length === 0 ? (
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
              «انتخاب این اتصال» مقصد فعال همهٔ بخش‌های حسابداری را تغییر می‌دهد و فرم را باز
              نمی‌کند. برای تغییر نام، آدرس یا تنظیمات مالی، «ویرایش تنظیمات» را بزنید.
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

        {descriptor !== null && descriptor.testProfiles !== undefined && descriptor.testProfiles.length > 0 ? (
          <Field label="حالت آزمایشی (فقط برای Mock)">
            <select
              style={styles.input}
              value={form.mockProfile}
              disabled={!canManage}
              onChange={(event) =>
                onChange({ ...form, mockProfile: event.target.value })
              }
            >
              {descriptor.testProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {descriptor !== null && descriptor.testProfiles !== undefined ? (
          <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
            {descriptor.testProfiles.find((profile) => profile.id === form.mockProfile)
              ?.summary ?? ''}
          </p>
        ) : null}
      </Card>

      <Card>
        <p style={styles.subtitle}>۲. نام و مقصد</p>
        <div style={styles.row}>
          <Field label="نام اتصال">
            <input
              style={styles.input}
              value={form.name}
              disabled={!canManage}
              aria-invalid={attemptedSave && issues.name !== undefined}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
            />
            <FieldError message={attemptedSave ? issues.name : undefined} />
          </Field>

          {selectedAdapterIsLive ? (
            <Field label="آدرس سرویس">
              <input
                style={{ ...styles.input, direction: 'ltr', textAlign: 'left' }}
                value={form.baseUrl}
                disabled={!canManage}
                aria-invalid={attemptedSave && issues.baseUrl !== undefined}
                placeholder="https://accounting.example.ir/api"
                onChange={(event) =>
                  onChange({ ...form, baseUrl: event.target.value })
                }
              />
              <FieldError message={attemptedSave ? issues.baseUrl : undefined} />
            </Field>
          ) : (
            <Field label="آدرس سرویس">
              <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-sm)' }}>
                لازم نیست؛ این نوع اتصال به سرور بیرونی وصل نمی‌شود.
              </span>
            </Field>
          )}
        </div>

        {!data.credentials.tunnelTokenConfigured &&
        form.baseUrl.trim().toLowerCase().startsWith('http://') ? (
          <InlineAlert title="ارتباط امن تنظیم نشده است">
            آدرس با http شروع می‌شود و توکن تونل امن تنظیم نشده است. خواندن انجام می‌شود،
            اما نوشتن فقط با تأیید صریح در «جزئیات فنی» ممکن است.
          </InlineAlert>
        ) : null}
      </Card>

      <div ref={moneyRef} data-form-section="money" tabIndex={-1}>
        <Card>
          <div
            style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}
          >
            <p style={styles.subtitle}>۳. ارز و واحد پول</p>
            <Badge tone={fields.currencyUnsupported ? 'danger' : 'neutral'}>
              {CURRENCY_MODE_LABELS[modes.currencyHandling] ?? modes.currencyHandling}
            </Badge>
          </div>
          <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
            {CURRENCY_MODE_HELP[modes.currencyHandling] ?? ''}
          </p>

          <div style={styles.row}>
            <Field label="واحد مبلغ مقصد">
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

            {fields.baseCurrency ? (
              <Field label="ارز پایهٔ مقصد">
                <select
                  style={styles.input}
                  value={form.baseCurrency}
                  disabled={!canManage}
                  aria-invalid={attemptedSave && issues.baseCurrency !== undefined}
                  onChange={(event) =>
                    onChange({ ...form, baseCurrency: event.target.value })
                  }
                >
                  {CRM_CURRENCY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                <FieldError message={attemptedSave ? issues.baseCurrency : undefined} />
              </Field>
            ) : null}

            {fields.conversionRate ? (
              <Field label="نرخ تبدیل (اعشار دقیق)">
                <input
                  style={{ ...styles.input, direction: 'ltr', textAlign: 'left' }}
                  value={form.conversionRate}
                  disabled={!canManage}
                  inputMode="decimal"
                  placeholder="1"
                  aria-invalid={attemptedSave && issues.conversionRate !== undefined}
                  onChange={(event) =>
                    onChange({ ...form, conversionRate: event.target.value })
                  }
                />
                <FieldError message={attemptedSave ? issues.conversionRate : undefined} />
              </Field>
            ) : null}
          </div>

          {form.moneyUnit === 'UNCONFIRMED' ? (
            <InlineAlert title="واحد پول تأیید نشده است">
              تا وقتی ریال یا تومان را انتخاب نکنید، مبلغی به حسابداری فرستاده نمی‌شود.
            </InlineAlert>
          ) : null}

          {fields.baseCurrency ? (
            <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
              در این حالت کد ارز از شما خواسته نمی‌شود؛ ارز پایه و واحد مبلغ بالا برای
              جلوگیری از اشتباه ریال/تومان کافی است.
            </p>
          ) : fields.currencyUnsupported ? (
            <InlineAlert tone="danger" title="ارسال سند در این وضعیت ممنوع است">
              تا قرارداد ارزی این مقصد مشخص نشود، هیچ سندی ارسال نمی‌شود.
            </InlineAlert>
          ) : (
            <CurrencyMappingTable
              label={
                fields.currencyNameTable
                  ? 'نام ارز در مقصد'
                  : 'کد ارز در مقصد'
              }
              text={form.currencyMappingsText}
              canManage={canManage}
              onChange={(next) => onChange({ ...form, currencyMappingsText: next })}
            />
          )}
        </Card>
      </div>

      <div ref={taxRef} data-form-section="tax" tabIndex={-1}>
        <Card>
          <div
            style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}
          >
            <p style={styles.subtitle}>۴. مالیات</p>
            <Badge tone={fields.taxUnsupported ? 'danger' : 'neutral'}>
              {TAX_MODE_LABELS[modes.taxHandling] ?? modes.taxHandling}
            </Badge>
          </div>
          <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
            {TAX_MODE_HELP[modes.taxHandling] ?? ''}
          </p>

          {fields.taxUnsupported ? (
            <InlineAlert tone="danger" title="مالیات در این مقصد پشتیبانی نمی‌شود">
              سند مشمول مالیات ارسال نمی‌شود؛ حذف بی‌صدای مالیات ممنوع است.
            </InlineAlert>
          ) : fields.taxCodeTable ? (
            <TaxMappingTable
              label={`کد مالیات این اتصال برای هر سیاست CRM`}
              policies={taxPolicies}
              text={form.taxPolicyMappingsText}
              canManage={canManage}
              onChange={(next) => onChange({ ...form, taxPolicyMappingsText: next })}
            />
          ) : (
            <PolicyRateTable policies={taxPolicies} />
          )}

          {fields.specialTaxRowCode ? (
            <label style={{ ...styles.label, display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={form.tax}
                disabled={!canManage}
                onChange={(event) => onChange({ ...form, tax: event.target.checked })}
              />
              {/* Three different things share the word «کد» here, so the label names the
                  one this box is about: the pre-existing tax row in the vendor, not the CRM
                  policy and not its rate. */}
              ردیف کد ویژهٔ مالیات در این نصب تعریف شده است (کد ردیف، نه کد سیاست)
            </label>
          ) : null}
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', gap: 'var(--t-spacing-2)', flexWrap: 'wrap' }}>
          <PrimaryButton
            label="ذخیرهٔ تنظیمات"
            onClick={() => {
              setAttemptedSave(true);

              if (Object.keys(issues).length > 0) {
                return;
              }

              onSave();
            }}
            disabled={busy || !canManage}
          />
          <SecondaryButton
            label={busy ? 'در حال اجرا…' : 'آزمایش اتصال'}
            onClick={onTest}
            disabled={busy || (form.id === null && selectedConnectionId === null)}
          />
        </div>

        {testResult === null ? null : (
          <InlineAlert
            tone={testResult.healthState === 'OK' ? 'success' : 'warning'}
            title={
              testResult.healthState === 'OK'
                ? form.adapterId === 'mock'
                  ? 'آزمایش شبیه‌سازی‌شده موفق بود'
                  : 'پاسخ سرور دریافت شد (اتصال واقعی تأیید نشده)'
                : 'آزمایش اتصال موفق نبود'
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
            tone={
              connectionHealthState(savedConnection) === 'FAILED' ? 'warning' : 'info'
            }
            title={`وضعیت ذخیره‌شده: ${
              CONNECTION_HEALTH_LABELS[connectionHealthState(savedConnection)]
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

      <Details summary="جزئیات فنی: شناسهٔ کاربر، انبار، انتقال امن و نگاشت‌های تکمیلی">
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
        </div>

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

        <span>{`نرم‌افزار سپیدار: ${SEPIDAR_UNAVAILABLE.summary}`}</span>
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

const healthTone = (
  health: string,
): 'success' | 'warning' | 'danger' | 'neutral' | 'info' => {
  switch (health) {
    case 'LIVE_VERIFIED':
      return 'success';
    case 'FAILED':
      return 'danger';
    case 'INCOMPLETE':
      return 'warning';
    case 'MOCK':
      return 'info';
    default:
      return 'neutral';
  }
};

// Only what a save must refuse. A missing mapping is a send-time refusal with its own
// explanation, not a reason to hide the record an operator is still filling in.
const CurrencyMappingTable = ({
  label,
  text,
  canManage,
  onChange,
}: {
  label: string;
  text: string;
  canManage: boolean;
  onChange: (text: string) => void;
}) => {
  const mappings = parseKeyValueLines(text);

  return (
    <table
      aria-label="نگاشت ارز CRM به ارز مقصد"
      style={{ ...styles.table, minWidth: '420px' }}
    >
      <thead>
        <tr>
          <th style={styles.cell}>ارز CRM</th>
          <th style={styles.cell}>{label}</th>
        </tr>
      </thead>
      <tbody>
        {CRM_CURRENCY_CODES.map((code) => (
          <tr key={code}>
            <td style={{ ...styles.cell, direction: 'ltr', textAlign: 'right' }}>{code}</td>
            <td style={styles.cell}>
              <input
                aria-label={`${label} برای ${code}`}
                style={{ ...styles.input, width: '100%' }}
                value={mappings[code] ?? ''}
                disabled={!canManage}
                onChange={(event) =>
                  onChange(setMappingRow(text, code, event.target.value))
                }
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const TaxMappingTable = ({
  label,
  policies,
  text,
  canManage,
  onChange,
}: {
  label: string;
  policies: TaxPolicyView[];
  text: string;
  canManage: boolean;
  onChange: (text: string) => void;
}) => {
  const mappings = parseTaxPolicyMappingsText(text);

  if (policies.length === 0) {
    return (
      <>
        <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
          سیاست مالیات فعالی خوانده نشد. کدها را دستی وارد کنید؛ هر خط «کد سیاست CRM = کد
          مقصد».
        </p>
        <textarea
          aria-label={label}
          style={styles.input}
          rows={3}
          value={text}
          disabled={!canManage}
          placeholder={'IR_VAT_9=999141'}
          onChange={(event) => onChange(event.target.value)}
        />
      </>
    );
  }

  return (
    <table
      aria-label="نگاشت سیاست مالیات CRM به کد مالیات این اتصال"
      style={{ ...styles.table, minWidth: '420px' }}
    >
      <thead>
        <tr>
          <th style={styles.cell}>سیاست مالیات CRM</th>
          <th style={styles.cell}>نرخ</th>
          <th style={styles.cell}>کد مالیات این اتصال</th>
        </tr>
      </thead>
      <tbody>
        {policies.map((policy) => (
          <tr key={policy.code}>
            <td style={styles.cell}>
              <span style={{ display: 'block' }}>{policy.name}</span>
              <span
                style={{
                  ...styles.meta,
                  display: 'block',
                  fontSize: 'var(--t-font-size-xs)',
                  direction: 'ltr',
                  textAlign: 'right',
                }}
              >
                {policy.code}
              </span>
            </td>
            <td style={styles.cell}>
              {policy.isExempt ? 'معاف' : `${policy.ratePercent}٪`}
            </td>
            <td style={styles.cell}>
              <input
                aria-label={`کد مالیات برای ${policy.name}`}
                style={{ ...styles.input, width: '100%' }}
                value={mappings[policy.code] ?? ''}
                disabled={!canManage}
                onChange={(event) =>
                  onChange(setMappingRow(text, policy.code, event.target.value))
                }
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const PolicyRateTable = ({ policies }: { policies: TaxPolicyView[] }) => {
  if (policies.length === 0) {
    return (
      <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
        سیاست مالیات فعالی خوانده نشد؛ پس از تعریف سیاست در CRM، نرخ آن در همین‌جا نمایش داده
        می‌شود.
      </p>
    );
  }

  return (
    <table aria-label="نرخ سیاست‌های مالیات CRM" style={{ ...styles.table, minWidth: '360px' }}>
      <thead>
        <tr>
          <th style={styles.cell}>سیاست مالیات CRM</th>
          <th style={styles.cell}>نرخی که به مقصد می‌رسد</th>
        </tr>
      </thead>
      <tbody>
        {policies.map((policy) => (
          <tr key={policy.code}>
            <td style={styles.cell}>{policy.name}</td>
            <td style={styles.cell}>
              {policy.isExempt ? 'معاف از مالیات' : `${policy.ratePercent}٪`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const FieldError = ({ message }: { message: string | undefined }) =>
  message === undefined ? null : (
    <span role="alert" style={styles.error}>
      {message}
    </span>
  );

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
