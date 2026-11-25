import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  Badge,
  Card,
  Details,
  InlineAlert,
  PrimaryButton,
  SecondaryButton,
  StateBlock,
  SubViewBar,
} from 'src/components/accounting/accounting-business-ui';
import {
  type AdapterDescriptor,
  CapabilityTable,
  CONNECTION_HEALTH_LABELS,
  CRM_CURRENCY_CODES,
  type FinancialModes,
  type FormState,
  type PanelData,
  SEPIDAR_UNAVAILABLE,
  type TaxCodeContractView,
  type TaxPolicyView,
  connectionHealthState,
  formatHealthCheckAt,
  parseKeyValueLines,
  parseTaxPolicyMappingsText,
  setMappingRow,
  sharedStyles as styles,
  toForm,
} from 'src/components/accounting/accounting-shared';
import {
  connectionFormFields,
  validateConnectionForm,
} from 'src/components/accounting/accounting-connection-rules';
import { matchTaxPolicyToDestinationCode } from 'src/domain/accounting/tax-code-contract';
import { ASAN_SPECIAL_ITEM_CODES } from 'src/domain/accounting/adapters/asan/asan-capabilities';

// ONE business form for every accounting destination.
//
// The four sections are the same for the mock and for Asan: connection details, currency,
// tax and duty, advanced settings. Only the connection details differ per adapter, and the
// adapter contract decides which of those fields exist. Technical choices (how the payload
// is shaped) stay inside the adapter instead of becoming questions for a merchant.
const MOCK_PROFILE_SHORT_LABELS: Record<string, string> = {
  SIMPLE: 'ساده — نرخ مالیات و عوارض',
  CODED: 'کد مالیات برای هر سیاست',
  AMOUNT: 'مبلغ مالیات و عوارض',
  AGGREGATE: 'فقط جمع مالیات و عوارض',
  TAX_ONLY: 'فقط مالیات',
  NO_TAX: 'بدون مالیات و عوارض',
};

export const ConnectionEditForm = ({
  data,
  form,
  modes,
  policies,
  canManage,
  busy,
  testResult,
  focus,
  onBack,
  onChange,
  onSave,
  onTest,
}: {
  data: PanelData;
  form: FormState;
  modes: FinancialModes;
  policies: TaxPolicyView[];
  canManage: boolean;
  busy: boolean;
  testResult: { healthState: string; message: string; detail: string } | null;
  focus: 'money' | 'tax' | null;
  onBack: () => void;
  onChange: (form: FormState) => void;
  onSave: () => void;
  onTest: () => void;
}) => {
  const [attemptedSave, setAttemptedSave] = useState(false);
  const moneyRef = useRef<HTMLDivElement | null>(null);
  const taxRef = useRef<HTMLDivElement | null>(null);

  const descriptor: AdapterDescriptor | null =
    data.adapters.find((entry) => entry.id === form.adapterId) ?? null;
  const adapterIsLive = descriptor?.isLive === true;
  const isMock = form.adapterId === 'mock';
  const fields = connectionFormFields(modes);
  const activePolicies = policies.filter((policy) => policy.isActive);
  const savedConnection =
    data.connections.find((entry) => entry.id === form.id) ?? null;
  const savedHealth =
    savedConnection === null ? null : connectionHealthState(savedConnection);
  const lastHealthCheckLabel =
    savedConnection === null
      ? null
      : formatHealthCheckAt(savedConnection.lastHealthCheckAt);

  // A draft that differs from the stored record cannot be the thing a probe checks: the
  // server dials the SAVED address with the SAVED settings. Saying so up front is what stops
  // a green result being read as approval of unsaved edits.
  const draftDiffersFromSaved =
    savedConnection !== null &&
    JSON.stringify(toForm(savedConnection)) !== JSON.stringify(form);
  const canTestSavedRecord = form.id !== null;

  const issues = validateConnectionForm({
    form,
    adapterIsLive,
    modes,
  });

  useEffect(() => {
    if (focus === null) {
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
  }, [focus, form.id]);

  const mockProfiles = descriptor?.testProfiles ?? [];
  const selectedProfile = mockProfiles.find(
    (profile) => profile.id === form.mockProfile,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
      <SubViewBar
        backLabel="بازگشت به فهرست اتصال‌ها"
        label={
          form.id === null
            ? 'اتصال تازه؛ پس از ذخیره، آزمایش کنید.'
            : `در حال ویرایش: ${form.name}`
        }
        onBack={onBack}
      />

      {!canManage ? (
        <InlineAlert tone="warning">
          شما مجوز تغییر تنظیمات حسابداری را ندارید. مقادیر فعلی فقط برای مشاهده نمایش داده
          می‌شوند.
        </InlineAlert>
      ) : null}

      <InlineAlert tone="info">
        کد حسابداری مالیات و ارز در صفحهٔ «مالیات و عوارض» تعریف می‌شود. این فرم فقط نگاشت
        مقصد فروشنده را نگه می‌دارد و هویت CRM را دوباره تعریف نمی‌کند.
      </InlineAlert>

      <Card>
        <SectionHeading
          index="۱"
          title="مشخصات اتصال"
          aside={
            isMock ? (
              <Badge tone="info">آزمایشی، بدون ارتباط واقعی</Badge>
            ) : (
              <Badge tone="neutral">آسان</Badge>
            )
          }
        />

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

          <Field label="نرم‌افزار حسابداری">
            <select
              style={styles.input}
              value={form.adapterId}
              disabled={!canManage}
              onChange={(event) =>
                // Switching the destination keeps everything already typed: it changes the
                // contract, never the draft.
                onChange({ ...form, adapterId: event.target.value })
              }
            >
              {data.adapters.map((adapter) => (
                <option key={adapter.id} value={adapter.id}>
                  {adapter.id === 'mock'
                    ? 'آزمایشی، بدون ارتباط واقعی'
                    : 'نرم‌افزار حسابداری آسان'}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {isMock ? (
          <Field label="حالت آزمایشی">
            <select
              style={styles.input}
              value={form.mockProfile}
              disabled={!canManage}
              onChange={(event) =>
                onChange({ ...form, mockProfile: event.target.value })
              }
            >
              {mockProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {MOCK_PROFILE_SHORT_LABELS[profile.id] ?? profile.label}
                </option>
              ))}
            </select>
            {selectedProfile === undefined ? null : (
              <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
                {selectedProfile.summary}
              </span>
            )}
          </Field>
        ) : null}

        {adapterIsLive ? (
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
          <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-sm)' }}>
            این اتصال به سرور بیرونی وصل نمی‌شود؛ آدرس و ورود لازم نیست.
          </p>
        )}

        {isMock ? (
          <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-sm)' }}>
            هیچ تماس واقعی با نرم‌افزار حسابداری انجام نمی‌شود و نتیجهٔ آزمایش، شبیه‌سازی
            است.
          </p>
        ) : (
          <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-sm)' }}>
            طبق مستند سرویس آسان، نام کاربری و توکن API لازم نیست؛ آدرس سرویس کافی است.
          </p>
        )}

        {adapterIsLive &&
        !data.credentials.tunnelTokenConfigured &&
        form.baseUrl.trim().toLowerCase().startsWith('http://') ? (
          <InlineAlert title="ارتباط امن تنظیم نشده است">
            آدرس با http شروع می‌شود و توکن تونل امن تنظیم نشده است؛ خواندن انجام می‌شود،
            اما نوشتن نیازمند تأیید صریح در «تنظیمات پیشرفته» است.
          </InlineAlert>
        ) : null}

        <div
          style={{
            ...styles.row,
            gap: 'var(--t-spacing-2)',
            justifyContent: 'space-between',
          }}
        >
          <span style={styles.meta}>وضعیت فعلی</span>
          <Badge
            tone={
              savedHealth === null
                ? 'neutral'
                : savedHealth === 'LIVE_VERIFIED'
                  ? 'success'
                  : savedHealth === 'FAILED'
                    ? 'danger'
                    : savedHealth === 'INCOMPLETE'
                      ? 'warning'
                      : savedHealth === 'MOCK'
                        ? 'info'
                        : 'neutral'
            }
          >
            {savedHealth === null
              ? 'ذخیره‌نشده'
              : CONNECTION_HEALTH_LABELS[savedHealth]}
          </Badge>
          <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
            {savedConnection === null
              ? 'پس از ذخیره و آزمایش، وضعیت واقعی اینجا نمایش داده می‌شود.'
              : lastHealthCheckLabel === null
                ? 'این اتصال هنوز آزمایش نشده است.'
                : `آخرین آزمایش: ${lastHealthCheckLabel}`}
          </span>
        </div>
      </Card>

      <div ref={moneyRef} data-form-section="money" tabIndex={-1}>
        <Card>
          <SectionHeading index="۲" title="ارز و واحد پول" />

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
                <option value="UNCONFIRMED">انتخاب کنید</option>
                <option value="RIAL">ریال</option>
                <option value="TOMAN">تومان</option>
              </select>
            </Field>

            {fields.baseCurrency ? (
              <Field label="ارز مقصد">
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
              <Field label="نرخ تبدیل">
                <input
                  style={{ ...styles.input, direction: 'ltr', textAlign: 'left' }}
                  value={form.conversionRate}
                  disabled={!canManage}
                  inputMode="decimal"
                  placeholder="1"
                  aria-invalid={
                    attemptedSave && issues.conversionRate !== undefined
                  }
                  onChange={(event) =>
                    onChange({ ...form, conversionRate: event.target.value })
                  }
                />
                <FieldError
                  message={attemptedSave ? issues.conversionRate : undefined}
                />
              </Field>
            ) : null}
          </div>

          {form.moneyUnit === 'UNCONFIRMED' ? (
            <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-sm)' }}>
              تا واحد مبلغ (ریال یا تومان) را انتخاب نکنید، مبلغی به حسابداری فرستاده
              نمی‌شود.
            </p>
          ) : null}

          {fields.baseCurrency ? (
            <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-sm)' }}>
              همهٔ مبالغ این مقصد به یک ارز ثبت می‌شود؛ کد ارز لازم نیست.
            </p>
          ) : fields.currencyUnsupported ? (
            <InlineAlert tone="danger" title="ارسال سند در این وضعیت ممنوع است">
              قرارداد ارزی این مقصد مشخص نیست؛ تا روشن‌شدن آن، سندی ارسال نمی‌شود.
            </InlineAlert>
          ) : (
            <CurrencyMappingTable
              label={
                fields.currencyNameTable ? 'نام ارز در مقصد' : 'کد ارز در مقصد'
              }
              helper="اگر نرم‌افزار حسابداری برای ارز کد یا نام می‌خواهد، همان را وارد کنید. خالی‌ماندن یک ارز، ارسال سند آن ارز را متوقف می‌کند، نه ذخیره را."
              text={form.currencyMappingsText}
              canManage={canManage}
              onChange={(next) => onChange({ ...form, currencyMappingsText: next })}
            />
          )}
        </Card>
      </div>

      <div ref={taxRef} data-form-section="tax" tabIndex={-1}>
        <Card>
          <SectionHeading index="۳" title="مالیات و عوارض" />

          {fields.taxUnsupported ? (
            <InlineAlert tone="danger" title="مالیات و عوارض در این مقصد پشتیبانی نمی‌شود">
              سند مشمول مالیات ارسال نمی‌شود؛ حذف بی‌صدای مالیات ممنوع است.
            </InlineAlert>
          ) : (
            <PolicyTaxTable
              policies={activePolicies}
              showCode={fields.taxCodeTable}
              text={form.taxPolicyMappingsText}
              catalog={modes.taxCodeCatalog}
              canManage={canManage}
              onChange={(next) => onChange({ ...form, taxPolicyMappingsText: next })}
            />
          )}

          {!fields.taxUnsupported &&
          fields.dutyUnsupported &&
          activePolicies.some(
            (policy) => !policy.isExempt && policy.dutyRateBasisPoints !== '0',
          ) ? (
            <InlineAlert tone="danger" title="عوارض در این مقصد پشتیبانی نمی‌شود">
              سند دارای عوارض ارسال نمی‌شود؛ عوارض بی‌صدا حذف نمی‌شود.
            </InlineAlert>
          ) : null}

          {fields.dutyAggregate ? (
            <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-sm)' }}>
              این مقصد فقط جمع مالیات و عوارض را در یک فیلد می‌گیرد؛ تفکیک دو مؤلفه در سند
              CRM حفظ می‌شود.
            </p>
          ) : null}
        </Card>
      </div>

      <Details summary="۴. تنظیمات پیشرفته (شناسه‌های مقصد، کدهای ردیف، شبکه و امنیت)">
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
        <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
          این دو شناسه مربوط به نصب نرم‌افزار حسابداری است و با نام کاربری یا توکن اتصال
          یکی نیست.
        </span>

        {fields.specialRowCodes ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={styles.label}>کدهای ویژهٔ ردیف سند در این نصب</span>
            <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
              کد ردیف مشخص می‌کند مبلغ غیرکالایی (تخفیف، عوارض، مالیات) زیر کدام ردیف موجود
              در نصب ثبت شود؛ با کد سیاست مالیاتی و با نرخ یکی نیست.
            </span>
            <div style={styles.row}>
              <SpecialRowCodeField
                label="تخفیف"
                enabled={form.discount}
                code={form.specialDiscountCode}
                placeholder={ASAN_SPECIAL_ITEM_CODES.discount}
                canManage={canManage}
                onToggle={(checked) => onChange({ ...form, discount: checked })}
                onChange={(value) =>
                  onChange({ ...form, specialDiscountCode: value })
                }
              />
              <SpecialRowCodeField
                label="عوارض"
                enabled={form.duty}
                code={form.specialDutyCode}
                placeholder={ASAN_SPECIAL_ITEM_CODES.duty}
                canManage={canManage}
                onToggle={(checked) => onChange({ ...form, duty: checked })}
                onChange={(value) => onChange({ ...form, specialDutyCode: value })}
              />
              <SpecialRowCodeField
                label="مالیات"
                enabled={form.tax}
                code={form.specialTaxCode}
                placeholder={ASAN_SPECIAL_ITEM_CODES.tax}
                canManage={canManage}
                onToggle={(checked) => onChange({ ...form, tax: checked })}
                onChange={(value) => onChange({ ...form, specialTaxCode: value })}
              />
            </div>
          </div>
        ) : null}

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
        </div>

        <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
          {`توکن تونل امن: ${
            data.credentials.tunnelTokenConfigured ? 'تنظیم‌شده' : 'تنظیم‌نشده'
          } — تأیید انتقال ناامن: ${
            data.credentials.insecureWritesApproved ? 'دارد' : 'ندارد'
          }`}
        </span>
        <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
          رمزها و توکن‌ها فقط در متغیرهای محرمانهٔ برنامه نگهداری می‌شوند و در این صفحه،
          رکورد یا پاسخ API نمایش داده نمی‌شوند.
        </span>

        {descriptor === null ? null : (
          <>
            <span style={{ fontWeight: 'var(--t-font-weight-semi-bold)' }}>
              قرارداد این نرم‌افزار
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
      </Details>

      <Card>
        <SectionHeading index="" title="ذخیره و آزمایش اتصال" />
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
            label={busy ? 'در حال اجرا…' : 'آزمایش اتصال ذخیره‌شده'}
            onClick={onTest}
            disabled={busy || !canTestSavedRecord || !canManage}
          />
        </div>

        {!canTestSavedRecord ? (
          <p style={styles.meta}>
            این اتصال هنوز ذخیره نشده است؛ ابتدا ذخیره کنید، سپس آزمایش بزنید.
          </p>
        ) : draftDiffersFromSaved ? (
          <InlineAlert tone="warning" title="تغییرات ذخیره‌نشده آزمایش نمی‌شوند">
            آزمایش دقیقاً همان اتصال ذخیره‌شده را هدف می‌گیرد؛ تغییرات ذخیره‌نشده در نتیجهٔ
            آزمایش لحاظ نمی‌شوند.
          </InlineAlert>
        ) : null}

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

        {savedConnection === null ? null : (
          <p style={styles.meta}>
            {savedConnection.lastHealthMessage === null
              ? 'این اتصال هنوز آزمایش نشده است.'
              : `آخرین نتیجهٔ ذخیره‌شده: ${savedConnection.lastHealthMessage}`}
          </p>
        )}
      </Card>

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

const SectionHeading = ({
  index,
  title,
  aside,
}: {
  index: string;
  title: string;
  aside?: ReactNode;
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '6px',
      flexWrap: 'wrap',
    }}
  >
    <p style={styles.subtitle}>{index === '' ? title : `${index}. ${title}`}</p>
    {aside}
  </div>
);

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

// A code table is shown only where the destination's contract reads a code. Leaving a
// code empty never blocks the save: it is the document send that is refused, because a
// policy with no code cannot be proven against the destination's own definition.
const CurrencyMappingTable = ({
  label,
  helper,
  text,
  canManage,
  onChange,
}: {
  label: string;
  helper: string;
  text: string;
  canManage: boolean;
  onChange: (text: string) => void;
}) => {
  const mappings = parseKeyValueLines(text);

  return (
    <>
      <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>{helper}</p>
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
              <td style={{ ...styles.cell, direction: 'ltr', textAlign: 'right' }}>
                {code}
              </td>
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
    </>
  );
};

const PolicyTaxTable = ({
  policies,
  showCode,
  text,
  catalog,
  canManage,
  onChange,
}: {
  policies: TaxPolicyView[];
  showCode: boolean;
  text: string;
  catalog: TaxCodeContractView[] | undefined;
  canManage: boolean;
  onChange: (text: string) => void;
}) => {
  const mappings = parseTaxPolicyMappingsText(text);

  if (policies.length === 0) {
    return (
      <>
        <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
          سیاست مالیات فعالی خوانده نشد؛ ابتدا در صفحهٔ «مالیات و عوارض» یک سیاست تعریف
          کنید.
        </p>
        {showCode ? (
          <textarea
            aria-label="نگاشت سیاست مالیات CRM به یک کد مالیات در این اتصال"
            style={styles.input}
            rows={3}
            value={text}
            disabled={!canManage}
            placeholder={'IR_VAT_9=64'}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
        {showCode
          ? 'این مقصد برای هر سیاست یک کد واحد می‌خواهد؛ همان کد کل ارزش افزوده (مالیات + عوارض) را نمایندگی می‌کند. تا کد یک سیاست وارد نشود، سند آن سیاست ارسال نمی‌شود.'
          : 'نرخ مالیات و عوارض از همین سیاست و از نسخهٔ قطعی‌شدهٔ سند خوانده می‌شود؛ کدی لازم نیست.'}
      </p>
      <table
        aria-label="سیاست‌های مالیات و عوارض این اتصال"
        style={{ ...styles.table, minWidth: showCode ? '520px' : '360px' }}
      >
        <thead>
          <tr>
            <th style={styles.cell}>سیاست مالیاتی</th>
            <th style={styles.cell}>جمع درصد</th>
            {showCode ? <th style={styles.cell}>کد در حسابداری</th> : null}
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => {
            const destinationCode = mappings[policy.code] ?? '';
            const match = matchTaxPolicyToDestinationCode({
              policy: {
                taxRateBasisPoints: policy.rateBasisPoints,
                dutyRateBasisPoints: policy.dutyRateBasisPoints,
                totalRateBasisPoints: policy.totalRateBasisPoints,
              },
              destinationCode,
              catalog,
            });

            return (
              <tr key={policy.code}>
                <td style={styles.cell}>
                  <span style={{ display: 'block' }}>{policy.name}</span>
                  <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
                    {policy.isExempt
                      ? 'معاف'
                      : `مالیات ${policy.ratePercent}٪ + عوارض ${policy.dutyRatePercent || '0'}٪`}
                  </span>
                </td>
                <td style={styles.cell}>
                  {policy.isExempt ? 'معاف' : `${policy.totalRatePercent}٪`}
                </td>
                {showCode ? (
                  <td style={styles.cell}>
                    <input
                      aria-label={`کد مالیات برای ${policy.name}`}
                      style={{ ...styles.input, width: '100%' }}
                      value={destinationCode}
                      disabled={!canManage}
                      inputMode="numeric"
                      onChange={(event) =>
                        onChange(setMappingRow(text, policy.code, event.target.value))
                      }
                    />
                    {destinationCode.trim() === '' ? (
                      <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
                        بدون کد، سند این سیاست ارسال نمی‌شود.
                      </span>
                    ) : match.kind === 'MISMATCH' ? (
                      <span role="alert" style={styles.error}>
                        {match.reason === 'COMPOSITION'
                          ? 'جمع نرخ‌ها برابر است اما ترکیب مالیات و عوارض با تعریف مقصد یکی نیست؛ تا اصلاح این نگاشت، ارسال سند متوقف می‌ماند.'
                          : 'نرخ کل سیاست با نرخ اعلام‌شدهٔ این کد در مقصد یکسان نیست؛ تا اصلاح این نگاشت، ارسال سند متوقف می‌ماند.'}
                      </span>
                    ) : match.kind === 'UNVERIFIABLE' ? (
                      <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
                        تطابق این کد با نرخ سیاست تأیید نشده است (کاتالوگ معتبر مقصد در
                        دسترس نیست).
                      </span>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
};

// The installation's own special-row item codes. A row code is what makes an amount a
// discount/duty/tax row; it is not a policy id and not a rate, which is why it lives in
// advanced settings and not inside the policy table.
const SpecialRowCodeField = ({
  label,
  enabled,
  code,
  placeholder,
  canManage,
  onToggle,
  onChange,
}: {
  label: string;
  enabled: boolean;
  code: string;
  placeholder: string;
  canManage: boolean;
  onToggle: (checked: boolean) => void;
  onChange: (value: string) => void;
}) => (
  <div style={{ ...styles.field, gap: '4px' }}>
    <label style={{ ...styles.label, display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        type="checkbox"
        checked={enabled}
        disabled={!canManage}
        onChange={(event) => onToggle(event.target.checked)}
      />
      {label}
    </label>
    <input
      aria-label={`کد ردیف ${label}`}
      style={{ ...styles.input, direction: 'ltr', textAlign: 'left' }}
      value={code}
      placeholder={placeholder}
      disabled={!canManage}
      inputMode="numeric"
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);
