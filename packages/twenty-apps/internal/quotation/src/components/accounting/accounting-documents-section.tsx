import { NativeSettingsTable, NativeSettingsHead, NativeSettingsBody, NativeSettingsRow, NativeSettingsHeader, NativeSettingsCell } from 'src/components/shared/native-settings-table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';
import { confirmAccountingAction } from 'src/components/accounting/confirm-accounting-action';

import {
  ACCOUNTING_OUTBOUND_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import {
  Badge,
  Pager,
  EmptyState,
  InlineAlert,
  PrimaryButton,
  SearchField,
  SecondaryButton,
  StateBlock,
} from 'src/components/accounting/accounting-business-ui';
import {
  type ConnectionRecord,
  type OperationRow,
  OPERATION_STATE_LABELS,
  OperationTable,
  asRecord,
  readString,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';
import { formatExactAmountWithCurrency } from 'src/domain/money/display-format';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

type QueueTab = 'PENDING' | 'SENT';

type ExportableRow = {
  quotationId: string;
  quotationNumber: string;
  status: string;
  customerName: string;
  issuedAt: string | null;
  totalExact: string | null;
  sendState: 'PENDING' | 'SENT' | 'IN_FLIGHT' | 'FAILED';
  lastErrorCode: string | null;
  externalDocumentId: string | null;
};

const SEND_STATE_LABELS: Record<ExportableRow['sendState'], string> = {
  PENDING: 'در انتظار ارسال',
  SENT: 'ارسال‌شده',
  IN_FLIGHT: 'در حال ارسال',
  FAILED: 'ناموفق',
};

const parseExportableRows = (value: unknown): ExportableRow[] => {
  const page = asRecord(value);
  const rows = Array.isArray(page?.rows) ? page.rows : [];
  return rows.flatMap((entry) => {
    const row = asRecord(entry);
    if (row === null) {
      return [];
    }
    const quotationId = readString(row.quotationId);
    if (quotationId === '') {
      return [];
    }
    const sendStateRaw = readString(row.sendState);
    const sendState: ExportableRow['sendState'] =
      sendStateRaw === 'SENT' ||
      sendStateRaw === 'IN_FLIGHT' ||
      sendStateRaw === 'FAILED'
        ? sendStateRaw
        : 'PENDING';
    return [
      {
        quotationId,
        quotationNumber: readString(row.quotationNumber) || quotationId.slice(0, 8),
        status: readString(row.status),
        customerName: readString(row.customerName) || '—',
        issuedAt: readString(row.issuedAt) || null,
        totalExact: readString(row.totalExact) || null,
        sendState,
        lastErrorCode: readString(row.lastErrorCode) || null,
        externalDocumentId: readString(row.externalDocumentId) || null,
      },
    ];
  });
};

const formatIssuedAt = (iso: string | null): string => {
  if (iso === null || iso.trim() === '') {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return iso.slice(0, 10);
  }
};

export const AccountingDocumentsSection = ({
  connection,
  operations,
  busy,
  canManage,
  outboundEnabled,
  documentExportEnabled,
  metadataVerified,
  onReload,
  onGoToConnections,
}: {
  connection: ConnectionRecord | null;
  operations: OperationRow[];
  busy: boolean;
  canManage: boolean;
  outboundEnabled: boolean;
  documentExportEnabled: boolean;
  metadataVerified?: boolean;
  taxMappingCount: number;
  taxHandling: string;
  onReload: () => void;
  onGoToConnections?: () => void;
  onGoToCatalog?: () => void;
  onFixMoney?: () => void;
  onFixTax?: () => void;
  onTestConnection?: () => void;
}) => {
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [tab, setTab] = useState<QueueTab>('PENDING');
  const [rows, setRows] = useState<ExportableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [inFlightIds, setInFlightIds] = useState<Set<string>>(new Set());

  const connectionId = connection?.id ?? null;
  const outboundDisabled = metadataVerified === false || !outboundEnabled || !documentExportEnabled;

  const loadQueue = useCallback(async () => {
    if (connectionId === null) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const collected = new Map<string, ExportableRow>();
      const seen = new Set<string>();
      let cursor: string | null = null;
      for (;;) {
        const response = await callAppRoute(ACCOUNTING_OUTBOUND_ROUTE, {
          action: 'list-exportable-quotations', connectionId, cursor, pageSize: 50,
        });
        if (!response.ok || response.data.success !== true) {
          setRows([]);
          setError(toPersianUiMessage(readString(response.data.message), 'خواندن صف اسناد انجام نشد.'));
          return;
        }
        const page = asRecord(response.data.page);
        if (!Array.isArray(page?.rows)) throw new Error('Invalid document queue');
        for (const row of parseExportableRows(page)) collected.set(row.quotationId, row);
        if (page?.hasNextPage !== true) break;
        const next = readString(page.nextCursor);
        if (!next || seen.has(next) || seen.size >= 1000) throw new Error('Incomplete document queue');
        seen.add(next); cursor = next;
      }
      setRows([...collected.values()]);
    } catch {
      setRows([]);
      setError('خواندن کامل صف اسناد انجام نشد.');
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    setSelected(new Set());
    void loadQueue();
  }, [loadQueue, reloadToken]);

  const visibleRows = useMemo(() => {
    const needle = submittedSearch.trim();
    return rows.filter((row) => {
      if (tab === 'PENDING') {
        if (row.sendState === 'SENT') {
          return false;
        }
      } else if (row.sendState !== 'SENT') {
        return false;
      }
      if (needle === '') {
        return true;
      }
      const haystack = `${row.quotationNumber} ${row.customerName}`.toLowerCase();
      return haystack.includes(needle.toLowerCase());
    });
  }, [rows, tab, submittedSearch]);

  const currentPage = Math.min(pageNumber, Math.max(1, Math.ceil(visibleRows.length / pageSize)));
  const pageRows = useMemo(() => visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize), [visibleRows, currentPage, pageSize]);
  useEffect(() => { setPageNumber(1); }, [connectionId, tab, submittedSearch, reloadToken]);

  const selectableRows = useMemo(
    () =>
      pageRows.filter(
        (row) =>
          row.sendState === 'PENDING' || row.sendState === 'FAILED',
      ),
    [pageRows],
  );

  const allSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => selected.has(row.quotationId));

  const togglePage = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const row of selectableRows) {
          next.delete(row.quotationId);
        }
        return next;
      }
      for (const row of selectableRows) {
        next.add(row.quotationId);
      }
      return next;
    });
  };

  const sendQuotations = async (quotationIds: string[]) => {
    if (connectionId === null || quotationIds.length === 0 || sending || outboundDisabled || !canManage) {
      return;
    }

    setSending(true);
    let succeeded = 0;
    let failed = 0;
    let rejected = 0;

    try {
      for (const quotationId of quotationIds) {
        if (inFlightIds.has(quotationId)) {
          rejected += 1;
          continue;
        }

        setInFlightIds((current) => new Set(current).add(quotationId));

        try {
          const response = await callAppRoute(ACCOUNTING_OUTBOUND_ROUTE, {
            action: 'execute-quotation-export',
            connectionId,
            quotationId,
          });

          if (!response.ok || response.data.success !== true) {
            const code = readString(response.data.code);
            if (code === 'ALREADY_SUCCEEDED' || code === 'OPERATION_IN_PROGRESS') {
              rejected += 1;
            } else {
              failed += 1;
            }
            continue;
          }
          succeeded += 1;
        } catch {
          failed += 1;
        }
      }

      await enqueueSnackbar({
        message: `موفق: ${succeeded.toLocaleString('fa-IR')} · ناموفق: ${failed.toLocaleString('fa-IR')} · ردشده: ${rejected.toLocaleString('fa-IR')}`,
        variant:
          succeeded === 0 && failed + rejected > 0 ? 'warning' : 'success',
      });
      setSelected(new Set());
      setReloadToken((token) => token + 1);
      onReload();
    } finally {
      setSending(false);
      setInFlightIds(new Set());
    }
  };

  const sendSelected = async () => {
    if (selected.size === 0) {
      return;
    }
    const confirmedSelection = [...selected];
    if (
      !await confirmAccountingAction(
        `ارسال ${selected.size.toLocaleString('fa-IR')} سند انتخاب‌شده انجام شود؟`,
      )
    ) {
      return;
    }
    void sendQuotations(confirmedSelection);
  };

  const sendAllPending = async () => {
    const ids = rows
      .filter((row) => row.sendState === 'PENDING' || row.sendState === 'FAILED')
      .map((row) => row.quotationId);
    if (ids.length === 0) {
      void enqueueSnackbar({
        message: 'سندی برای ارسال در صف نیست.',
        variant: 'info',
      });
      return;
    }
    if (
      !await confirmAccountingAction(
        `ارسال همه: ${ids.length.toLocaleString('fa-IR')} سند. ادامه؟`,
      )
    ) {
      return;
    }
    void sendQuotations(ids);
  };

  if (connectionId === null) {
    return (
      <EmptyState
        title="اتصال پیش‌فرض معتبر نیست"
        description="برای ارسال اسناد، ابتدا یک اتصال پیش‌فرض فعال تنظیم کنید."
        action={
          onGoToConnections === undefined ? undefined : (
            <PrimaryButton label="رفتن به اتصال‌ها" onClick={onGoToConnections} />
          )
        }
      />
    );
  }

  return (
    <div className="acct-list-section" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
      {outboundDisabled ? (
        <InlineAlert tone="info">
          ارسال اسناد به حسابداری غیرفعال است.
        </InlineAlert>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {(
          [
            { id: 'PENDING' as const, label: 'در انتظار ارسال' },
            { id: 'SENT' as const, label: 'ارسال‌شده‌ها' },
          ] as const
        ).map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={tab === entry.id ? 'true' : 'false'}
            style={{
              ...styles.button,
              ...(tab === entry.id ? styles.buttonPrimary : {}),
            }}
            onClick={() => {
              setTab(entry.id);
              setSelected(new Set());
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

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
            setSubmittedSearch(searchDraft.trim());
          }}
        >
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <SearchField
              label="جست‌وجو"
              value={searchDraft}
              placeholder="شماره یا مشتری"
              onChange={setSearchDraft}
            />
          </div>
          <SecondaryButton
            label="جست‌وجو"
            onClick={() => setSubmittedSearch(searchDraft.trim())}
            disabled={loading || sending}
          />
        </form>
        <SecondaryButton
          label={loading || busy ? 'در حال خواندن…' : 'بازخوانی'}
          onClick={() => {
            setReloadToken((token) => token + 1);
            onReload();
          }}
          disabled={loading || sending || busy}
        />
      </div>
      <div role="group" aria-label="عملیات گروهی" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--t-spacing-2)' }}>
        {tab === 'PENDING' && selected.size === 0 ? (
          <SecondaryButton
            label={sending ? 'در حال ارسال…' : 'ارسال همه'}
            onClick={sendAllPending}
            disabled={!canManage || sending || loading || outboundDisabled}
          />
        ) : null}
        {tab === 'PENDING' && selected.size > 0 ? (
          <PrimaryButton
            label={
              sending
                ? 'در حال ارسال…'
                : `ارسال انتخاب‌شده‌ها (${selected.size.toLocaleString('fa-IR')})`
            }
            onClick={sendSelected}
            disabled={!canManage || sending || outboundDisabled}
          />
        ) : null}
      </div>

      {error !== null ? (
        <InlineAlert tone="danger" title="خواندن صف اسناد انجام نشد">
          {error}
        </InlineAlert>
      ) : null}

      {loading && rows.length === 0 ? (
        <StateBlock state="loading" title="در حال خواندن صف اسناد…" description="" />
      ) : null}

      <div className="acct-table-scroll" key={`${currentPage}:${pageSize}:${tab}:${submittedSearch}`}>
        <NativeSettingsTable columns="40px minmax(100px, 1fr) minmax(100px, 1fr) minmax(130px, 1.3fr) minmax(110px, 1fr) minmax(120px, 1fr) minmax(100px, 1fr)"
          aria-label="صف اسناد حسابداری"
          style={{ ...styles.table, minWidth: '760px' }}
        >
          <NativeSettingsHead>
            <NativeSettingsRow>
              <NativeSettingsHeader style={styles.cell}>
                {tab === 'PENDING' ? (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={
                      !canManage || selectableRows.length === 0 || sending || outboundDisabled
                    }
                    aria-label="انتخاب همه اسناد مجاز این صفحه"
                    onChange={togglePage}
                  />
                ) : null}
              </NativeSettingsHeader>
              <NativeSettingsHeader style={styles.cell}>شماره پیش‌فاکتور</NativeSettingsHeader>
              <NativeSettingsHeader style={styles.cell}>تاریخ صدور</NativeSettingsHeader>
              <NativeSettingsHeader style={styles.cell}>مشتری</NativeSettingsHeader>
              <NativeSettingsHeader style={styles.cell}>مبلغ کل</NativeSettingsHeader>
              <NativeSettingsHeader style={styles.cell}>وضعیت ارسال</NativeSettingsHeader>
              <NativeSettingsHeader style={styles.cell}>عملیات</NativeSettingsHeader>
            </NativeSettingsRow>
          </NativeSettingsHead>
          <NativeSettingsBody>
            {pageRows.map((row) => {
              const checked = selected.has(row.quotationId);
              const canSend =
                row.sendState === 'PENDING' || row.sendState === 'FAILED';
              const amount =
                row.totalExact === null
                  ? '—'
                  : formatExactAmountWithCurrency(row.totalExact, 'IRR');

              return (
                <NativeSettingsRow key={row.quotationId}>
                  <NativeSettingsCell style={styles.cell}>
                    {tab === 'PENDING' ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canManage || !canSend || sending || outboundDisabled}
                        aria-label={`انتخاب ${row.quotationNumber}`}
                        onChange={() => {
                          setSelected((current) => {
                            const next = new Set(current);
                            if (next.has(row.quotationId)) {
                              next.delete(row.quotationId);
                            } else {
                              next.add(row.quotationId);
                            }
                            return next;
                          });
                        }}
                      />
                    ) : null}
                  </NativeSettingsCell>
                  <NativeSettingsCell style={styles.cell}>{row.quotationNumber}</NativeSettingsCell>
                  <NativeSettingsCell style={styles.cell}>{formatIssuedAt(row.issuedAt)}</NativeSettingsCell>
                  <NativeSettingsCell style={styles.cell}>{row.customerName}</NativeSettingsCell>
                  <NativeSettingsCell style={styles.cell}>{amount}</NativeSettingsCell>
                  <NativeSettingsCell style={styles.cell}>
                    <Badge
                      tone={
                        row.sendState === 'SENT'
                          ? 'success'
                          : row.sendState === 'FAILED'
                            ? 'danger'
                            : row.sendState === 'IN_FLIGHT'
                              ? 'warning'
                              : 'info'
                      }
                    >
                      {SEND_STATE_LABELS[row.sendState]}
                    </Badge>
                    {row.lastErrorCode === null ? null : (
                      <span
                        style={{
                          display: 'block',
                          ...styles.meta,
                          fontSize: 'var(--t-font-size-xs)',
                        }}
                      >
                        {row.lastErrorCode}
                      </span>
                    )}
                  </NativeSettingsCell>
                  <NativeSettingsCell style={styles.cell}>
                    {tab === 'PENDING' && canSend ? (
                      <SecondaryButton
                        label="ارسال"
                        disabled={!canManage || sending || outboundDisabled || inFlightIds.has(row.quotationId)}
                        onClick={() => void sendQuotations([row.quotationId])}
                      />
                    ) : row.externalDocumentId !== null ? (
                      <span style={styles.meta}>{row.externalDocumentId}</span>
                    ) : (
                      '—'
                    )}
                  </NativeSettingsCell>
                </NativeSettingsRow>
              );
            })}
          </NativeSettingsBody>
        </NativeSettingsTable>

      {visibleRows.length === 0 && !loading ? (
        <EmptyState
          title={
            tab === 'PENDING'
              ? 'سندی در صف ارسال نیست'
              : 'سند ارسال‌شده‌ای نیست'
          }
          description=""
        />
      ) : null}

      <div style={styles.section}>
        <p style={styles.subtitle}>تاریخچهٔ عملیات</p>
        {operations.length === 0 ? (
          <EmptyState title="هنوز عملیاتی ثبت نشده است" description="" />
        ) : (
          <div style={{ minWidth: 480 }}>
            <OperationTable operations={operations} />
          </div>
        )}
        {operations.some(
          (row) =>
            row.state === 'FAILED_RETRYABLE' ||
            row.state === 'FAILED_FINAL' ||
            row.state === 'MANUAL_EXPORT_REQUIRED',
        ) ? (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {[...new Set(operations.map((row) => row.state))].map((state) => (
              <Badge key={state} tone="warning">
                {`${OPERATION_STATE_LABELS[state] ?? state}`}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      </div>
      <Pager pageNumber={currentPage} totalKnown={visibleRows.length} pageSize={pageSize}
        rowCount={pageRows.length} busy={loading || sending} hasPreviousPage={currentPage > 1}
        hasNextPage={currentPage * pageSize < visibleRows.length} onNext={() => setPageNumber(currentPage + 1)}
        onPrevious={() => setPageNumber(currentPage - 1)} onPageChange={setPageNumber}
        onPageSizeChange={(size) => { setPageSize(size); setPageNumber(1); }} />
    </div>
  );
};
