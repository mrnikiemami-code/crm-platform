import {
  Badge,
  Card,
  Details,
  InlineAlert,
  PrimaryButton,
  StatCard,
  StatGrid,
} from 'src/components/accounting/accounting-business-ui';
import {
  type ConnectionRecord,
  type PanelData,
  HEALTH_LABELS,
  VERIFICATION_LABELS,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';
import { type SnapshotView } from 'src/components/accounting/accounting-mapping-types';

// Half an hour is where a list stops feeling current: the person is told it came from an
// older read and given the button that reads it again, instead of trusting a stale count.
const STALE_SNAPSHOT_MS = 30 * 60 * 1000;

// The landing screen. It answers the three questions a person arrives with — is it
// connected, is what I see current, and what do I do next — and nothing else. Everything an
// accountant never needs (adapter ids, verification vocabulary, health detail) is folded
// into «جزئیات فنی» instead of being printed beside the answer.

const formatCheckTime = (value: string | null): string | null => {
  if (value === null || value.trim() === '') {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
};

const formatAge = (ageMs: number): string => {
  const minutes = Math.max(0, Math.round(ageMs / 60000));

  if (minutes < 1) {
    return 'همین حالا';
  }

  if (minutes < 60) {
    return `${minutes.toLocaleString('fa-IR')} دقیقه پیش`;
  }

  const hours = Math.round(minutes / 60);

  return `${hours.toLocaleString('fa-IR')} ساعت پیش`;
};

export const AccountingOverviewSection = ({
  data,
  activeConnectionId,
  snapshot,
  pendingItems,
  pendingCustomers,
  onGoTo,
  onTestConnection,
}: {
  data: PanelData;
  activeConnectionId: string | null;
  snapshot: SnapshotView | null;
  pendingItems: number;
  pendingCustomers: number;
  onGoTo: (sectionId: string) => void;
  onTestConnection?: () => void;
}) => {
  const connection: ConnectionRecord | null =
    data.connections.find((entry) => entry.id === activeConnectionId) ?? null;
  const outboundDisabled =
    !data.flags.outboundEnabled && !data.flags.documentExportEnabled;
  const checkedAt = formatCheckTime(connection?.lastHealthCheckAt ?? null);
  const snapshotAge = snapshot === null ? null : formatAge(snapshot.ageMs);
  const snapshotIncomplete = snapshot !== null && snapshot.syncStatus === 'INCOMPLETE';
  const snapshotDegraded = snapshot !== null && snapshot.degradedReason !== null;
  const snapshotStale = snapshot !== null && snapshot.reused && snapshot.ageMs >= STALE_SNAPSHOT_MS;

  // One list, ordered by what blocks a quotation, each row carrying its own way forward.
  const attention: { key: string; text: string; label: string; target: string; run?: () => void }[] =
    [];

  if (connection === null) {
    attention.push({
      key: 'no-connection',
      text: 'هنوز اتصالی انتخاب نشده است؛ بدون آن فهرست کالاها و مشتریان خالی می‌ماند.',
      label: 'ساخت اتصال',
      target: 'connections',
    });
  } else if (connection.healthState !== 'OK') {
    attention.push({
      key: 'health',
      text:
        connection.healthState === 'FAILED'
          ? 'آخرین آزمایش اتصال ناموفق بود؛ آدرس و شبکه را بررسی کنید.'
          : 'این اتصال هنوز آزمایش نشده است؛ برای اطمینان یک آزمایش کوتاه اجرا کنید.',
      label: 'آزمایش اتصال',
      target: 'connections',
      // The label promises a test, so the button runs one; only without a handler does it
      // fall back to taking the reader to the section that owns the test button.
      ...(onTestConnection === undefined ? {} : { run: onTestConnection }),
    });
  }

  if (pendingItems > 0) {
    attention.push({
      key: 'items',
      text: `${pendingItems.toLocaleString('fa-IR')} کالا در حسابداری هست که به کالای CRM وصل نشده است.`,
      label: 'بررسی کالاها',
      target: 'catalog',
    });
  }

  // The count above is only as whole as the read behind it, so a partial or fallback read
  // is named in the same list as the other work, not buried in the technical details.
  if (snapshotIncomplete) {
    attention.push({
      key: 'snapshot-incomplete',
      text: 'فهرست کالاها کامل خوانده نشد؛ فقط بخشی از کالاهای حسابداری در دسترس است.',
      label: 'دیدن محدودیت',
      target: 'catalog',
    });
  } else if (snapshotDegraded) {
    attention.push({
      key: 'snapshot-degraded',
      text: 'نرم‌افزار حسابداری در خواندن آخر پاسخ نداد؛ فهرست قبلی نشان داده می‌شود.',
      label: 'بررسی اتصال',
      target: 'connections',
    });
  } else if (snapshotStale) {
    attention.push({
      key: 'snapshot-stale',
      text: `فهرست کالاها ${snapshotAge ?? ''} خوانده شده و ممکن است تغییر کرده باشد.`,
      label: 'خواندن دوباره',
      target: 'catalog',
    });
  }

  if (pendingCustomers > 0) {
    attention.push({
      key: 'customers',
      text: `${pendingCustomers.toLocaleString('fa-IR')} مشتری هنوز مشتری CRM ندارد.`,
      label: 'بررسی مشتریان',
      target: 'customers',
    });
  }

  const nextAction: {
    key: string;
    text: string;
    label: string;
    target: string;
    run?: () => void;
  } =
    attention[0] ?? {
      key: 'documents',
      text: 'همهٔ کالاها و مشتریان وصل شده‌اند؛ آمادگی اسناد را یک‌بار ببینید.',
      label: 'دیدن اسناد',
      target: 'documents',
    };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
      <StatGrid>
        <StatCard
          label="وضعیت اتصال"
          value={
            connection === null
              ? 'اتصالی انتخاب نشده'
              : (HEALTH_LABELS[connection.healthState] ?? connection.healthState)
          }
          hint={connection?.name}
          tone={
            connection === null
              ? 'warning'
              : connection.healthState === 'OK'
                ? 'success'
                : connection.healthState === 'FAILED'
                  ? 'danger'
                  : 'warning'
          }
        />
        <StatCard
          label="آخرین آزمایش اتصال"
          value={checkedAt ?? 'انجام نشده'}
          hint="آزمایش دستی اتصال"
          tone={checkedAt === null ? 'warning' : 'neutral'}
        />
        <StatCard
          label="آخرین همگام‌سازی"
          value={snapshotAge ?? 'نخوانده'}
          hint={
            snapshot === null
              ? 'هنوز فهرستی از حسابداری خوانده نشده'
              : snapshotIncomplete
                ? 'فقط بخشی از فهرست خوانده شد'
                : snapshotDegraded
                  ? 'از فهرست قبلی استفاده شد'
                  : 'فهرست کامل خوانده شد'
          }
          tone={
            snapshot === null || snapshotIncomplete || snapshotDegraded
              ? 'warning'
              : snapshotStale
                ? 'warning'
                : 'success'
          }
        />
        <StatCard
          label="کالاهای وصل‌نشده"
          value={pendingItems.toLocaleString('fa-IR')}
          hint="در حسابداری هست، در CRM وصل نشده"
          tone={pendingItems > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="مشتریان وصل‌نشده"
          value={pendingCustomers.toLocaleString('fa-IR')}
          hint="نیازمند انتخاب مشتری CRM"
          tone={pendingCustomers > 0 ? 'warning' : 'success'}
        />
      </StatGrid>

      <Card tone={attention.length > 0 ? 'warning' : 'success'}>
        <p style={styles.subtitle}>
          {attention.length > 0
            ? `${attention.length.toLocaleString('fa-IR')} مورد نیازمند رسیدگی`
            : 'همه‌چیز مرتب است'}
        </p>
        {attention.length === 0 ? (
          <p style={styles.meta}>
            اتصال برقرار است، کالاها و مشتریان وصل شده‌اند و کاری باقی نمانده است.
          </p>
        ) : (
          <ul
            style={{
              margin: 0,
              paddingInlineStart: '1.1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--t-spacing-2)',
              fontSize: 'var(--t-font-size-sm)',
            }}
          >
            {attention.slice(0, 4).map((item) => (
              <li key={item.key}>
                {item.text}{' '}
                <button
                  type="button"
                  style={{ ...styles.button, padding: '2px 8px', fontSize: 'var(--t-font-size-xs)' }}
                  onClick={() => {
                    if (item.run === undefined) {
                      onGoTo(item.target);
                      return;
                    }

                    item.run();
                  }}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--t-spacing-2)',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid color-mix(in srgb, var(--t-color-blue) 30%, transparent)',
          background: 'color-mix(in srgb, var(--t-color-blue) 6%, transparent)',
          borderRadius: 'var(--t-border-radius-sm)',
          padding: 'var(--t-spacing-3)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <span style={{ fontSize: 'var(--t-font-size-sm)', fontWeight: 'var(--t-font-weight-semi-bold)' }}>
            اقدام بعدی
          </span>
          <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>{nextAction.text}</span>
        </div>
        <PrimaryButton
          label={nextAction.label}
          onClick={() => {
            if (nextAction.run === undefined) {
              onGoTo(nextAction.target);
              return;
            }

            nextAction.run();
          }}
        />
      </div>

      <InlineAlert tone={outboundDisabled ? 'success' : 'danger'}>
        {outboundDisabled
          ? 'ارسال سند به حسابداری در این نسخه غیرفعال است؛ این صفحه فقط می‌خواند و چیزی به حسابداری نمی‌نویسد.'
          : 'یکی از کلیدهای ارسال فعال است. با این حال، این صفحه خودش سندی ارسال نمی‌کند؛ ارسال از مسیر پیش‌فاکتور انجام می‌شود.'}
      </InlineAlert>

      <Details>
        {connection === null ? (
          <span>اتصالی ثبت نشده است، بنابراین اطلاعات فنی برای نمایش وجود ندارد.</span>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <Badge tone="neutral">
                {connection.adapterId === 'mock'
                  ? 'نوع اتصال: حسابداری آزمایشی'
                  : 'نوع اتصال: آسان'}
              </Badge>
              <Badge
                tone={
                  connection.verificationState === 'LIVE_VERIFIED'
                    ? 'success'
                    : connection.verificationState === 'LIVE_UNVERIFIED'
                      ? 'warning'
                      : 'info'
                }
              >
                {VERIFICATION_LABELS[connection.verificationState] ??
                  connection.verificationState}
              </Badge>
              <Badge tone="neutral">
                {`واحد پول: ${
                  connection.settings.moneyUnit === 'RIAL'
                    ? 'ریال'
                    : connection.settings.moneyUnit === 'TOMAN'
                      ? 'تومان'
                      : 'تأییدنشده'
                }`}
              </Badge>
            </div>
            <span>{`شناسهٔ اتصال: ${connection.id}`}</span>
            <span>{`شناسهٔ نرم‌افزار: ${connection.adapterId} نسخهٔ ${connection.adapterVersion ?? 'نامشخص'}`}</span>
            <span>{`وضعیت فنی: ${connection.healthState} — ${HEALTH_LABELS[connection.healthState] ?? ''}`}</span>
            {connection.lastHealthMessage === null ? null : (
              <span>{`پیام آخرین آزمایش: ${connection.lastHealthMessage}`}</span>
            )}
            <span>
              ارسال به حسابداری: {data.flags.outboundEnabled ? 'فعال' : 'غیرفعال'} —
              ثبت سند: {data.flags.documentExportEnabled ? 'فعال' : 'غیرفعال'}
            </span>
          </>
        )}
      </Details>
    </div>
  );
};
