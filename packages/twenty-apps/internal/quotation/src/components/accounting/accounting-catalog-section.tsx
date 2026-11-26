import { useCallback, useEffect, useMemo, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import {
  ACCOUNTING_IMPORT_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import {
  Badge,
  EmptyState,
  InlineAlert,
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
  asRecord,
  readString,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

const PAGE_SIZE = 25;
const APPLY_BATCH_SIZE = 25;
const TRANSFER_ALL_PAGE_CAP = 1000;
const BULK_PAGE_SIZE = 100;

type Selection = { internalItemId: string | null };

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

const isSelectableItem = (row: ItemMappingRow): boolean =>
  row.decision === 'CREATE' ||
  row.decision === 'LINK_SUGGESTED' ||
  row.decision === 'REMOTE_CHANGED';

const selectionForRow = (row: ItemMappingRow): Selection => ({
  internalItemId: row.suggestedInternalItemId,
});

const formatOutcomeReport = (outcome: Record<string, unknown> | null): string => {
  const createdLinks =
    typeof outcome?.createdLinks === 'number' ? outcome.createdLinks : 0;
  const updatedLinks =
    typeof outcome?.updatedLinks === 'number' ? outcome.updatedLinks : 0;
  const refused = Array.isArray(outcome?.refused) ? outcome.refused.length : 0;
  return `موفق: ${(updatedLinks + createdLinks).toLocaleString('fa-IR')} · ردشده: ${refused.toLocaleString('fa-IR')}`;
};

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
      if (!isSelectableItem(row)) {
        return current;
      }
      next.set(row.externalItemId, selectionForRow(row));
      return next;
    });
  };

  const visibleRows = useMemo(
    () => (page === null ? [] : page.rows.filter((row) => matchesFilter(row, rowFilter))),
    [page, rowFilter],
  );

  const pageSelectable = useMemo(
    () => visibleRows.filter(isSelectableItem),
    [visibleRows],
  );

  const allPageSelected =
    pageSelectable.length > 0 &&
    pageSelectable.every((row) => selected.has(row.externalItemId));

  const togglePageSelection = () => {
    setSelected((current) => {
      const next = new Map(current);
      if (allPageSelected) {
        for (const row of pageSelectable) {
          next.delete(row.externalItemId);
        }
        return next;
      }
      for (const row of pageSelectable) {
        next.set(row.externalItemId, selectionForRow(row));
      }
      return next;
    });
  };

  const applySelections = async (entries: Map<string, Selection>) => {
    if (connectionId === null || entries.size === 0 || applying) {
      return;
    }

    setApplying(true);
    let createdLinks = 0;
    let updatedLinks = 0;
    let refused = 0;

    try {
      const batches: [string, Selection][][] = [];
      const all = [...entries.entries()];
      for (let index = 0; index < all.length; index += APPLY_BATCH_SIZE) {
        batches.push(all.slice(index, index + APPLY_BATCH_SIZE));
      }

      for (const batch of batches) {
        const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
          action: 'apply-items',
          connectionId,
          allowRemoteVersionUpdate: true,
          applyPrices: true,
          selections: batch.map(([externalItemId, selection]) => ({
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
              'انتقال کالاها انجام نشد.',
            ),
            variant: 'error',
          });
          return;
        }

        const outcome = asRecord(response.data.outcome);
        createdLinks +=
          typeof outcome?.createdLinks === 'number' ? outcome.createdLinks : 0;
        updatedLinks +=
          typeof outcome?.updatedLinks === 'number' ? outcome.updatedLinks : 0;
        refused += Array.isArray(outcome?.refused) ? outcome.refused.length : 0;
      }

      await enqueueSnackbar({
        message: formatOutcomeReport({
          createdLinks,
          updatedLinks,
          refused: Array.from({ length: refused }),
        }),
        variant: refused > 0 && createdLinks + updatedLinks === 0 ? 'warning' : 'success',
      });
      setSelected(new Map());
      setCursorStack([null]);
      void loadPage({ atCursor: null, search: submittedSearch, refresh: true });
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setApplying(false);
    }
  };

  const transferSelected = () => {
    if (selected.size === 0) {
      return;
    }
    if (
      !window.confirm(
        `انتقال ${selected.size.toLocaleString('fa-IR')} کالای انتخاب‌شده انجام شود؟`,
      )
    ) {
      return;
    }
    void applySelections(selected);
  };

  const transferAllEligible = async () => {
    if (connectionId === null || applying || !canManage) {
      return;
    }

    setApplying(true);
    try {
      // Transfer-all always ignores the active search and walks the full eligible set.
      const collected = new Map<string, Selection>();
      let atCursor: string | null = null;
      let pages = 0;
      let blocked = 0;
      let completed = false;

      while (pages < TRANSFER_ALL_PAGE_CAP) {
        const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
          action: 'preview-items-page',
          connectionId,
          cursor: atCursor,
          pageSize: BULK_PAGE_SIZE,
          search: '',
          refresh: pages === 0,
        });

        if (!response.ok || response.data.success !== true) {
          await enqueueSnackbar({
            message: toPersianUiMessage(
              readString(response.data.message),
              'خواندن فهرست کالاها برای انتقال همه انجام نشد.',
            ),
            variant: 'error',
          });
          return;
        }

        const mapped = parseItemMappingPage(response.data.page);
        if (mapped.snapshot.syncStatus !== 'COMPLETE' || mapped.snapshot.degradedReason !== null) {
          await enqueueSnackbar({ message: 'فهرست کامل و تازه نیست؛ انتقال همه متوقف شد.', variant: 'error' }); return;
        }
        for (const row of mapped.rows) {
          if (isSelectableItem(row)) {
            collected.set(row.externalItemId, selectionForRow(row));
          } else if (
            row.decision === 'DUPLICATE_REMOTE_CODE' ||
            row.decision === 'LINK_AMBIGUOUS'
          ) {
            blocked += 1;
          }
        }

        pages += 1;
        if (!mapped.hasNextPage) { completed = true; break; }
        if (mapped.nextCursor === null || mapped.nextCursor === atCursor) break;
        atCursor = mapped.nextCursor;
      }

      if (!completed) { await enqueueSnackbar({ message: 'فهرست کامل خوانده نشد؛ انتقال همه انجام نشد.', variant: 'error' }); return; }
      if (collected.size === 0) {
        await enqueueSnackbar({
          message:
            blocked > 0
              ? 'کالای واجد شرایطی برای انتقال نیست؛ موارد دارای تعارض منتقل نمی‌شوند.'
              : 'کالای واجد شرایطی برای انتقال نیست.',
          variant: 'info',
        });
        return;
      }

      if (
        !window.confirm(
          `انتقال همه: ${collected.size.toLocaleString('fa-IR')} کالا (جست‌وجوی فعال نادیده گرفته می‌شود). موارد دارای تعارض: ${blocked.toLocaleString('fa-IR')}. ادامه؟`,
        )
      ) {
        return;
      }

      setApplying(false);
      await applySelections(collected);
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setApplying(false);
    }
  };

  if (connectionId === null) {
    return (
      <EmptyState
        title="اتصال پیش‌فرض معتبر نیست"
        description="برای انتقال کالا، ابتدا یک اتصال پیش‌فرض فعال در بخش اتصال‌ها تنظیم کنید."
        action={
          onGoToConnections === undefined ? undefined : (
            <PrimaryButton label="رفتن به اتصال‌ها" onClick={onGoToConnections} />
          )
        }
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
        }}
      >
        <form
          style={{
            display: 'flex',
            gap: 'var(--t-spacing-2)',
            alignItems: 'flex-end',
            flex: '1 1 240px',
          }}
          onSubmit={(event) => {
            event.preventDefault();
            applySearch(searchDraft.trim());
          }}
        >
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <SearchField
              label="جست‌وجو"
              value={searchDraft}
              placeholder="نام یا کد کالا"
              onChange={setSearchDraft}
            />
          </div>
          <SecondaryButton
            label="جست‌وجو"
            onClick={() => applySearch(searchDraft.trim())}
            disabled={loading || applying}
          />
        </form>

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
        </div>

        <SecondaryButton
          label={loading ? 'در حال خواندن…' : 'بازخوانی'}
          onClick={() => setReloadToken((token) => token + 1)}
          disabled={loading || applying}
        />
      </div>
      <div role="group" aria-label="عملیات گروهی" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--t-spacing-2)' }}>
        {selected.size === 0 ? (
          <PrimaryButton
          label={applying ? 'در حال انتقال…' : 'انتقال همه'}
          onClick={() => void transferAllEligible()}
          disabled={!canManage || applying || loading}
          />
        ) : null}
        {selected.size > 0 ? (
          <PrimaryButton
            label={
              applying
                ? 'در حال انتقال…'
                : `انتقال انتخاب‌شده‌ها (${selected.size.toLocaleString('fa-IR')})`
            }
            onClick={transferSelected}
            disabled={!canManage || applying}
          />
        ) : null}
      </div>

      {error !== null ? (
        <InlineAlert tone="danger" title="خواندن کالاها انجام نشد">
          {error}
        </InlineAlert>
      ) : null}

      {loading && page === null ? (
        <StateBlock state="loading" title="در حال خواندن کالاها…" description="" />
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
                  <th style={styles.cell}>
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      disabled={!canManage || pageSelectable.length === 0 || applying}
                      aria-label="انتخاب همه کالاهای مجاز این صفحه"
                      onChange={togglePageSelection}
                    />
                  </th>
                  <th style={styles.cell}>کد کالا</th>
                  <th style={styles.cell}>نام کالا</th>
                  <th style={styles.cell}>قیمت حسابداری</th>
                  <th style={styles.cell}>کالای CRM</th>
                  <th style={styles.cell}>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const checked = selected.has(row.externalItemId);
                  const selectable = isSelectableItem(row);
                  const priceLabel =
                    row.priceMicros === null
                      ? row.planPrice
                      : `${formatMicrosForDisplay(row.priceMicros)} ${moneyUnitLabel}`;

                  return (
                    <tr key={row.externalItemId}>
                      <td style={styles.cell}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canManage || !selectable || applying}
                          aria-label={`انتخاب ${row.name}`}
                          onChange={() => toggleSelection(row)}
                        />
                      </td>
                      <td style={{ ...styles.cell, direction: 'ltr', textAlign: 'right' }}>
                        {row.code}
                      </td>
                      <td style={styles.cell}>{row.name}</td>
                      <td style={styles.cell}>{priceLabel}</td>
                      <td style={styles.cell}>
                        {row.suggestedInternalItemName === null
                          ? '—'
                          : row.suggestedInternalItemName}
                      </td>
                      <td style={styles.cell}>
                        <Badge tone={itemStatusTone(row.decision)}>
                          {ITEM_STATUS_LABELS[row.decision] ??
                            DECISION_LABELS[row.decision] ??
                            row.decision}
                        </Badge>
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
                submittedSearch === ''
                  ? 'کالایی برای نمایش نیست'
                  : `کالایی با «${submittedSearch}» پیدا نشد`
              }
              description=""
            />
          ) : null}

          <Pager
            pageNumber={pageIndex + 1}
            totalKnown={page.totalKnown}
            hasNextPage={page.hasNextPage}
            hasPreviousPage={pageIndex > 0}
            busy={loading || applying}
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
        </>
      ) : null}
    </div>
  );
};
