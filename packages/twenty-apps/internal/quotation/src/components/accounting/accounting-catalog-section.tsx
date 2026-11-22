import { useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import {
  ACCOUNTING_IMPORT_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import {
  Badge,
  LimitNotice,
  Pager,
  SearchField,
  SectionHeader,
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

// Products and services: what the destination has, and how it attaches to the CRM catalog.
//
// Everything visible here is ONE page. The list is asked for with a cursor, the search runs
// on the server, and the destination rows are read once into a bounded snapshot whose limit
// is stated on screen. Selections live outside the page, so choosing a row, searching for
// another, and paging do not lose what was already chosen.
export const AccountingCatalogSection = ({
  connectionId,
  canManage,
  moneyUnitLabel,
  onPendingCountChange,
}: {
  connectionId: string | null;
  canManage: boolean;
  moneyUnitLabel: string;
  onPendingCountChange?: (count: number) => void;
}) => {
  const [page, setPage] = useState<ItemMappingPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  // A stack of the cursors that produced each visited page, so "previous" is exact and does
  // not need a reverse cursor the destination does not provide.
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [selected, setSelected] = useState<Map<string, Selection>>(new Map());
  const [applying, setApplying] = useState(false);

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
    void loadPage({ atCursor: null, search: '' });
  }, [connectionId, loadPage]);

  useEffect(() => {
    onPendingCountChange?.(page?.summary.unlinked ?? 0);
  }, [onPendingCountChange, page?.summary.unlinked]);

  const applySearch = (term: string) => {
    setSubmittedSearch(term);
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
      if (
        row.decision === 'IN_SYNC' ||
        row.decision === 'DUPLICATE_REMOTE_CODE'
      ) {
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
        selections: [...selected.entries()].map(
          ([externalItemId, selection]) => ({
            externalItemId,
            ...(selection.internalItemId === null
              ? {}
              : { internalItemId: selection.internalItemId }),
          }),
        ),
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

  if (connectionId === null) {
    return (
      <p style={styles.meta}>
        برای دیدن کالاها و خدمات، ابتدا در بخش «اتصال‌ها» یک اتصال انتخاب کنید.
      </p>
    );
  }

  const snapshot = page?.snapshot;
  const truncated = snapshot?.truncation.kind === 'BOUNDED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
      <SectionHeader
        title="کالاها و خدمات"
        description="فهرست کالاهای نرم‌افزار حسابداری، یک صفحه در هر بار. تطبیق با کالاهای CRM هنگام مرور هر صفحه انجام می‌شود."
        actions={
          <button
            type="button"
            style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
            disabled={loading}
            onClick={() =>
              void loadPage({
                atCursor: null,
                search: submittedSearch,
                refresh: true,
              }).then(() => setCursorStack([null]))
            }
          >
            خواندن دوباره از حسابداری
          </button>
        }
      />

      {snapshot === undefined ? null : (
        <>
          <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
            {snapshot.reused
              ? `فهرست مقصد از بارگذاری قبلی استفاده شد (${Math.max(
                  1,
                  Math.round(snapshot.ageMs / 60000),
                )} دقیقه پیش).`
              : 'فهرست مقصد همین حالا خوانده شد.'}
          </p>
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
        </>
      )}

      {page !== null ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 'var(--t-spacing-2)',
          }}
        >
          <SummaryChip label="وصل‌شده" value={page.summary.linked ?? 0} />
          <SummaryChip label="وصل‌نشده" value={page.summary.unlinked ?? 0} />
          <SummaryChip label="کد تکراری" value={page.summary.blocked ?? 0} />
          <SummaryChip label="نیازمند بررسی" value={page.summary.needsAttention ?? 0} />
        </div>
      ) : null}

      <form
        style={{ display: 'flex', gap: 'var(--t-spacing-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}
        onSubmit={(event) => {
          event.preventDefault();
          applySearch(searchDraft.trim());
        }}
      >
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <SearchField
            label="جست‌وجو در کالاهای حسابداری"
            value={searchDraft}
            placeholder="نام یا کد کالا"
            onChange={setSearchDraft}
          />
        </div>
        <button
          type="submit"
          style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
          disabled={loading}
        >
          جست‌وجو
        </button>
      </form>

      {error !== null ? <p style={styles.error}>{error}</p> : null}
      {loading ? <p style={styles.meta}>در حال خواندن صفحه…</p> : null}

      {page !== null && !loading ? (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...styles.table, minWidth: '720px' }}>
              <thead>
                <tr>
                  <th style={styles.cell}>انتخاب</th>
                  <th style={styles.cell}>کد</th>
                  <th style={styles.cell}>نام در حسابداری</th>
                  <th style={styles.cell}>قیمت حسابداری</th>
                  <th style={styles.cell}>کالای CRM</th>
                  <th style={styles.cell}>تفاوت قیمت</th>
                  <th style={styles.cell}>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => {
                  const checked = selected.has(row.externalItemId);
                  const selectable =
                    row.decision !== 'IN_SYNC' &&
                    row.decision !== 'DUPLICATE_REMOTE_CODE';

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
                      </td>
                    </tr>
                  );
                })}
                {page.rows.length === 0 ? (
                  <tr>
                    <td style={styles.cell} colSpan={7}>
                      {submittedSearch === ''
                        ? 'کالایی در نرم‌افزار حسابداری پیدا نشد.'
                        : `کالایی با «${submittedSearch}» پیدا نشد.`}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

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
              <button
                type="button"
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  ...(applying || !canManage ? styles.buttonDisabled : {}),
                }}
                disabled={applying || !canManage}
                onClick={() => void applySelection()}
              >
                ثبت اتصال موارد انتخاب‌شده
              </button>
              <button
                type="button"
                style={styles.button}
                onClick={() => setSelected(new Map())}
              >
                پاک کردن انتخاب
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

const SummaryChip = ({ label, value }: { label: string; value: number }) => (
  <div
    style={{
      border: '1px solid var(--t-border-color-light)',
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
