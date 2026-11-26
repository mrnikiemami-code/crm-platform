import { useMemo, useState } from 'react';

import {
  Badge,
  Card,
  EmptyState,
  InlineAlert,
  PrimaryButton,
  SearchField,
} from 'src/components/accounting/accounting-business-ui';
import { ConnectionEditForm } from 'src/components/accounting/accounting-connection-form';
import {
  type CatalogReadState,
} from 'src/components/accounting/accounting-catalog-read';
import {
  CONNECTION_HEALTH_LABELS,
  adapterDisplayLabel,
  type ConnectionRecord,
  type FinancialModes,
  type FormState,
  type PanelData,
  connectionHealthState,
  formatHealthCheckAt,
  sharedStyles as styles,
  type CurrencyCatalogView,
  type TaxPolicyView,
} from 'src/components/accounting/accounting-shared';
import { RowMenu } from 'src/components/financial-settings/row-menu';

// Connections list: workspace-default destination only. Catalog/customers/documents always
// read that default from the server — there is no temporary browser-local working view.

export const AccountingConnectionsSection = ({
  data,
  form,
  modes,
  policies,
  currencies,
  taxCatalog,
  currencyCatalog,
  onRetryCatalogs,
  canManage,
  busy,
  testResult,
  view,
  focus,
  onOpenList,
  onSetWorkspaceDefault,
  onDeactivateConnection,
  onReactivateConnection,
  onEditConnection,
  onTestConnection,
  onChange,
  onSave,
  onTest,
  onStartNew,
}: {
  data: PanelData;
  form: FormState;
  modes: FinancialModes;
  policies: TaxPolicyView[];
  currencies: CurrencyCatalogView[];
  taxCatalog: CatalogReadState<TaxPolicyView>;
  currencyCatalog: CatalogReadState<CurrencyCatalogView>;
  onRetryCatalogs: () => void;
  canManage: boolean;
  busy: boolean;
  testResult: { healthState: string; message: string; detail: string } | null;
  view: 'list' | 'form';
  focus: 'money' | 'tax' | null;
  onOpenList: () => void;
  onSetWorkspaceDefault: (connection: ConnectionRecord) => void;
  onDeactivateConnection: (connection: ConnectionRecord) => void;
  onReactivateConnection: (connection: ConnectionRecord) => void;
  onEditConnection: (connection: ConnectionRecord) => void;
  onTestConnection: (connection: ConnectionRecord) => void;
  onChange: (form: FormState) => void;
  onSave: () => void;
  onTest: () => void;
  onStartNew: () => void;
}) => {
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (needle === '') {
      return data.connections;
    }

    return data.connections.filter((connection) => {
      const adapter = data.adapters.find((entry) => entry.id === connection.adapterId);

      return [
        connection.name,
        adapterDisplayLabel(adapter),
        CONNECTION_HEALTH_LABELS[connectionHealthState(connection)],
        connection.settings.baseUrl,
      ].some((field) => field.toLowerCase().includes(needle));
    });
  }, [data.adapters, data.connections, query]);

  const ordered = useMemo(() => {
    const defaults = filtered.filter(
      (entry) => entry.isDefault === true && entry.isActive === true,
    );
    const rest = filtered.filter(
      (entry) => !(entry.isDefault === true && entry.isActive === true),
    );

    return [...defaults, ...rest];
  }, [filtered]);

  if (view === 'form') {
    return (
      <ConnectionEditForm
        data={data}
        form={form}
        modes={modes}
        policies={policies}
        currencies={currencies}
        taxCatalog={taxCatalog}
        currencyCatalog={currencyCatalog}
        onRetryCatalogs={onRetryCatalogs}
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
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}
    >
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
          description="برای دیدن کالاها و مشتریان حسابداری، ابتدا یک اتصال بسازید."
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
              style={{ ...styles.table, minWidth: '760px' }}
            >
              <thead>
                <tr>
                  <th style={styles.cell}>نرم‌افزار حسابداری</th>
                  <th style={styles.cell}>نام اتصال</th>
                  <th style={styles.cell}>وضعیت</th>
                  <th style={styles.cell}>آخرین آزمایش</th>
                  <th style={styles.cell}>اتصال پیش‌فرض</th>
                  <th style={styles.cell}>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((entry) => {
                  const health = connectionHealthState(entry);
                  const isWorkspaceDefault =
                    entry.isDefault === true && entry.isActive === true;
                  const lastCheck = formatHealthCheckAt(entry.lastHealthCheckAt);

                  return (
                    <tr
                      key={entry.id}
                      data-connection-id={entry.id}
                      data-default={isWorkspaceDefault ? 'true' : 'false'}
                      style={
                        isWorkspaceDefault
                          ? {
                              background:
                                'color-mix(in srgb, var(--t-color-blue) 9%, transparent)',
                            }
                          : undefined
                      }
                    >
                      <td style={styles.cell}>
                        {adapterDisplayLabel(
                          data.adapters.find(
                            (adapter) => adapter.id === entry.adapterId,
                          ),
                        )}
                      </td>
                      <td style={styles.cell}>
                        <span style={{ display: 'block', fontWeight: 600 }}>
                          {entry.name}
                        </span>
                        {entry.isActive === false ? (
                          <Badge tone="neutral">غیرفعال</Badge>
                        ) : (
                          <Badge tone="info">فعال</Badge>
                        )}
                      </td>
                      <td style={styles.cell}>
                        <Badge tone={healthTone(health)}>
                          {CONNECTION_HEALTH_LABELS[health]}
                        </Badge>
                      </td>
                      <td style={styles.cell}>
                        {lastCheck ?? '—'}
                      </td>
                      <td style={styles.cell}>
                        {isWorkspaceDefault ? (
                          <Badge tone="success">پیش‌فرض</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={styles.cell}>
                        <RowMenu
                          label={`عملیات ${entry.name}`}
                          open={openMenuId === entry.id}
                          onOpenChange={(next) =>
                            setOpenMenuId(next ? entry.id : null)
                          }
                          items={[
                            {
                              id: 'edit',
                              label: 'ویرایش',
                              disabled: !canManage || busy,
                              onSelect: () => onEditConnection(entry),
                            },
                            {
                              id: 'test',
                              label: 'آزمایش اتصال',
                              disabled: busy || entry.isActive === false,
                              disabledReason:
                                entry.isActive === false
                                  ? 'اتصال غیرفعال را نمی‌توان آزمایش کرد.'
                                  : undefined,
                              onSelect: () => onTestConnection(entry),
                            },
                            {
                              id: 'default',
                              label: 'تنظیم به‌عنوان پیش‌فرض',
                              disabled:
                                busy ||
                                !canManage ||
                                isWorkspaceDefault ||
                                entry.isActive === false,
                              disabledReason: isWorkspaceDefault
                                ? 'این اتصال هم‌اکنون پیش‌فرض است.'
                                : entry.isActive === false
                                  ? 'اتصال غیرفعال را نمی‌توان پیش‌فرض کرد.'
                                  : undefined,
                              onSelect: () => onSetWorkspaceDefault(entry),
                            },
                            entry.isActive === false
                              ? {
                                  id: 'activate',
                                  label: 'فعال کردن',
                                  disabled: !canManage || busy,
                                  onSelect: () => onReactivateConnection(entry),
                                }
                              : {
                                  id: 'deactivate',
                                  label: 'غیرفعال کردن',
                                  disabled: !canManage || busy,
                                  danger: true,
                                  onSelect: () => onDeactivateConnection(entry),
                                },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
                {ordered.length === 0 ? (
                  <tr>
                    <td style={styles.cell} colSpan={6}>
                      {`اتصالی با «${query}» پیدا نشد.`}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
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
