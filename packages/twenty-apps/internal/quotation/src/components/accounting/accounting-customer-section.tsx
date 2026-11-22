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
  WARNING_LABELS,
  asRecord,
  readString,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

const PAGE_SIZE = 25;
const CANDIDATE_PAGE_SIZE = 10;

type PartySelection = {
  internalPartyId: string;
  partyType: 'PERSON' | 'COMPANY';
  label: string;
};

const PARTY_HELP: Record<string, string> = {
  NEEDS_CRM_RECORD: 'برای این مشتری هنوز رکورد CRM انتخاب نشده است؛ با دکمهٔ روبه‌رو انتخاب کنید.',
  AMBIGUOUS_CRM_MATCH:
    'چند مشتری CRM با این نام وجود دارد. خودتان یکی را انتخاب کنید تا سند به نام اشتباه ثبت نشود.',
  DUPLICATE_REMOTE_CODE:
    'دو مشتری در حسابداری همین شناسه را دارند؛ تا اصلاح شناسه، اتصال ممکن نیست.',
  LINK_SUGGESTED: 'مشتری مشابهی در CRM پیدا شد؛ با تأیید شما وصل می‌شود.',
  REMOTE_CHANGED: 'اطلاعات این مشتری در حسابداری تغییر کرده است.',
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

// Customers: the destination's list on one side, and an explicit, searched choice from the
// CRM on the other.
//
// No name matching happens here on purpose. A wrong attachment does not show up as a wrong
// label — it shows up as one customer's quotation filed under another customer's tax
// record. The person therefore picks the record, and the CRM search behind the picker is a
// bounded server query, one page at a time.
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
  // Lets the panel name the inner view in the breadcrumb and title; the picker's own state
  // stays here so the list keeps its page, filter and selections while the picker is open.
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
          action: 'preview-parties-page',
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
              'خواندن مشتریان نرم‌افزار حسابداری انجام نشد.',
            ),
          );
          return;
        }

        setPage(parsePartyMappingPage(response.data.page));
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
    setFilter('ALL');
    setSelected(new Map());
    void loadPage({ atCursor: null, search: '' });
  }, [connectionId, loadPage, reloadToken]);

  useEffect(() => {
    onPendingCountChange?.(page?.summary.NEEDS_CRM_RECORD ?? 0);
  }, [onPendingCountChange, page?.summary.NEEDS_CRM_RECORD]);

  const applySearch = (term: string) => {
    setSubmittedSearch(term);
    setFilter('ALL');
    setCursorStack([null]);
    void loadPage({ atCursor: null, search: term });
  };

  const applySelection = async () => {
    if (connectionId === null || selected.size === 0 || applying) {
      return;
    }

    setApplying(true);

    try {
      const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
        action: 'apply-parties',
        connectionId,
        selections: [...selected.entries()].map(([externalPartyId, selection]) => ({
          externalPartyId,
          internalPartyId: selection.internalPartyId,
          partyType: selection.partyType,
        })),
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'ثبت اتصال مشتریان انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      const outcome = asRecord(response.data.outcome);
      const createdLinks =
        typeof outcome?.createdLinks === 'number' ? outcome.createdLinks : 0;

      await enqueueSnackbar({
        message: `ثبت شد: ${createdLinks} اتصال مشتری.`,
        variant: 'success',
      });
      setSelected(new Map());
      setPickerFor(null);
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
    () => (page === null ? [] : page.rows.filter((row) => matchesPartyFilter(row, filter))),
    [page, filter],
  );

  if (connectionId === null) {
    return (
      <EmptyState
        title="ابتدا یک اتصال انتخاب کنید"
        description="مشتریان از نرم‌افزار حسابداری خوانده می‌شوند. در بخش «اتصال‌ها» یک اتصال بسازید یا انتخاب کنید، سپس به اینجا برگردید."
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

  // An inner view replaces the list instead of stacking under it: the reader lands on the
  // picker, not on row 14 of a table scrolled past it, and the bar's back action is the way
  // out. The section stays mounted, so page, filter and selections survive the round trip.
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

  const snapshot = page?.snapshot;

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
              label="جست‌وجو در مشتریان حسابداری"
              value={searchDraft}
              placeholder="نام، کد ملی یا شناسهٔ مشتری"
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
          <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)', alignSelf: 'center' }}>
            {filter === 'ALL'
              ? 'همهٔ مشتریان این صفحه نمایش داده می‌شوند.'
              : 'این فیلتر فقط روی مشتریان همین صفحه اعمال می‌شود.'}
          </span>
        </div>
      ) : null}

      {error !== null ? (
        <InlineAlert tone="danger" title="خواندن مشتریان انجام نشد">
          {error}
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
          title="در حال خواندن مشتریان…"
          description="یک صفحه از نرم‌افزار حسابداری خوانده می‌شود."
        />
      ) : null}

      {page !== null ? (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table
              aria-label="مشتریان نرم‌افزار حسابداری"
              style={{ ...styles.table, minWidth: '680px' }}
            >
              <thead>
                <tr>
                  <th style={styles.cell}>مشتری در حسابداری</th>
                  <th style={styles.cell}>شناسهٔ مقصد</th>
                  <th style={styles.cell}>مشتری CRM</th>
                  <th style={styles.cell}>وضعیت و دلیل</th>
                  <th style={styles.cell}>انتخاب</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const selection = selected.get(row.externalPartyId);
                  const linked =
                    row.decision === 'IN_SYNC' || row.decision === 'REMOTE_CHANGED';
                  const help = PARTY_HELP[row.decision];

                  return (
                    <tr key={row.externalPartyId}>
                      <td style={styles.cell}>
                        {row.fullName}
                        {row.nationalCode === null ? null : (
                          <span
                            style={{
                              display: 'block',
                              ...styles.meta,
                              fontSize: 'var(--t-font-size-xs)',
                            }}
                          >
                            {`کد ملی ${row.nationalCode}`}
                          </span>
                        )}
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
                      <td style={{ ...styles.cell, direction: 'ltr', textAlign: 'right' }}>
                        {row.externalPartyId}
                      </td>
                      <td style={styles.cell}>
                        {selection === undefined
                          ? linked
                            ? 'وصل‌شده'
                            : 'انتخاب نشده'
                          : selection.label}
                      </td>
                      <td style={styles.cell}>
                        <Badge tone={partyStatusTone(row.decision)}>
                          {PARTY_STATUS_LABELS[row.decision] ??
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
                      <td style={styles.cell}>
                        {linked ? (
                          <span style={styles.meta}>—</span>
                        ) : row.decision === 'DUPLICATE_REMOTE_CODE' ? (
                          <span style={styles.meta}>
                            ابتدا شناسهٔ تکراری را در حسابداری اصلاح کنید.
                          </span>
                        ) : (
                          <SecondaryButton
                            label={
                              selection === undefined ? 'انتخاب مشتری CRM' : 'تغییر انتخاب'
                            }
                            disabled={!canManage}
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
                filter === 'ALL'
                  ? submittedSearch === ''
                    ? 'مشتری‌ای در نرم‌افزار حسابداری نیست'
                    : `مشتری‌ای با «${submittedSearch}» پیدا نشد`
                  : 'مشتری‌ای با این فیلتر در این صفحه نیست'
              }
              description={
                filter === 'ALL'
                  ? 'جست‌وجو را پاک کنید یا در بخش «اتصال‌ها» وضعیت اتصال را بررسی کنید.'
                  : 'فیلتر را روی «همه» بگذارید تا بقیهٔ مشتریان این صفحه دیده شوند.'
              }
              action={
                <SecondaryButton
                  label={filter === 'ALL' ? 'پاک کردن جست‌وجو' : 'نمایش همهٔ این صفحه'}
                  onClick={() => {
                    if (filter === 'ALL') {
                      applySearch('');
                      return;
                    }
                    setFilter('ALL');
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
                {`${selected.size.toLocaleString('fa-IR')} مشتری انتخاب شده است (در جست‌وجو و صفحه‌های دیگر حفظ می‌شود).`}
              </span>
              <PrimaryButton
                label={applying ? 'در حال ثبت…' : 'ثبت اتصال مشتریان انتخاب‌شده'}
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
            <Details summary="جزئیات فنی: منبع فهرست، محدودیت و وضعیت همگام‌سازی">
              <LimitNotice
                truncated={snapshot.truncation.kind === 'BOUNDED'}
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
            </Details>
          )}
        </>
      ) : null}
    </div>
  );
};

// The CRM side of the choice: a bounded server search, paged with the cursor the server
// issued. Nothing is preloaded, so a CRM with a million customers answers this as fast as
// one with ten.
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
    [],
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
      <p style={styles.subtitle}>
        شرکت یا شخص موردنظر را در CRM پیدا کنید. نام یا ایمیل او را بنویسید؛ فقط همان چیزی
        که جست‌وجو می‌کنید از CRM خوانده می‌شود.
      </p>

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
        style={{ display: 'flex', gap: 'var(--t-spacing-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}
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
          onClick={() => void search({ term: draft.trim(), atCursor: null, type: partyType })}
          disabled={loading}
        />
      </form>

      {error !== null ? (
        <InlineAlert tone="danger" title="جست‌وجو انجام نشد">
          {error}
        </InlineAlert>
      ) : null}

      {loading && page === null ? (
        <StateBlock state="loading" title="در حال جست‌وجو…" description="یک لحظه صبر کنید." />
      ) : null}

      {page !== null ? (
        page.rows.length === 0 ? (
          <EmptyState
            title="مشتری‌ای پیدا نشد"
            description="بخش «شرکت» یا «شخص» را عوض کنید یا بخشی از نام را جست‌وجو کنید."
          />
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
                  {candidate.detail === null ? null : (
                    <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
                      {` — ${candidate.detail}`}
                    </span>
                  )}
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
