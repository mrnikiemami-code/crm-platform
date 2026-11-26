import { useMemo, useState } from 'react';

import {
  Badge,
  Card,
  Details,
  EmptyState,
  InlineAlert,
  PrimaryButton,
  SecondaryButton,
  StatCard,
  StatGrid,
  StateBlock,
} from 'src/components/accounting/accounting-business-ui';
import {
  type ConnectionRecord,
  type OperationRow,
  OPERATION_STATE_LABELS,
  OperationTable,
  TAX_MODE_NEEDS_CODE,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';

// Documents and records: what would be sent, and what has already happened.
//
// The "unfinished work" list is the recovery surface. A failed or stuck operation is not an
// error banner that disappears on reload — it stays here, with the state that says whether
// retrying is safe, until someone acts on it.
//
// Readiness is expressed as a list of things that are true or not, each with the section
// that fixes it. A merchant does not need to know what "outbound flag" means to understand
// «ارسال به حسابداری خاموش است» followed by a button that goes there.
const UNFINISHED_STATES = new Set([
  'PENDING',
  'IN_FLIGHT',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
  'MANUAL_EXPORT_REQUIRED',
]);

type ReadinessItem = {
  ok: boolean;
  label: string;
  fix?: { label: string; onClick: () => void };
};

export const AccountingDocumentsSection = ({
  connection,
  operations,
  busy,
  canManage,
  outboundEnabled,
  documentExportEnabled,
  metadataVerified,
  taxMappingCount,
  taxHandling,
  onReload,
  onGoToConnections,
  onGoToCatalog,
  onFixMoney,
  onFixTax,
  onTestConnection,
}: {
  connection: ConnectionRecord | null;
  operations: OperationRow[];
  busy: boolean;
  canManage: boolean;
  outboundEnabled: boolean;
  documentExportEnabled: boolean;
  metadataVerified?: boolean;
  taxMappingCount: number;
  taxHandling: string;
  onReload: () => void;
  onGoToConnections?: () => void;
  onGoToCatalog?: () => void;
  onFixMoney?: () => void;
  onFixTax?: () => void;
  onTestConnection?: () => void;
}) => {
  const [onlyUnfinished, setOnlyUnfinished] = useState(false);

  const unfinished = useMemo(
    () => operations.filter((row) => UNFINISHED_STATES.has(row.state)),
    [operations],
  );

  const visible = onlyUnfinished ? unfinished : operations;
  const outboundDisabled = !outboundEnabled && !documentExportEnabled;

  // The tax item is about the CONTRACT, not about a code: a rate/amount destination has no
  // code to map, so marking it "missing" would send someone to a field that must not exist.
  const taxNeedsCode = TAX_MODE_NEEDS_CODE(taxHandling);
  const taxReady = taxHandling === 'UNSUPPORTED' ? false : !taxNeedsCode || taxMappingCount > 0;
  const taxLabel =
    taxHandling === 'UNSUPPORTED'
      ? 'این مقصد امکان ثبت مالیات را ندارد'
      : taxNeedsCode
        ? 'کدهای مالیات این اتصال به مقصد متصل شده‌اند'
        : 'مالیات از سیاست مالیات CRM خوانده می‌شود (بدون کد مقصد)';

  const readiness: ReadinessItem[] = [
    {
      ok: connection !== null,
      label: 'اتصال حسابداری ثبت شده است',
      ...(onGoToConnections === undefined
        ? {}
        : { fix: { label: 'رفتن به اتصال‌ها', onClick: onGoToConnections } }),
    },
    {
      ok:
        connection !== null &&
        connection.healthState === 'OK' &&
        (connection.verificationState === 'MOCK' ||
          connection.verificationState === 'LIVE_VERIFIED'),
      label:
        connection?.verificationState === 'MOCK'
          ? 'آزمایش شبیه‌سازی‌شده موفق بوده است — نه اتصال واقعی'
          : 'آخرین آزمایش اتصال واقعی موفق بوده است',
      ...(onTestConnection !== undefined
        ? { fix: { label: 'آزمایش اتصال', onClick: onTestConnection } }
        : onGoToConnections === undefined
          ? {}
          : { fix: { label: 'رفتن به اتصال‌ها', onClick: onGoToConnections } }),
    },
    {
      ok: connection?.settings.moneyUnit !== 'UNCONFIRMED',
      label: 'واحد پول (ریال یا تومان) تأیید شده است',
      ...(onFixMoney === undefined
        ? onGoToConnections === undefined
          ? {}
          : { fix: { label: 'تعیین واحد پول', onClick: onGoToConnections } }
        : { fix: { label: 'تعیین واحد پول', onClick: onFixMoney } }),
    },
    {
      ok: taxReady,
      label: taxLabel,
      ...(onFixTax === undefined
        ? onGoToConnections === undefined
          ? {}
          : { fix: { label: 'تنظیم مالیات حسابداری', onClick: onGoToConnections } }
        : { fix: { label: 'تنظیم مالیات حسابداری', onClick: onFixTax } }),
    },
    {
      ok: !outboundDisabled,
      label: metadataVerified === false
        ? 'وضعیت اجازه ارسال به حسابداری هنوز تأیید نشده است'
        : 'ارسال به حسابداری فعال است',
    },
  ];

  const missing = readiness.filter((item) => !item.ok);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--t-spacing-2)',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <p style={{ ...styles.meta, margin: 0 }}>
          این صفحه فقط می‌خواند؛ ارسال سند از مسیر پیش‌فاکتور انجام می‌شود.
        </p>
        <PrimaryButton
          label={busy ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی سوابق'}
          disabled={busy || connection === null}
          onClick={onReload}
        />
      </div>

      {outboundDisabled ? (
        <InlineAlert tone="info" title="ارسال خودکار به حسابداری خاموش است">
          در این نسخه هیچ سند، فاکتور یا مشتری‌ای به نرم‌افزار حسابداری نوشته نمی‌شود. این
          وضعیت برای آزمایش امن است.
        </InlineAlert>
      ) : (
        <InlineAlert tone="warning" title="یکی از مسیرهای ارسال فعال است">
          این صفحه خودش چیزی ارسال نمی‌کند، اما اسناد از مسیر پیش‌فاکتور ممکن است ارسال
          شوند. پیش از آزمایش، مقصد را بررسی کنید.
        </InlineAlert>
      )}

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
          label={taxNeedsCode ? 'اتصال کدهای مالیات' : 'قرارداد مالیات'}
          value={
            taxNeedsCode
              ? taxMappingCount.toLocaleString('fa-IR')
              : taxHandling === 'UNSUPPORTED'
                ? 'بدون پشتیبانی'
                : 'نرخ/مبلغ از CRM'
          }
          hint={
            taxNeedsCode && taxMappingCount === 0
              ? 'سند دارای مالیات ارسال نمی‌شود'
              : undefined
          }
          tone={
            taxHandling === 'UNSUPPORTED'
              ? 'danger'
              : taxNeedsCode && taxMappingCount === 0
                ? 'warning'
                : 'success'
          }
        />
        <StatCard
          label="عملیات ناتمام"
          value={unfinished.length.toLocaleString('fa-IR')}
          hint={unfinished.length === 0 ? 'همه‌چیز پایان یافته' : 'نیازمند بررسی'}
          tone={unfinished.length === 0 ? 'success' : 'warning'}
        />
      </StatGrid>

      <Card>
        <p style={styles.subtitle}>
          {missing.length === 0
            ? 'برای ارسال سند آماده است'
            : `${missing.length.toLocaleString('fa-IR')} کار باقی مانده است`}
        </p>
        <ul
          style={{
            margin: 0,
            paddingInlineStart: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: 'var(--t-font-size-sm)',
          }}
        >
          {readiness.map((item) => (
            <li
              key={item.label}
              style={{
                color: item.ok ? 'var(--t-color-green)' : 'var(--t-font-color-primary)',
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span>{`${item.ok ? '✓' : '○'} ${item.label}`}</span>
              {!item.ok && item.fix !== undefined ? (
                <SecondaryButton label={item.fix.label} onClick={item.fix.onClick} />
              ) : null}
            </li>
          ))}
        </ul>
        {missing.length === 0 ? null : (
          <p style={{ ...styles.meta, margin: 0 }}>
            تا زمانی که موارد بالا کامل نشوند، ارسال سند ممکن نیست یا ناقص انجام می‌شود.
          </p>
        )}
        {onGoToCatalog === undefined ? null : (
          <span>
            <SecondaryButton label="رفتن به کالاها" onClick={onGoToCatalog} />
          </span>
        )}
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
            نمایش سوابق برای همهٔ کاربران ممکن است؛ ارسال و اصلاح فقط با نقش مدیر انجام
            می‌شود.
          </p>
        )}

        {busy && operations.length === 0 ? (
          <StateBlock
            state="loading"
            title="در حال خواندن سوابق…"
            description="عملیات این اتصال خوانده می‌شود."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              operations.length === 0
                ? 'هنوز عملیاتی ثبت نشده است'
                : 'عملیات ناتمامی وجود ندارد'
            }
            description={
              operations.length === 0
                ? 'با ارسال اولین سند، نتیجهٔ آن در همین فهرست ثبت می‌شود.'
                : 'همهٔ عملیات این اتصال به پایان رسیده‌اند.'
            }
            action={
              onlyUnfinished ? (
                <SecondaryButton
                  label="نمایش همهٔ عملیات"
                  onClick={() => setOnlyUnfinished(false)}
                />
              ) : undefined
            }
          />
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
              «قابل تکرار» را می‌توان دوباره فرستاد؛ «قطعی» و «نیازمند اقدام دستی» را باید
              ابتدا در نرم‌افزار حسابداری بررسی کرد. تا زمانی که این ردیف‌ها باقی‌اند،
              وضعیت آن سند نامعلوم فرض می‌شود.
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

      <Details summary="جزئیات فنی: کلیدهای ارسال، ثبت سند و تاریخچهٔ خواندن">
        <span>{`ارسال به حسابداری: ${outboundEnabled ? 'فعال' : 'غیرفعال'}`}</span>
        <span>{`ثبت سند مالی: ${documentExportEnabled ? 'فعال' : 'غیرفعال'}`}</span>
        <span>{`تعداد عملیات خوانده‌شده: ${operations.length.toLocaleString('fa-IR')}`}</span>
        <span>
          اجرای هر عملیات پیش از ارسال، در سمت سرور اعتبارسنجی می‌شود؛ این صفحه تنها
          می‌خواند.
        </span>
      </Details>
    </div>
  );
};
