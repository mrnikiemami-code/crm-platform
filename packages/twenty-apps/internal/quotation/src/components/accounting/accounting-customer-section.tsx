import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  SubViewBar,
} from 'src/components/accounting/accounting-business-ui';
import {
  PARTY_STATUS_LABELS,
  parsePartyCandidatePage,
  parsePartyMappingPage,
  partyStatusTone,
  type PartyCandidatePage,
  type PartyCandidateRow,
  type PartyMappingPage,
  type PartyMappingRow,
} from 'src/components/accounting/accounting-mapping-types';
import {
  DECISION_LABELS,
  asRecord,
  readString,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

const PAGE_SIZE = 25;
const CANDIDATE_PAGE_SIZE = 10;
const APPLY_BATCH_SIZE = 25;
const TRANSFER_ALL_PAGE_CAP = 1000;
const BULK_PAGE_SIZE = 25;

type PartySelection = {
  internalPartyId?: string;
  partyType?: 'PERSON' | 'COMPANY';
  label: string;
  createNew?: boolean;
};

type PartyFilter = 'ALL' | 'NEEDS_PICK' | 'DUPLICATE' | 'LINKED';

const PARTY_FILTERS: { id: PartyFilter; label: string }[] = [
  { id: 'ALL', label: 'همه' },
  { id: 'NEEDS_PICK', label: 'نیازمند انتخاب' },
  { id: 'DUPLICATE', label: 'شناسهٔ تکراری' },
  { id: 'LINKED', label: 'وصل‌شده' },
];

const matchesPartyFilter = (row: PartyMappingRow, filter: PartyFilter): boolean => {
  if (filter === 'ALL') {
    return true;
  }
  if (filter === 'DUPLICATE') {
    return row.decision === 'DUPLICATE_REMOTE_CODE';
  }
  if (filter === 'LINKED') {
    return row.decision === 'IN_SYNC' || row.decision === 'REMOTE_CHANGED';
  }
  return (
    row.decision === 'NEEDS_CRM_RECORD' ||
    row.decision === 'AMBIGUOUS_CRM_MATCH' ||
    row.decision === 'LINK_SUGGESTED'
  );
};

// All valid, unambiguous identities are resolved again on the server. The UI
// sends intent, not a claimed identity match or a request to blindly create.
const isAutoTransferable = (row: PartyMappingRow): boolean =>
  ['LINK_SUGGESTED', 'NEEDS_CRM_RECORD', 'REMOTE_CHANGED'].includes(row.decision) &&
  row.autoEligible === true;

const selectionFromSuggested = (row: PartyMappingRow): PartySelection | null =>
  isAutoTransferable(row) ? { label: row.fullName, createNew: true } : null;

export const AccountingCustomerSection = ({
  connectionId,
  canManage,
  onPendingCountChange,
  onGoToConnections,
  onSubViewChange,
}: {
  connectionId: string | null;
  canManage: boolean;
  onPendingCountChange?: (count: number) => void;
  onGoToConnections?: () => void;
  onSubViewChange?: (label: string | null) => void;
}) => {
  const [page, setPage] = useState<PartyMappingPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [filter, setFilter] = useState<PartyFilter>('ALL');
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [selected, setSelected] = useState<Map<string, PartySelection>>(new Map());
  const [applying, setApplying] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const sizeRef = useRef(PAGE_SIZE);
  const requestId = useRef(0);
  const pageIndex = page?.pageNumber !== undefined ? page.pageNumber - 1 : cursorStack.length - 1;
  const numbered = page?.snapshot.readStrategy === 'REMOTE_UNPAGED' && page.totalKnown !== null && page.snapshot.snapshotId !== '';

  const loadPage = useCallback(
    async ({
      atCursor,
      search,
      refresh = false,
      targetPage,
      snapshotId,
      size = sizeRef.current,
    }: {
      atCursor: string | null;
      search: string;
      refresh?: boolean;
      targetPage?: number;
      snapshotId?: string;
      size?: number;
    }) => {
      if (connectionId === null) {
        return;
      }

      const id = ++requestId.current;
      setLoading(true);
      setError(null);

      try {
        const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
          action: 'preview-parties-page',
          connectionId,
          cursor: atCursor,
          pageSize: size,
          search,
          refresh,
          ...(targetPage === undefined ? {} : { pageNumber: targetPage, snapshotId }),
        });

        if (id !== requestId.current) return;
        if (!response.ok || response.data.success !== true) {
          setError(
            toPersianUiMessage(
              readString(response.data.message),
              'خواندن مشتریان نرم‌افزار حسابداری انجام نشد.',
            ),
          );
          return;
        }

        const result = parsePartyMappingPage(response.data.page);
        sizeRef.current = size;
        setPage(result);
      } catch {
        if (id === requestId.current) setError('ارتباط با سرور برقرار نشد.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [connectionId],
  );

  useEffect(() => {
    setCursorStack([null]);
    setPage(null);
    setSubmittedSearch('');
    setSearchDraft('');
    setFilter('ALL');
    setSelected(new Map());
    void loadPage({ atCursor: null, search: '' });
    return () => { requestId.current++; };
  }, [connectionId, loadPage, reloadToken]);

  useEffect(() => {
    onPendingCountChange?.(page?.summary.NEEDS_CRM_RECORD ?? 0);
  }, [onPendingCountChange, page?.summary.NEEDS_CRM_RECORD]);

  const goToPage = (targetPage: number, size = sizeRef.current) => {
    if (!numbered || !page || loading || applying) return;
    setCursorStack([null]);
    void loadPage({ atCursor: null, search: submittedSearch, targetPage, snapshotId: page.snapshot.snapshotId, size });
  };

  const applySearch = (term: string) => {
    setSubmittedSearch(term);
    setFilter('ALL');
    setCursorStack([null]);
    void loadPage({ atCursor: null, search: term });
  };

  const visibleRows = useMemo(
    () => (page === null ? [] : page.rows.filter((row) => matchesPartyFilter(row, filter))),
    [page, filter],
  );

  const pageSelectable = useMemo(
    () =>
      visibleRows.filter(
        (row) =>
          selected.has(row.externalPartyId) ||
          isAutoTransferable(row),
      ),
    [visibleRows, selected],
  );

  const allPageSelected = pageSelectable.length > 0 && pageSelectable.every((row) => selected.has(row.externalPartyId));
  const togglePage = () => {
    setSelected((current) => {
      const next = new Map(current);
      for (const row of pageSelectable) {
        if (allPageSelected) next.delete(row.externalPartyId);
        else if (!next.has(row.externalPartyId)) {
          const choice = selectionFromSuggested(row);
          if (choice !== null) next.set(row.externalPartyId, choice);
        }
      }
      return next;
    });
  };

  const toggleRow = (row: PartyMappingRow) => {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(row.externalPartyId)) {
        next.delete(row.externalPartyId);
        return next;
      }
      const suggested = selectionFromSuggested(row);
      if (suggested !== null) {
        next.set(row.externalPartyId, suggested);
        return next;
      }
      // Ambiguous / needs record require an explicit CRM pick first.
      return current;
    });
  };

  const applySelections = async (entries: Map<string, PartySelection>) => {
    if (connectionId === null || entries.size === 0 || applying) {
      return;
    }

    setApplying(true);
    let createdLinks = 0;
    let refused = 0;

    try {
      const all = [...entries.entries()];
      for (let index = 0; index < all.length; index += APPLY_BATCH_SIZE) {
        const batch = all.slice(index, index + APPLY_BATCH_SIZE);
        const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
          action: 'apply-parties',
          connectionId,
          allowRemoteVersionUpdate: true,
          selections: batch.map(([externalPartyId, selection]) => ({
            externalPartyId,
            ...(selection.createNew === true
              ? { createNew: true }
              : {
                  internalPartyId: selection.internalPartyId,
                  partyType: selection.partyType,
                }),
          })),
        });

        if (!response.ok || response.data.success !== true) {
          await enqueueSnackbar({
            message: toPersianUiMessage(
              readString(response.data.message),
              'انتقال مشتریان انجام نشد.',
            ),
            variant: 'error',
          });
          return;
        }

        const outcome = asRecord(response.data.outcome);
        createdLinks +=
          (typeof outcome?.createdLinks === 'number' ? outcome.createdLinks : 0) +
          (typeof outcome?.updatedLinks === 'number' ? outcome.updatedLinks : 0);
        refused += Array.isArray(outcome?.refused) ? outcome.refused.length : 0;
      }

      await enqueueSnackbar({
        message: `موفق: ${createdLinks.toLocaleString('fa-IR')} · ردشده: ${refused.toLocaleString('fa-IR')}`,
        variant: refused > 0 ? 'warning' : 'success',
      });
      setSelected(new Map());
      setPickerFor(null);
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
        `انتقال ${selected.size.toLocaleString('fa-IR')} مشتری انتخاب‌شده انجام شود؟`,
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
      const collected = new Map<string, PartySelection>();
      let atCursor: string | null = null;
      let pages = 0;
      let skipped = 0;
      let completed = false;

      while (pages < TRANSFER_ALL_PAGE_CAP) {
        const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
          action: 'preview-parties-page',
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
              'خواندن فهرست مشتریان برای انتقال همه انجام نشد.',
            ),
            variant: 'error',
          });
          return;
        }

        const mapped = parsePartyMappingPage(response.data.page);
        if (mapped.snapshot.syncStatus !== 'COMPLETE' || mapped.snapshot.degradedReason !== null) {
          await enqueueSnackbar({ message: 'فهرست کامل و تازه نیست؛ انتقال همه متوقف شد.', variant: 'error' }); return;
        }
        for (const row of mapped.rows) {
          const suggested = selectionFromSuggested(row);
          if (suggested !== null) {
            collected.set(row.externalPartyId, suggested);
          } else if (
            row.decision === 'NEEDS_CRM_RECORD' ||
            row.decision === 'AMBIGUOUS_CRM_MATCH' ||
            row.decision === 'DUPLICATE_REMOTE_CODE'
          ) {
            skipped += 1;
          }
        }

        pages += 1;
        if (!mapped.hasNextPage) {
          completed = true;
          break;
        }
        if (mapped.nextCursor === null || mapped.nextCursor === atCursor) break;
        atCursor = mapped.nextCursor;
      }

      if (!completed) {
        await enqueueSnackbar({ message: 'فهرست کامل خوانده نشد؛ انتقال همه انجام نشد.', variant: 'error' });
        return;
      }
      if (collected.size === 0) {
        await enqueueSnackbar({
          message:
            skipped > 0
              ? 'موارد باقی‌مانده نیازمند بررسی هویت هستند.'
              : 'مشتری واجد شرایطی برای انتقال نیست.',
          variant: 'info',
        });
        return;
      }

      if (
        !window.confirm(
          `انتقال همه: ${collected.size.toLocaleString('fa-IR')} مشتری واجد شرایط. موارد نیازمند بررسی دستی: ${skipped.toLocaleString('fa-IR')}. ادامه؟`,
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
        description="برای انتقال مشتری، ابتدا یک اتصال پیش‌فرض فعال در بخش اتصال‌ها تنظیم کنید."
        action={
          onGoToConnections === undefined ? undefined : (
            <PrimaryButton label="رفتن به اتصال‌ها" onClick={onGoToConnections} />
          )
        }
      />
    );
  }

  const openPicker = (externalPartyId: string) => {
    setPickerFor(externalPartyId);
    onSubViewChange?.('انتخاب مشتری CRM');
  };
  const closePicker = () => {
    setPickerFor(null);
    onSubViewChange?.(null);
  };

  if (pickerFor !== null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
        <SubViewBar
          label="انتخاب مشتری CRM"
          backLabel="بازگشت به فهرست مشتریان"
          onBack={closePicker}
        />
        <CustomerPicker
          connectionId={connectionId}
          onPick={(candidate, partyType) => {
            setSelected((current) => {
              const next = new Map(current);
              next.set(pickerFor, {
                internalPartyId: candidate.id,
                partyType,
                label: candidate.label,
              });
              return next;
            });
            closePicker();
          }}
        />
      </div>
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
              placeholder="نام، کد ملی یا شناسه"
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
          {PARTY_FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={filter === entry.id ? 'true' : 'false'}
              style={{
                ...styles.button,
                ...(filter === entry.id ? styles.buttonPrimary : {}),
              }}
              onClick={() => setFilter(entry.id)}
            >
              {entry.label}
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
        <InlineAlert tone="danger" title="خواندن مشتریان انجام نشد">
          {error}
        </InlineAlert>
      ) : null}

      {loading && page === null ? (
        <StateBlock state="loading" title="در حال خواندن مشتریان…" description="" />
      ) : null}

      {page !== null ? (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table
              aria-label="مشتریان نرم‌افزار حسابداری"
              style={{ ...styles.table, minWidth: '720px' }}
            >
              <thead>
                <tr>
                  <th style={styles.cell}>
                    <input type="checkbox" aria-label="انتخاب مشتریان این صفحه" checked={allPageSelected} disabled={!canManage || applying || pageSelectable.length === 0} onChange={togglePage} />
                  </th>
                  <th style={styles.cell}>شناسه حسابداری</th>
                  <th style={styles.cell}>نام مشتری</th>
                  <th style={styles.cell}>کد ملی یا شناسه ملی</th>
                  <th style={styles.cell}>مشتری CRM</th>
                  <th style={styles.cell}>وضعیت</th>
                  <th style={styles.cell}>عملیات نگاشت</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const selection = selected.get(row.externalPartyId);
                  const linked =
                    row.decision === 'IN_SYNC' || row.decision === 'REMOTE_CHANGED';
                  const deletedCustomer = row.warnings.includes('CRM_CUSTOMER_DELETED');
                  const canCheck = !deletedCustomer && (isAutoTransferable(row) || selection !== undefined);

                  return (
                    <tr key={row.externalPartyId}>
                      <td style={styles.cell}>
                        <input
                          type="checkbox"
                          checked={selection !== undefined}
                          disabled={!canManage || applying || !canCheck}
                          aria-label={`انتخاب ${row.fullName}`}
                          onChange={() => toggleRow(row)}
                        />
                      </td>
                      <td style={{ ...styles.cell, direction: 'ltr', textAlign: 'right' }}>
                        {row.externalPartyId}
                      </td>
                      <td style={styles.cell}>{row.fullName}</td>
                      <td style={styles.cell}>
                        {row.nationalCode === null ? '—' : row.nationalCode}
                      </td>
                      <td style={styles.cell}>
                        {selection === undefined
                          ? linked
                            ? 'وصل‌شده'
                            : '—'
                          : selection.label}
                      </td>
                      <td style={styles.cell}>
                        <Badge tone={deletedCustomer ? 'warning' : partyStatusTone(row.decision)}>
                          {deletedCustomer ? 'مشتری حذف‌شده؛ بررسی در CRM' : (PARTY_STATUS_LABELS[row.decision] ??
                            DECISION_LABELS[row.decision] ??
                            row.decision)}
                        </Badge>
                      </td>
                      <td style={styles.cell}>
                        {deletedCustomer || linked || isAutoTransferable(row) ? (
                          '—'
                        ) : row.decision === 'DUPLICATE_REMOTE_CODE' ? (
                          '—'
                        ) : (
                          <SecondaryButton
                            label={
                              selection === undefined ? 'انتخاب CRM' : 'تغییر'
                            }
                            disabled={!canManage || applying}
                            onClick={() => openPicker(row.externalPartyId)}
                          />
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
                submittedSearch === ''
                  ? 'مشتری‌ای برای نمایش نیست'
                  : `مشتری‌ای با «${submittedSearch}» پیدا نشد`
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
            pageSize={numbered ? sizeRef.current : undefined}
            onPageChange={numbered ? goToPage : undefined}
            onPageSizeChange={numbered ? (size) => goToPage(1, size) : undefined}
            onNext={() => {
              if (numbered) { goToPage(pageIndex + 2); return; }
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
              if (numbered) { goToPage(pageIndex); return; }
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

const CustomerPicker = ({
  connectionId,
  onPick,
}: {
  connectionId: string;
  onPick: (candidate: PartyCandidateRow, partyType: 'PERSON' | 'COMPANY') => void;
}) => {
  const [partyType, setPartyType] = useState<'PERSON' | 'COMPANY'>('COMPANY');
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState<PartyCandidatePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async ({
      term,
      atCursor,
      type,
    }: {
      term: string;
      atCursor: string | null;
      type: 'PERSON' | 'COMPANY';
    }) => {
      setLoading(true);
      setError(null);

      try {
        const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
          action: 'search-party-candidates',
          connectionId,
          partyType: type,
          search: term,
          cursor: atCursor,
          pageSize: CANDIDATE_PAGE_SIZE,
        });

        if (!response.ok || response.data.success !== true) {
          setError(
            toPersianUiMessage(
              readString(response.data.message),
              'جست‌وجوی مشتریان CRM انجام نشد.',
            ),
          );
          return;
        }

        setPage(parsePartyCandidatePage(response.data.candidates));
      } catch {
        setError('ارتباط با سرور برقرار نشد.');
      } finally {
        setLoading(false);
      }
    },
    [connectionId],
  );

  useEffect(() => {
    void search({ term: '', atCursor: null, type: partyType });
  }, [partyType, search]);

  return (
    <div
      style={{
        border: '1px solid var(--t-border-color-medium)',
        borderRadius: 'var(--t-border-radius-sm)',
        padding: 'var(--t-spacing-3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--t-spacing-2)',
        background: 'var(--t-background-secondary)',
      }}
    >
      <div style={styles.row}>
        <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="radio"
            checked={partyType === 'COMPANY'}
            onChange={() => setPartyType('COMPANY')}
          />
          شرکت
        </label>
        <label style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="radio"
            checked={partyType === 'PERSON'}
            onChange={() => setPartyType('PERSON')}
          />
          شخص
        </label>
      </div>

      <form
        style={{
          display: 'flex',
          gap: 'var(--t-spacing-2)',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}
        onSubmit={(event) => {
          event.preventDefault();
          void search({ term: draft.trim(), atCursor: null, type: partyType });
        }}
      >
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <SearchField
            label="جست‌وجو در مشتریان CRM"
            value={draft}
            placeholder="نام شرکت، نام شخص یا ایمیل"
            onChange={setDraft}
          />
        </div>
        <SecondaryButton
          label="جست‌وجو"
          onClick={() =>
            void search({ term: draft.trim(), atCursor: null, type: partyType })
          }
          disabled={loading}
        />
      </form>

      {error !== null ? (
        <InlineAlert tone="danger" title="جست‌وجو انجام نشد">
          {error}
        </InlineAlert>
      ) : null}

      {loading && page === null ? (
        <StateBlock state="loading" title="در حال جست‌وجو…" description="" />
      ) : null}

      {page !== null ? (
        page.rows.length === 0 ? (
          <EmptyState title="مشتری‌ای پیدا نشد" description="" />
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {page.rows.map((candidate) => (
              <li
                key={candidate.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 'var(--t-spacing-2)',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--t-border-color-light)',
                  paddingBottom: '4px',
                }}
              >
                <span style={{ fontSize: 'var(--t-font-size-sm)' }}>
                  {candidate.label}
                </span>
                <PrimaryButton
                  label="انتخاب"
                  onClick={() => onPick(candidate, partyType)}
                />
              </li>
            ))}
          </ul>
        )
      ) : null}

      {page !== null && page.hasNextPage ? (
        <SecondaryButton
          label="نمایش موارد بیشتر"
          disabled={loading}
          onClick={() =>
            void search({
              term: draft.trim(),
              atCursor: page.endCursor,
              type: partyType,
            })
          }
        />
      ) : null}
    </div>
  );
};
