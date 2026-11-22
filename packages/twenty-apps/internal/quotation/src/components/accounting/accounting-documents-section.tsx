import { useMemo, useState } from 'react';

import {
  Badge,
  Card,
  SectionHeader,
  StatCard,
  StatGrid,
} from 'src/components/accounting/accounting-business-ui';
import {
  type ConnectionRecord,
  type OperationRow,
  OPERATION_STATE_LABELS,
  OperationTable,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';

// Documents and records: what would be sent, and what has already happened.
//
// The "unfinished work" list is the recovery surface. A failed or stuck operation is not an
// error banner that disappears on reload — it stays here, with the state that says whether
// retrying is safe, until someone acts on it.
const UNFINISHED_STATES = new Set([
  'PENDING',
  'IN_FLIGHT',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
  'MANUAL_EXPORT_REQUIRED',
]);

export const AccountingDocumentsSection = ({
  connection,
  operations,
  busy,
  canManage,
  outboundEnabled,
  documentExportEnabled,
  taxMappingCount,
  onReload,
}: {
  connection: ConnectionRecord | null;
  operations: OperationRow[];
  busy: boolean;
  canManage: boolean;
  outboundEnabled: boolean;
  documentExportEnabled: boolean;
  taxMappingCount: number;
  onReload: () => void;
}) => {
  const [onlyUnfinished, setOnlyUnfinished] = useState(false);

  const unfinished = useMemo(
    () => operations.filter((row) => UNFINISHED_STATES.has(row.state)),
    [operations],
  );

  const visible = onlyUnfinished ? unfinished : operations;
  const outboundDisabled = !outboundEnabled && !documentExportEnabled;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
      <SectionHeader
        title="اسناد و سوابق"
        description="آمادگی ارسال سند مالی و تاریخچهٔ عملیات به نرم‌افزار حسابداری."
        actions={
          <button
            type="button"
            style={{ ...styles.button, ...(busy ? styles.buttonDisabled : {}) }}
            disabled={busy || connection === null}
            onClick={onReload}
          >
            به‌روزرسانی سوابق
          </button>
        }
      />

      <StatGrid>
        <StatCard
          label="ارسال به حسابداری"
          value={outboundDisabled ? 'غیرفعال است' : 'فعال'}
          tone={outboundDisabled ? 'success' : 'danger'}
          hint="کلید عملیاتی این نسخه"
        />
        <StatCard
          label="ثبت سند مالی"
          value={documentExportEnabled ? 'فعال' : 'غیرفعال است'}
          tone={documentExportEnabled ? 'danger' : 'success'}
        />
        <StatCard
          label="اتصال کدهای مالیات"
          value={taxMappingCount.toLocaleString('fa-IR')}
          hint={taxMappingCount === 0 ? 'سند دارای مالیات ارسال نمی‌شود' : undefined}
          tone={taxMappingCount === 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="عملیات ناتمام"
          value={unfinished.length.toLocaleString('fa-IR')}
          hint={unfinished.length === 0 ? 'همه‌چیز پایان یافته' : 'نیازمند بررسی'}
          tone={unfinished.length === 0 ? 'success' : 'warning'}
        />
      </StatGrid>

      {outboundDisabled ? (
        <p style={styles.notice}>
          ارسال به نرم‌افزار حسابداری غیرفعال است. این صفحه فقط می‌خواند و هیچ سند،
          فاکتور یا مشتری‌ای به مقصد نمی‌نویسد.
        </p>
      ) : (
        <p style={styles.warning}>
          یکی از کلیدهای ارسال فعال است. با این حال، این صفحه خودش هیچ سندی ارسال
          نمی‌کند؛ ارسال از مسیر پیش‌فاکتور انجام می‌شود.
        </p>
      )}

      <Card>
        <p style={styles.subtitle}>آمادگی ارسال سند</p>
        <ul
          style={{
            margin: 0,
            paddingInlineStart: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: 'var(--t-font-size-sm)',
          }}
        >
          <Check ok={connection !== null} label="اتصال حسابداری ثبت شده است" />
          <Check
            ok={connection?.healthState === 'OK'}
            label="آخرین آزمایش اتصال موفق بوده است"
          />
          <Check
            ok={connection?.settings.moneyUnit !== 'UNCONFIRMED'}
            label="واحد پول (ریال یا تومان) تأیید شده است"
          />
          <Check ok={taxMappingCount > 0} label="کدهای مالیات به مقصد متصل شده‌اند" />
          <Check ok={!outboundDisabled} label="ارسال به حسابداری فعال است" />
        </ul>
      </Card>

      <div style={styles.section}>
        <div
          style={{
            display: 'flex',
            gap: 'var(--t-spacing-2)',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          <p style={styles.subtitle}>تاریخچهٔ عملیات</p>
          <label
            style={{
              ...styles.label,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <input
              type="checkbox"
              checked={onlyUnfinished}
              onChange={(event) => setOnlyUnfinished(event.target.checked)}
            />
            فقط عملیات ناتمام
          </label>
        </div>

        {canManage ? null : (
          <p style={styles.meta}>
            نمایش سوابق برای همهٔ کاربران ممکن است؛ ارسال و اصلاح فقط با نقش
            مدیر انجام می‌شود.
          </p>
        )}

        {visible.length === 0 ? (
          <p style={styles.meta}>
            {operations.length === 0
              ? 'هنوز عملیاتی در این اتصال ثبت نشده است.'
              : 'عملیات ناتمامی وجود ندارد.'}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <OperationTable operations={visible} />
          </div>
        )}

        {unfinished.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              borderTop: '1px solid var(--t-border-color-light)',
              paddingTop: 'var(--t-spacing-2)',
            }}
          >
            <p style={styles.subtitle}>بازیابی عملیات ناتمام</p>
            <p style={styles.meta}>
              «قابل تکرار» را می‌توان دوباره فرستاد؛ «قطعی» و «نیازمند اقدام دستی»
              را باید ابتدا در نرم‌افزار حسابداری بررسی کرد. تا زمانی که این ردیف‌ها
              باقی‌اند، وضعیت آن سند نامعلوم فرض می‌شود.
            </p>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[...new Set(unfinished.map((row) => row.state))].map((state) => (
                <Badge key={state} tone="warning">
                  {`${OPERATION_STATE_LABELS[state] ?? state}: ${
                    unfinished.filter((row) => row.state === state).length
                  }`}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const Check = ({ ok, label }: { ok: boolean; label: string }) => (
  <li style={{ color: ok ? 'var(--t-color-green)' : 'var(--t-font-color-secondary)' }}>
    {`${ok ? '✓' : '○'} ${label}`}
  </li>
);
