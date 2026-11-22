import {
  Badge,
  Card,
  SectionHeader,
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

// The landing screen. It answers the three questions a person arrives with — is it
// connected, what is waiting for me, and what do I do next — and nothing else.
export const AccountingOverviewSection = ({
  data,
  activeConnectionId,
  pendingItems,
  pendingCustomers,
  onGoTo,
}: {
  data: PanelData;
  activeConnectionId: string | null;
  pendingItems: number;
  pendingCustomers: number;
  onGoTo: (sectionId: string) => void;
}) => {
  const connection: ConnectionRecord | null =
    data.connections.find((entry) => entry.id === activeConnectionId) ?? null;
  const outboundDisabled =
    !data.flags.outboundEnabled && !data.flags.documentExportEnabled;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
      <SectionHeader
        title="نمای کلی"
        description="وضعیت اتصال به نرم‌افزار حسابداری و کارهایی که منتظر شما هستند."
      />

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
                  : 'neutral'
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
        <StatCard
          label="ارسال به حسابداری"
          value={outboundDisabled ? 'غیرفعال است' : 'فعال'}
          hint="در این نسخه سند مالی ارسال نمی‌شود"
          tone={outboundDisabled ? 'success' : 'danger'}
        />
      </StatGrid>

      <Card>
        <p style={styles.subtitle}>از کجا شروع کنم؟</p>
        <ol
          style={{
            margin: 0,
            paddingInlineStart: '1.1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--t-spacing-2)',
            fontSize: 'var(--t-font-size-sm)',
          }}
        >
          <li>
            {connection === null
              ? 'در بخش «اتصال‌ها» یک اتصال بسازید و آدرس نرم‌افزار حسابداری را وارد کنید.'
              : `اتصال «${connection.name}» آماده است؛ اگر آدرس یا واحد پول تغییر کرده، آن را به‌روز کنید.`}{' '}
            <ActionButton label="رفتن به اتصال‌ها" onClick={() => onGoTo('connections')} />
          </li>
          <li>
            کالاها و خدمات را مرور کنید و هر کالا را به کالای CRM وصل کنید.{' '}
            <ActionButton label="رفتن به کالاها و خدمات" onClick={() => onGoTo('catalog')} />
          </li>
          <li>
            مشتریان را مرور کنید و برای هرکدام مشتری CRM را انتخاب کنید.{' '}
            <ActionButton label="رفتن به مشتریان" onClick={() => onGoTo('customers')} />
          </li>
          <li>
            در پایان، آمادگی اسناد و تاریخچهٔ عملیات را در «اسناد و سوابق» ببینید.{' '}
            <ActionButton label="رفتن به اسناد و سوابق" onClick={() => onGoTo('documents')} />
          </li>
        </ol>
      </Card>

      {connection === null ? (
        <p style={styles.warning}>
          هیچ اتصالی انتخاب نشده است. تا انتخاب نشدن اتصال، فهرست کالاها و مشتریان
          نمایش داده نمی‌شود.
        </p>
      ) : (
        <Card>
          <p style={styles.subtitle}>این اتصال در یک نگاه</p>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <Badge tone="neutral">{`نرم‌افزار: ${
              connection.adapterId === 'mock'
                ? 'حسابداری آزمایشی'
                : 'نرم‌افزار حسابداری آسان'
            }`}</Badge>
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
            <Badge tone="neutral">{`واحد پول: ${
              connection.settings.moneyUnit === 'RIAL'
                ? 'ریال'
                : connection.settings.moneyUnit === 'TOMAN'
                  ? 'تومان'
                  : 'تأییدنشده'
            }`}</Badge>
          </div>
          {connection.lastHealthMessage === null ? null : (
            <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
              {connection.lastHealthMessage}
            </p>
          )}
        </Card>
      )}
    </div>
  );
};

const ActionButton = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    style={{
      ...styles.button,
      padding: '2px 8px',
      fontSize: 'var(--t-font-size-xs)',
      marginInlineStart: '4px',
    }}
    onClick={onClick}
  >
    {label}
  </button>
);
