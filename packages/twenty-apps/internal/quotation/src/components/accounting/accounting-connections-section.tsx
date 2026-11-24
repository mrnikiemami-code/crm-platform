import { useMemo, useState } from 'react';

import {
  Badge,
  Card,
  EmptyState,
  InlineAlert,
  PrimaryButton,
  SearchField,
  SecondaryButton,
} from 'src/components/accounting/accounting-business-ui';
import { ConnectionEditForm } from 'src/components/accounting/accounting-connection-form';
import {
  CONNECTION_HEALTH_LABELS,
  type ConnectionRecord,
  type FinancialModes,
  type FormState,
  type PanelData,
  connectionHealthState,
  sharedStyles as styles,
  type TaxPolicyView,
} from 'src/components/accounting/accounting-shared';
import { orderConnections } from 'src/components/accounting/accounting-connection-rules';

// Connections: a list a person can scan, and one form that opens as an inner view.
//
// The list answers "which software am I connected to, and is it working?". The selected
// connection is pinned first and marked, and SELECTING it is a separate action from editing
// it: choosing which destination the rest of the CRM talks to must not open a form, and must
// not look like an edit.
//
// The edit form itself lives in `accounting-connection-form`, because it is one business
// form shared by every adapter: only the connection details and credentials differ, while
// currency, tax and advanced settings keep the same structure everywhere.

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
  onSetWorkspaceDefault,
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
  onSetWorkspaceDefault: (connection: ConnectionRecord) => void;
  onEditConnection: (connection: ConnectionRecord) => void;
  onChange: (form: FormState) => void;
  onSave: () => void;
  onTest: () => void;
  onStartNew: () => void;
}) => {
  const [query, setQuery] = useState('');
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

  if (view === 'form') {
    return (
      <ConnectionEditForm
        data={data}
        form={form}
        modes={modes}
        policies={policies}
        canManage={canManage}
        busy={busy}
        testResult={testResult}
        focus={focus}
        onBack={onOpenList}
        onChange={onChange}
        onSave={onSave}
        onTest={onTest}
      />
    );
  }

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
                        <span
                          style={{
                            display: 'flex',
                            gap: '4px',
                            flexWrap: 'wrap',
                            marginTop: '4px',
                          }}
                        >
                          {entry.isDefault ? (
                            <Badge tone="success">پیش‌فرض فضای کاری</Badge>
                          ) : null}
                          {selected ? (
                            <Badge tone="info">نمای موقت</Badge>
                          ) : null}
                        </span>
                      </td>
                      <td style={styles.cell}>
                        <span style={{ display: 'block' }}>
                          {entry.adapterId === 'mock'
                            ? 'آزمایشی، بدون ارتباط واقعی'
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
                              selected ? 'نمای موقت فعال' : 'انتخاب نمای موقت'
                            }
                            disabled={selected || busy}
                            onClick={() => onSelectConnection(entry)}
                          />
                          <SecondaryButton
                            label={
                              entry.isDefault
                                ? 'پیش‌فرض فضای کاری'
                                : 'تنظیم به‌عنوان پیش‌فرض'
                            }
                            disabled={
                              busy ||
                              !canManage ||
                              entry.isDefault ||
                              entry.isActive === false
                            }
                            onClick={() => onSetWorkspaceDefault(entry)}
                          />
                          <SecondaryButton
                            label="ویرایش تنظیمات"
                            disabled={!canManage || busy}
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
            «نمای موقت» فقط همین صفحه را برای نگاشت کالا و مشتری تغییر می‌دهد و پیش‌فرض فضای
            کاری را عوض نمی‌کند. «تنظیم به‌عنوان پیش‌فرض» مقصد رسمی Workspace را روی سرور ثبت
            می‌کند و همان مقصد را پیش‌فاکتور می‌خواند. برای نام، آدرس یا تنظیمات مالی، «ویرایش
            تنظیمات» را بزنید.
          </p>
        </Card>
      )}
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
