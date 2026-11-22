import { useCallback, useEffect, useMemo, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import {
  ACCOUNTING_IMPORT_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import {
  Badge,
  Details,
  EmptyState,
  InlineAlert,
  LimitNotice,
  Pager,
  PrimaryButton,
  SearchField,
  SecondaryButton,
  StateBlock,
} from 'src/components/accounting/accounting-business-ui';
import {
  ITEM_STATUS_LABELS,
  formatMicrosForDisplay,
  itemStatusTone,
  parseItemMappingPage,
  type ItemMappingPage,
  type ItemMappingRow,
} from 'src/components/accounting/accounting-mapping-types';
import {
  DECISION_LABELS,
  WARNING_LABELS,
  asRecord,
  readString,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

const PAGE_SIZE = 25;

type Selection = { internalItemId: string | null };

// One Persian sentence per decision, written for the person fixing the row rather than the
// person who wrote the matcher. The badge already says «کد تکراری»; this says what to do.
const DECISION_HELP: Record<string, string> = {
  DUPLICATE_REMOTE_CODE:
    'دو کالا در نرم‌افزار حسابداری همین کد را دارند. تا وقتی کد یکی اصلاح نشود، اتصال ممکن نیست.',
  IN_SYNC: 'این کالا قبلاً به CRM وصل شده است.',
  LINK_SUGGESTED: 'کالای مشابه در CRM پیدا شد؛ با تأیید شما وصل می‌شود.',
  LINK_AMBIGUOUS: 'چند کالای هم‌کد در CRM هست؛ باید دستی یکی را انتخاب کنید.',
  CREATE: 'کالای متناظر در CRM نیست؛ با ثبت، ساخته می‌شود.',
  REMOTE_CHANGED: 'اطلاعات این کالا در حسابداری تغییر کرده است؛ پس از بررسی، دوباره وصل کنید.',
};

type RowFilter = 'ALL' | 'NEEDS_ACTION' | 'UNLINKED' | 'DUPLICATE';

const ROW_FILTERS: { id: RowFilter; label: string }[] = [
  { id: 'ALL', label: 'همه' },
  { id: 'NEEDS_ACTION', label: 'نیازمند رسیدگی' },
  { id: 'UNLINKED', label: 'وصل‌نشده' },
  { id: 'DUPLICATE', label: 'کد تکراری' },
];

const matchesFilter = (row: ItemMappingRow, filter: RowFilter): boolean => {
  if (filter === 'ALL') {
    return true;
  }
  if (filter === 'DUPLICATE') {
    return row.decision === 'DUPLICATE_REMOTE_CODE';
  }
  if (filter === 'UNLINKED') {
    return row.decision !== 'IN_SYNC';
  }
  return (
    row.decision === 'DUPLICATE_REMOTE_CODE' ||
    row.decision === 'LINK_AMBIGUOUS' ||
    row.decision === 'REMOTE_CHANGED'
  );
};

// Products and services: what the destination has, and how it attaches to the CRM catalog.
//
// Everything visible here is ONE page. The list is asked for with a cursor, the search runs
// on the server, and the destination rows are read once into a bounded snapshot whose limit
// is stated on screen. Selections live outside the page, so choosing a row, searching for
// another, and paging do not lose what was already chosen.
//
// The status filter is client-side and says so, because the destination reader has no status
// parameter; shipping a chip row that silently searched only the current page would be a lie.
export const AccountingCatalogSection = ({
  connectionId,
  canManage,
  moneyUnitLabel,
  onPendingCountChange,
  onGoToConnections,
}: {
  connectionId: string | null;
  canManage: boolean;
  moneyUnitLabel: string;
  onPendingCountChange?: (count: number) => void;
  onGoToConnections?: () => void;
}) => {
  const [page, setPage] = useState<ItemMappingPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [rowFilter, setRowFilter] = useState<RowFilter>('ALL');
  // A stack of the cursors that produced each visited page, so "previous" is exact and does
  // not need a reverse cursor the destination does not provide.
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [selected, setSelected] = useState<Map<string, Selection>>(new Map());
  const [applying, setApplying] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const pageIndex = cursorStack.length - 1;
  const cursor = cursorStack[pageIndex] ?? null;

  const loadPage = useCallback(
    async ({
      atCursor,
      search,
      refresh = false,
    }: {
      atCursor: string | null;
      search: string;
      refresh?: boolean;
    }) => {
      if (connectionId === null) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
          action: 'preview-items-page',
          connectionId,
          cursor: atCursor,
          pageSize: PAGE_SIZE,
          search,
          refresh,
        });

        if (!response.ok || response.data.success !== true) {
          setError(
            toPersianUiMessage(
              readString(response.data.message),
              'خواندن کالاهای نرم‌افزار حسابداری انجام نشد.',
            ),
          );
          return;
        }

        setPage(parseItemMappingPage(response.data.page));
      } catch {
        setError('ارتباط با سرور برقرار نشد.');
      } finally {
        setLoading(false);
      }
    },
    [connectionId],
  );

  useEffect(() => {
    setCursorStack([null]);
    setPage(null);
    setSubmittedSearch('');
    setSearchDraft('');
    setRowFilter('ALL');
    void loadPage({ atCursor: null, search: '' });
  }, [connectionId, loadPage, reloadToken]);

  useEffect(() => {
    onPendingCountChange?.(page?.summary.unlinked ?? 0);
  }, [onPendingCountChange, page?.summary.unlinked]);

  const applySearch = (term: string) => {
    setSubmittedSearch(term);
    setRowFilter('ALL');
    setCursorStack([null]);
    void loadPage({ atCursor: null, search: term });
  };

  const toggleSelection = (row: ItemMappingRow) => {
    setSelected((current) => {
      const next = new Map(current);

      if (next.has(row.externalItemId)) {
        next.delete(row.externalItemId);
        return next;
      }

      // A row that is already linked, or that the destination reports as a duplicate code,
      // cannot be applied; offering a checkbox would promise a write that will be refused.
      if (row.decision === 'IN_SYNC' || row.decision === 'DUPLICATE_REMOTE_CODE') {
        return current;
      }

      next.set(row.externalItemId, {
        internalItemId: row.suggestedInternalItemId,
      });

      return next;
    });
  };

  const applySelection = async () => {
    if (connectionId === null || selected.size === 0 || applying) {
      return;
    }

    setApplying(true);

    try {
      const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
        action: 'apply-items',
        connectionId,
        selections: [...selected.entries()].map(([externalItemId, selection]) => ({
          externalItemId,
          ...(selection.internalItemId === null
            ? {}
            : { internalItemId: selection.internalItemId }),
        })),
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'ثبت اتصال کالاها انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      const outcome = asRecord(response.data.outcome);
      const createdLinks =
        typeof outcome?.createdLinks === 'number' ? outcome.createdLinks : 0;
      const createdItems =
        typeof outcome?.createdItems === 'number' ? outcome.createdItems : 0;

      await enqueueSnackbar({
        message: `ثبت شد: ${createdItems} کالای جدید در CRM و ${createdLinks} اتصال.`,
        variant: 'success',
      });
      setSelected(new Map());
      void loadPage({ atCursor: cursor, search: submittedSearch, refresh: true });
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setApplying(false);
    }
  };

  const visibleRows = useMemo(
    () => (page === null ? [] : page.rows.filter((row) => matchesFilter(row, rowFilter))),
    [page, rowFilter],
  );

  if (connectionId === null) {
    return (
      <EmptyState
        title="ابتدا یک اتصال انتخاب کنید"
        description="کالاها از نرم‌افزار حسابداری خوانده می‌شوند. در بخش «اتصال‌ها» یک اتصال بسازید یا انتخاب کنید، سپس به اینجا برگردید."
        action={
          onGoToConnections === undefined ? undefined : (
            <PrimaryButton label="رفتن به اتصال‌ها" onClick={onGoToConnections} />
          )
        }
      />
    );
  }

  const snapshot = page?.snapshot;
  const truncated = snapshot?.truncation.kind === 'BOUNDED';

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
        <form
          style={{ display: 'flex', gap: 'var(--t-spacing-2)', alignItems: 'flex-end', flex: '1 1 260px' }}
          onSubmit={(event) => {
            event.preventDefault();
            applySearch(searchDraft.trim());
          }}
        >
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <SearchField
              label="جست‌وجو در کالاهای حسابداری"
              value={searchDraft}
              placeholder="نام یا کد کالا"
              onChange={setSearchDraft}
            />
          </div>
          <SecondaryButton
            label="جست‌وجو"
            onClick={() => applySearch(searchDraft.trim())}
            disabled={loading}
          />
        </form>
        <SecondaryButton
          label={loading ? 'در حال خواندن…' : 'خواندن دوباره از حسابداری'}
          onClick={() => setReloadToken((token) => token + 1)}
          disabled={loading}
        />
      </div>

      {page !== null ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ROW_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                aria-pressed={rowFilter === filter.id ? 'true' : 'false'}
                style={{
                  ...styles.button,
                  ...(rowFilter === filter.id ? styles.buttonPrimary : {}),
                }}
                onClick={() => setRowFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
            <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)', alignSelf: 'center' }}>
              {rowFilter === 'ALL'
                ? 'همهٔ کالاهای این صفحه نمایش داده می‌شوند.'
                : 'این فیلتر فقط روی کالاهای همین صفحه اعمال می‌شود؛ برای دیدن بقیه، صفحه را عوض کنید یا جست‌وجو کنید.'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 'var(--t-spacing-2)',
            }}
          >
            <SummaryChip label="وصل‌شده" value={page.summary.linked ?? 0} tone="success" />
            <SummaryChip label="وصل‌نشده" value={page.summary.unlinked ?? 0} />
            <SummaryChip label="کد تکراری" value={page.summary.blocked ?? 0} tone="danger" />
            <SummaryChip
              label="نیازمند بررسی"
              value={page.summary.needsAttention ?? 0}
              tone="warning"
            />
          </div>
        </>
      ) : null}

      {error !== null ? (
        <InlineAlert tone="danger" title="خواندن کالاها انجام نشد">
          {error}
          <span style={{ display: 'block', marginTop: '6px' }}>
            اتصال را در بخش «اتصال‌ها» آزمایش کنید و دوباره تلاش کنید.
          </span>
          <span style={{ display: 'block', marginTop: '6px' }}>
            <SecondaryButton
              label="تلاش دوباره"
              onClick={() => setReloadToken((token) => token + 1)}
              disabled={loading}
            />
          </span>
        </InlineAlert>
      ) : null}

      {loading && page === null ? (
        <StateBlock
          state="loading"
          title="در حال خواندن کالاها…"
          description="یک صفحه از نرم‌افزار حسابداری خوانده می‌شود."
        />
      ) : null}

      {page !== null ? (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table
              aria-label="کالاهای نرم‌افزار حسابداری"
              style={{ ...styles.table, minWidth: '720px' }}
            >
              <thead>
                <tr>
                  <th style={styles.cell}>انتخاب</th>
                  <th style={styles.cell}>کد</th>
                  <th style={styles.cell}>نام در حسابداری</th>
                  <th style={styles.cell}>قیمت حسابداری</th>
                  <th style={styles.cell}>کالای CRM</th>
                  <th style={styles.cell}>تفاوت قیمت</th>
                  <th style={styles.cell}>وضعیت و دلیل</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const checked = selected.has(row.externalItemId);
                  const selectable =
                    row.decision !== 'IN_SYNC' &&
                    row.decision !== 'DUPLICATE_REMOTE_CODE';
                  const help = DECISION_HELP[row.decision];

                  return (
                    <tr key={row.externalItemId}>
                      <td style={styles.cell}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canManage || !selectable}
                          aria-label={`انتخاب ${row.name}`}
                          onChange={() => toggleSelection(row)}
                        />
                      </td>
                      <td style={{ ...styles.cell, direction: 'ltr', textAlign: 'right' }}>
                        {row.code}
                      </td>
                      <td style={styles.cell}>
                        {row.name}
                        {row.warnings.map((warning) => (
                          <span
                            key={warning}
                            style={{
                              display: 'block',
                              ...styles.meta,
                              fontSize: 'var(--t-font-size-xs)',
                            }}
                          >
                            {WARNING_LABELS[warning] ?? warning}
                          </span>
                        ))}
                      </td>
                      <td style={styles.cell}>
                        {row.priceMicros === null
                          ? row.planPrice
                          : `${formatMicrosForDisplay(row.priceMicros)} ${moneyUnitLabel}`}
                      </td>
                      <td style={styles.cell}>
                        {row.suggestedInternalItemName === null
                          ? '—'
                          : row.suggestedInternalItemName}
                      </td>
                      <td style={styles.cell}>
                        {row.priceDifferenceMicros === null
                          ? '—'
                          : `${formatMicrosForDisplay(row.priceDifferenceMicros)} ${moneyUnitLabel}`}
                      </td>
                      <td style={styles.cell}>
                        <Badge tone={itemStatusTone(row.decision)}>
                          {ITEM_STATUS_LABELS[row.decision] ??
                            DECISION_LABELS[row.decision] ??
                            row.decision}
                        </Badge>
                        {help === undefined ? null : (
                          <span
                            style={{
                              display: 'block',
                              ...styles.meta,
                              fontSize: 'var(--t-font-size-xs)',
                            }}
                          >
                            {help}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visibleRows.length === 0 ? (
            <EmptyState
              title={
                rowFilter === 'ALL'
                  ? submittedSearch === ''
                    ? 'کالایی در نرم‌افزار حسابداری نیست'
                    : `کالایی با «${submittedSearch}» پیدا نشد`
                  : 'کالایی با این فیلتر در این صفحه نیست'
              }
              description={
                rowFilter === 'ALL'
                  ? 'جست‌وجو را پاک کنید یا در بخش «اتصال‌ها» وضعیت اتصال را بررسی کنید.'
                  : 'فیلتر را روی «همه» بگذارید تا بقیهٔ کالاهای این صفحه دیده شوند.'
              }
              action={
                <SecondaryButton
                  label={rowFilter === 'ALL' ? 'پاک کردن جست‌وجو' : 'نمایش همهٔ این صفحه'}
                  onClick={() => {
                    if (rowFilter === 'ALL') {
                      applySearch('');
                      return;
                    }
                    setRowFilter('ALL');
                  }}
                />
              }
            />
          ) : null}

          <Pager
            pageNumber={pageIndex + 1}
            totalKnown={page.totalKnown}
            hasNextPage={page.hasNextPage}
            hasPreviousPage={pageIndex > 0}
            busy={loading}
            rowCount={page.rows.length}
            onNext={() => {
              if (page.nextCursor === null) {
                return;
              }

              setCursorStack((current) => [...current, page.nextCursor]);
              void loadPage({
                atCursor: page.nextCursor,
                search: submittedSearch,
              });
            }}
            onPrevious={() => {
              const nextStack = cursorStack.slice(0, -1);
              const at = nextStack[nextStack.length - 1] ?? null;

              setCursorStack(nextStack);
              void loadPage({ atCursor: at, search: submittedSearch });
            }}
          />

          {selected.size > 0 ? (
            <div
              style={{
                position: 'sticky',
                bottom: 0,
                background: 'var(--t-background-primary)',
                borderTop: '1px solid var(--t-border-color-light)',
                padding: 'var(--t-spacing-2) 0',
                display: 'flex',
                gap: 'var(--t-spacing-2)',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span style={styles.meta}>
                {`${selected.size.toLocaleString('fa-IR')} مورد انتخاب شده است (در جست‌وجو و صفحه‌های دیگر حفظ می‌شود).`}
              </span>
              <PrimaryButton
                label={applying ? 'در حال ثبت…' : 'ثبت اتصال موارد انتخاب‌شده'}
                onClick={() => void applySelection()}
                disabled={applying || !canManage}
              />
              <SecondaryButton
                label="پاک کردن انتخاب"
                onClick={() => setSelected(new Map())}
                disabled={applying}
              />
            </div>
          ) : null}

          {snapshot === undefined ? null : (
            <Details
              summary={`جزئیات فنی: منبع فهرست، محدودیت${truncated ? ' و ناقص‌بودن' : ''}، وضعیت همگام‌سازی`}
            >
              <LimitNotice
                truncated={truncated}
                taken={
                  snapshot.truncation.kind === 'BOUNDED'
                    ? snapshot.truncation.taken
                    : 0
                }
                limit={
                  snapshot.truncation.kind === 'BOUNDED'
                    ? snapshot.truncation.limit
                    : 0
                }
                declaredTotal={snapshot.truncation.declaredTotal}
                vendorCannotPage={snapshot.vendorPagination === 'NONE'}
                syncStatus={snapshot.syncStatus}
                degradedReason={snapshot.degradedReason}
              />
              <span>
                {snapshot.reused
                  ? `فهرست مقصد از بارگذاری قبلی استفاده شد (${Math.max(
                      1,
                      Math.round(snapshot.ageMs / 60000),
                    )} دقیقه پیش).`
                  : 'فهرست مقصد همین حالا خوانده شد.'}
              </span>
            </Details>
          )}
        </>
      ) : null}
    </div>
  );
};

const SummaryChip = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning' | 'danger';
}) => (
  <div
    style={{
      border: '1px solid var(--t-border-color-light)',
      borderTopWidth: tone === undefined ? '1px' : '3px',
      borderTopColor:
        tone === 'success'
          ? 'var(--t-color-green)'
          : tone === 'warning'
            ? 'var(--t-color-yellow)'
            : tone === 'danger'
              ? 'var(--t-color-red)'
              : 'var(--t-border-color-light)',
      borderRadius: 'var(--t-border-radius-sm)',
      padding: 'var(--t-spacing-2)',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    }}
  >
    <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>{label}</span>
    <span style={{ fontWeight: 'var(--t-font-weight-semi-bold)' }}>
      {value.toLocaleString('fa-IR')}
    </span>
  </div>
);
