import {
  Badge,
  PrimaryButton,
  StatCard,
  StatGrid,
} from 'src/components/accounting/accounting-business-ui';
import {
  adapterDisplayLabel,
  type ConnectionRecord,
  type PanelData,
  HEALTH_LABELS,
  formatHealthCheckAt,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';
import { type SnapshotView } from 'src/components/accounting/accounting-mapping-types';

const STALE_SNAPSHOT_MS = 30 * 60 * 1000;

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

const unreadLabel = '—';

// Operational landing only: active software, connection health, last test/sync, and
// unverified counts stay as dashes — never invented zeros.
export const AccountingOverviewSection = ({
  data,
  activeConnectionId,
  snapshot,
  pendingItems,
  pendingCustomers,
  pendingDocuments = null,
  onGoTo,
  onTestConnection,
}: {
  data: PanelData;
  activeConnectionId: string | null;
  snapshot: SnapshotView | null;
  pendingItems: number | null;
  pendingCustomers: number | null;
  pendingDocuments?: number | null;
  onGoTo: (sectionId: string) => void;
  onTestConnection?: () => void;
}) => {
  const connection: ConnectionRecord | null =
    data.connections.find((entry) => entry.id === activeConnectionId) ?? null;
  const checkedAt = formatHealthCheckAt(connection?.lastHealthCheckAt ?? null);
  const snapshotAge = snapshot === null ? null : formatAge(snapshot.ageMs);
  const adapter = data.adapters.find(
    (entry) => entry.id === connection?.adapterId,
  );
  const isMock = adapter !== undefined && adapter.isLive !== true;

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <span style={styles.subtitle}>
            {connection === null
              ? 'نرم‌افزار حسابداری فعال تعیین نشده'
              : adapterDisplayLabel(adapter)}
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge
              tone={
                connection === null
                  ? 'warning'
                  : connection.healthState === 'OK'
                    ? 'success'
                    : connection.healthState === 'FAILED'
                      ? 'danger'
                      : 'warning'
              }
            >
              {connection === null
                ? 'بدون اتصال پیش‌فرض'
                : (HEALTH_LABELS[connection.healthState] ?? connection.healthState)}
            </Badge>
            {isMock ? <Badge tone="info">آزمایشی</Badge> : null}
            {connection?.name ? (
              <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
                {connection.name}
              </span>
            ) : null}
          </div>
        </div>
        <PrimaryButton
          label="آزمایش اتصال"
          disabled={connection === null || onTestConnection === undefined}
          onClick={() => onTestConnection?.()}
        />
      </div>

      <StatGrid>
        <StatCard
          label="وضعیت اتصال"
          value={
            connection === null
              ? 'بدون پیش‌فرض'
              : (HEALTH_LABELS[connection.healthState] ?? connection.healthState)
          }
          tone={
            connection === null
              ? 'warning'
              : connection.healthState === 'OK'
                ? 'success'
                : connection.healthState === 'FAILED'
                  ? 'danger'
                  : 'warning'
          }
          onClick={() => onGoTo('connections')}
        />
        <StatCard
          label="آخرین آزمایش اتصال"
          value={checkedAt ?? unreadLabel}
          tone={checkedAt === null ? 'warning' : 'neutral'}
          onClick={() => onGoTo('connections')}
        />
        <StatCard
          label="آخرین همگام‌سازی"
          value={snapshotAge ?? unreadLabel}
          tone={
            snapshot === null ||
            snapshot.syncStatus === 'INCOMPLETE' ||
            snapshot.degradedReason !== null ||
            (snapshot.reused && snapshot.ageMs >= STALE_SNAPSHOT_MS)
              ? 'warning'
              : 'success'
          }
          onClick={() => onGoTo('catalog')}
        />
        <StatCard
          label="کالاهای منتقل‌نشده"
          value={
            pendingItems === null ? unreadLabel : pendingItems.toLocaleString('fa-IR')
          }
          tone={pendingItems === null || pendingItems > 0 ? 'warning' : 'success'}
          onClick={() => onGoTo('catalog')}
        />
        <StatCard
          label="مشتریان منتقل‌نشده"
          value={
            pendingCustomers === null
              ? unreadLabel
              : pendingCustomers.toLocaleString('fa-IR')
          }
          tone={
            pendingCustomers === null || pendingCustomers > 0 ? 'warning' : 'success'
          }
          onClick={() => onGoTo('customers')}
        />
        <StatCard
          label="اسناد ارسال‌نشده"
          value={
            pendingDocuments === null
              ? unreadLabel
              : pendingDocuments.toLocaleString('fa-IR')
          }
          tone={
            pendingDocuments === null || pendingDocuments > 0 ? 'warning' : 'success'
          }
          onClick={() => onGoTo('documents')}
        />
      </StatGrid>
    </div>
  );
};