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
  PARTY_STATUS_LABELS,
  parsePartyCandidatePage,
  parsePartyMappingPage,
  partyStatusTone,
  type PartyCandidatePage,
  type PartyCandidateRow,
  type PartyMappingPage,
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
}: {
  connectionId: string | null;
  canManage: boolean;
  onPendingCountChange?: (count: number) => void;
}) => {
  const [page, setPage] = useState<PartyMappingPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [selected, setSelected] = useState<Map<string, PartySelection>>(new Map());
  const [applying, setApplying] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

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
    setSelected(new Map());
    void loadPage({ atCursor: null, search: '' });
  }, [connectionId, loadPage]);

  useEffect(() => {
    onPendingCountChange?.(page?.summary.NEEDS_CRM_RECORD ?? 0);
  }, [onPendingCountChange, page?.summary.NEEDS_CRM_RECORD]);

  const applySelection = async () => {
    if (connectionId === null || selected.size === 0 || applying) {
      return;
    }

    setApplying(true);

    try {
      const response = await callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
        action: 'apply-parties',
        connectionId,
        selections: [...selected.entries()].map(
          ([externalPartyId, selection]) => ({
            externalPartyId,
            internalPartyId: selection.internalPartyId,
            partyType: selection.partyType,
          }),
        ),
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

  if (connectionId === null) {
    return (
      <p style={styles.meta}>
        برای دیدن مشتریان، ابتدا در بخش «اتصال‌ها» یک اتصال انتخاب کنید.
      </p>
    );
  }

  const snapshot = page?.snapshot;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
      <SectionHeader
        title="مشتریان"
        description="مشتریان نرم‌افزار حسابداری یک صفحه در هر بار. برای هر مشتری، رکورد متناظر CRM را خودتان انتخاب می‌کنید."
        actions={
          <button
            type="button"
            style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
            disabled={loading}
            onClick={() => {
              setCursorStack([null]);
              void loadPage({
                atCursor: null,
                search: submittedSearch,
                refresh: true,
              });
            }}
          >
            خواندن دوباره از حسابداری
          </button>
        }
      />

      {snapshot === undefined ? null : (
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
      )}

      <form
        style={{ display: 'flex', gap: 'var(--t-spacing-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}
        onSubmit={(event) => {
          event.preventDefault();
          const term = searchDraft.trim();

          setSubmittedSearch(term);
          setCursorStack([null]);
          void loadPage({ atCursor: null, search: term });
        }}
      >
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <SearchField
            label="جست‌وجو در مشتریان حسابداری"
            value={searchDraft}
            placeholder="نام، کد ملی یا شناسهٔ مشتری"
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
            <table style={{ ...styles.table, minWidth: '680px' }}>
              <thead>
                <tr>
                  <th style={styles.cell}>مشتری در حسابداری</th>
                  <th style={styles.cell}>شناسهٔ مقصد</th>
                  <th style={styles.cell}>مشتری CRM</th>
                  <th style={styles.cell}>وضعیت</th>
                  <th style={styles.cell}>انتخاب</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => {
                  const selection = selected.get(row.externalPartyId);
                  const linked =
                    row.decision === 'IN_SYNC' || row.decision === 'REMOTE_CHANGED';

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
                      </td>
                      <td style={styles.cell}>
                        {linked ? (
                          <span style={styles.meta}>—</span>
                        ) : (
                          <button
                            type="button"
                            style={styles.button}
                            disabled={!canManage}
                            onClick={() =>
                              setPickerFor(
                                pickerFor === row.externalPartyId
                                  ? null
                                  : row.externalPartyId,
                              )
                            }
                          >
                            {selection === undefined
                              ? 'انتخاب مشتری CRM'
                              : 'تغییر انتخاب'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {page.rows.length === 0 ? (
                  <tr>
                    <td style={styles.cell} colSpan={5}>
                      {submittedSearch === ''
                        ? 'مشتری‌ای در نرم‌افزار حسابداری پیدا نشد.'
                        : `مشتری‌ای با «${submittedSearch}» پیدا نشد.`}
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

          {pickerFor === null ? null : (
            <CustomerPicker
              onClose={() => setPickerFor(null)}
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
                setPickerFor(null);
              }}
            />
          )}

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
                ثبت اتصال مشتریان انتخاب‌شده
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

// The CRM side of the choice: a bounded server search, paged with the cursor the server
// issued. Nothing is preloaded, so a CRM with a million customers answers this as fast as
// one with ten.
const CustomerPicker = ({
  onPick,
  onClose,
}: {
  onPick: (candidate: PartyCandidateRow, partyType: 'PERSON' | 'COMPANY') => void;
  onClose: () => void;
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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--t-spacing-2)' }}>
        <p style={styles.subtitle}>انتخاب مشتری CRM</p>
        <button type="button" style={styles.button} onClick={onClose}>
          بستن
        </button>
      </div>

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
        <button
          type="submit"
          style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
          disabled={loading}
        >
          جست‌وجو
        </button>
      </form>

      {error !== null ? <p style={styles.error}>{error}</p> : null}
      {loading ? <p style={styles.meta}>در حال جست‌وجو…</p> : null}

      {page !== null && !loading ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
              <button
                type="button"
                style={styles.button}
                onClick={() => onPick(candidate, partyType)}
              >
                انتخاب
              </button>
            </li>
          ))}
          {page.rows.length === 0 ? (
            <li style={styles.meta}>مشتری‌ای با این عبارت پیدا نشد.</li>
          ) : null}
        </ul>
      ) : null}

      {page !== null && page.hasNextPage ? (
        <button
          type="button"
          style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
          disabled={loading}
          onClick={() =>
            void search({
              term: draft.trim(),
              atCursor: page.endCursor,
              type: partyType,
            })
          }
        >
          نمایش موارد بیشتر
        </button>
      ) : null}
    </div>
  );
};
