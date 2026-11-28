import { NativeSettingsTable, NativeSettingsHead, NativeSettingsBody, NativeSettingsRow, NativeSettingsHeader, NativeSettingsCell } from 'src/components/shared/native-settings-table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';
import { confirmAccountingAction } from 'src/components/accounting/confirm-accounting-action';

import {
  ACCOUNTING_IMPORT_ROUTE,
  QUOTATION_UNITS_ROUTE,
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
import { observeVendorSerials } from 'src/domain/catalog/vendor-stock-observation';
import { resolveSecondaryUnitRatio } from 'src/domain/unit/secondary-unit-ratio';
import { assertCrmUnitCompatibleWithVendorObservation } from 'src/domain/unit/vendor-unit-equivalence';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';
import { isProformaVendorFieldSupported } from 'src/domain/quotation/proforma-commercial-wire';

const PAGE_SIZE = 25;
const APPLY_BATCH_SIZE = 25;
const TRANSFER_ALL_PAGE_CAP = 1000;
const BULK_PAGE_SIZE = 100;

type UnitChoice = { unitRecordId: string; kind: 'PRODUCT' | 'SERVICE' | '' };
type Selection = { internalItemId: string | null; expectedRemoteVersion: string; unitRecordId?: string; kind?: 'PRODUCT' | 'SERVICE' };

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

const selectionForRow = (row: ItemMappingRow, choice?: UnitChoice): Selection => ({
  internalItemId: row.suggestedInternalItemId,
  expectedRemoteVersion: row.remoteVersion ?? '',
  ...(choice?.unitRecordId ? { unitRecordId: choice.unitRecordId } : {}),
  ...(choice?.kind ? { kind: choice.kind } : {}),
});

const vendorUnitObservation = (row: ItemMappingRow) => ({
  vendorUnitId: row.observation?.vendorUnitId ?? null,
  vendorUnitName: row.observation?.vendorUnitName ?? row.vendorUnitName ?? null,
});

const crmUnitCompatible = (
  row: ItemMappingRow,
  units: { id: string; name: string }[],
  choice?: UnitChoice,
): boolean => {
  if (!choice?.unitRecordId) {
    return row.decision !== 'CREATE';
  }

  const crmUnit = units.find((unit) => unit.id === choice.unitRecordId);

  if (!crmUnit) {
    return false;
  }

  return assertCrmUnitCompatibleWithVendorObservation({
    observation: vendorUnitObservation(row),
    crmUnit: { recordId: crmUnit.id, name: crmUnit.name },
  }).ok;
};

const canSelectMappedItem = (
  row: ItemMappingRow,
  units: { id: string; name: string }[],
  choice?: UnitChoice,
) =>
  isSelectableItem(row) &&
  !!row.remoteVersion &&
  (row.decision !== 'CREATE' || (!!choice?.unitRecordId && !!choice.kind)) &&
  crmUnitCompatible(row, units, choice);

const formatObservationSummary = (row: ItemMappingRow): string[] => {
  const bits: string[] = [];
  const observation = row.observation;

  if (!observation) {
    if (row.vendorUnitName) {
      bits.push(`واحد مقصد: ${row.vendorUnitName}`);
    }

    return bits;
  }

  if (observation.vendorUnitName) {
    bits.push(`واحد مقصد: ${observation.vendorUnitName}`);
  }

  const secondary = resolveSecondaryUnitRatio({
    secondaryUnitName: observation.secondaryUnitName,
    unitCount: observation.unitCount,
  });

  if (secondary.ok && secondary.value) {
    bits.push(
      `واحد فرعی: ${secondary.value.secondaryUnitName} (${secondary.value.primaryPerSecondary.toLocaleString('fa-IR')})`,
    );
  } else if ((observation.secondaryUnitName ?? '').trim() !== '') {
    bits.push('واحد فرعی: نسبت تأییدنشده — تبدیل انجام نمی‌شود');
  }

  if (observation.priceUnitsByPosition.length > 0) {
    const tierLabels = observation.priceUnitsByPosition.map((amount, index) =>
      amount === ''
        ? `سطح${(index + 1).toLocaleString('fa-IR')}:نامشخص`
        : `سطح${(index + 1).toLocaleString('fa-IR')}:${amount === '0' ? '۰ (صریح)' : amount}`,
    );
    bits.push(`قیمت‌های سطحی: ${tierLabels.join(' · ')}`);
  }

  if (observation.totalStock !== null) {
    bits.push(
      `موجودی کل: ${observation.totalStock === 0 ? '۰ (صریح)' : observation.totalStock.toLocaleString('fa-IR')}`,
    );
  } else if (observation.stockByPosition.length > 0) {
    bits.push(
      `موجودی موقعیتی: ${observation.stockByPosition
        .map((qty, index) => `P${index + 1}=${qty === 0 ? '۰' : qty}`)
        .join(' · ')} (نام انبار بدون فهرست تأییدشده نسبت داده نمی‌شود)`,
    );
  }

  const serials = observeVendorSerials(observation).serials;

  if (serials.length > 0) {
    bits.push(`سریال مشاهده‌شده: ${serials.join('، ')} (در پیش‌فاکتور ثبت نمی‌شود)`);
  }

  void isProformaVendorFieldSupported('Serial');

  return bits;
};

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
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [unitChoices, setUnitChoices] = useState<Map<string, UnitChoice>>(new Map());
  const [selected, setSelected] = useState<Map<string, Selection>>(new Map());
  const [applying, setApplying] = useState(false);
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
          action: 'preview-items-page',
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
              'خواندن کالاهای نرم‌افزار حسابداری انجام نشد.',
            ),
          );
          return;
        }

        const result = parseItemMappingPage(response.data.page);
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
    setRowFilter('ALL');
    setSelected(new Map());
    void loadPage({ atCursor: null, search: '' });
    return () => { requestId.current++; };
  }, [connectionId, loadPage, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    setUnitChoices(new Map());
    setUnits([]);
    void callAppRoute(QUOTATION_UNITS_ROUTE, { action: 'list' }).then(response => {
      if (cancelled || !response.ok || response.data.success !== true) return;
      const rows = Array.isArray(response.data.units) ? response.data.units : [];
      setUnits(rows.flatMap(raw => {
        const row = asRecord(raw);
        return row?.isActive === true && readString(row.recordId) && readString(row.name)
          ? [{ id: readString(row.recordId), name: readString(row.name) }] : [];
      }));
    }).catch(() => { /* mapping controls stay unavailable */ });
    return () => { cancelled = true; };
  }, [connectionId]);

  const changeUnitChoice = (row: ItemMappingRow, patch: Partial<UnitChoice>) => {
    setUnitChoices(current => {
      const next = new Map(current);
      next.set(row.externalItemId, { unitRecordId: '', kind: '', ...current.get(row.externalItemId), ...patch });
      return next;
    });
    setSelected(current => { const next = new Map(current); next.delete(row.externalItemId); return next; });
  };

  useEffect(() => {
    onPendingCountChange?.(page?.summary.unlinked ?? 0);
  }, [onPendingCountChange, page?.summary.unlinked]);

  const goToPage = (targetPage: number, size = sizeRef.current) => {
    if (!numbered || !page || loading || applying) return;
    setCursorStack([null]);
    void loadPage({ atCursor: null, search: submittedSearch, targetPage, snapshotId: page.snapshot.snapshotId, size });
  };

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
      if (!canSelectMappedItem(row, units, unitChoices.get(row.externalItemId))) {
        return current;
      }
      next.set(row.externalItemId, selectionForRow(row, unitChoices.get(row.externalItemId)));
      return next;
    });
  };

  const visibleRows = useMemo(
    () => (page === null ? [] : page.rows.filter((row) => matchesFilter(row, rowFilter))),
    [page, rowFilter],
  );

  const pageSelectable = useMemo(
    () => visibleRows.filter(row => canSelectMappedItem(row, units, unitChoices.get(row.externalItemId))),
    [visibleRows, unitChoices, units],
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
        next.set(row.externalItemId, selectionForRow(row, unitChoices.get(row.externalItemId)));
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
            expectedRemoteVersion: selection.expectedRemoteVersion,
            ...(selection.unitRecordId ? { unitRecordId: selection.unitRecordId } : {}),
            ...(selection.kind ? { kind: selection.kind } : {}),
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

  const transferSelected = async () => {
    if (selected.size === 0) {
      return;
    }
    const confirmedSelection = new Map(selected);
    if (
      !await confirmAccountingAction(
        `انتقال ${selected.size.toLocaleString('fa-IR')} کالای انتخاب‌شده انجام شود؟`,
      )
    ) {
      return;
    }
    void applySelections(confirmedSelection);
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
          if (canSelectMappedItem(row, units, unitChoices.get(row.externalItemId))) {
            collected.set(row.externalItemId, selectionForRow(row, unitChoices.get(row.externalItemId)));
          } else if (
            row.decision === 'DUPLICATE_REMOTE_CODE' ||
            row.decision === 'LINK_AMBIGUOUS' || row.decision === 'CREATE'
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
        !await confirmAccountingAction(
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
    <div className="acct-list-section" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--t-spacing-3)' }}>
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
          <div className="acct-table-scroll" key={`${page.snapshot.snapshotId}:${pageIndex}:${sizeRef.current}:${submittedSearch}`}>
            <NativeSettingsTable columns="40px minmax(100px, 1fr) minmax(160px, 1.5fr) minmax(110px, 1fr) minmax(140px, 1.3fr) minmax(120px, 1fr)"
              aria-label="کالاهای نرم‌افزار حسابداری"
              style={{ ...styles.table, minWidth: '720px' }}
            >
              <NativeSettingsHead>
                <NativeSettingsRow>
                  <NativeSettingsHeader style={styles.cell}>
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      disabled={!canManage || pageSelectable.length === 0 || applying}
                      aria-label="انتخاب همه کالاهای مجاز این صفحه"
                      onChange={togglePageSelection}
                    />
                  </NativeSettingsHeader>
                  <NativeSettingsHeader style={styles.cell}>کد کالا</NativeSettingsHeader>
                  <NativeSettingsHeader style={styles.cell}>نام کالا</NativeSettingsHeader>
                  <NativeSettingsHeader style={styles.cell}>قیمت حسابداری</NativeSettingsHeader>
                  <NativeSettingsHeader style={styles.cell}>کالای CRM</NativeSettingsHeader>
                  <NativeSettingsHeader style={styles.cell}>وضعیت</NativeSettingsHeader>
                </NativeSettingsRow>
              </NativeSettingsHead>
              <NativeSettingsBody>
                {visibleRows.map((row) => {
                  const checked = selected.has(row.externalItemId);
                  const choice = unitChoices.get(row.externalItemId);
                  const selectable = canSelectMappedItem(row, units, choice);
                  const priceLabel =
                    row.priceMicros === null
                      ? row.planPrice
                      : `${formatMicrosForDisplay(row.priceMicros)} ${moneyUnitLabel}`;
                  const observationBits = formatObservationSummary(row);

                  return (
                    <NativeSettingsRow key={row.externalItemId}>
                      <NativeSettingsCell style={styles.cell}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canManage || !selectable || applying}
                          aria-label={`انتخاب ${row.name}`}
                          onChange={() => toggleSelection(row)}
                        />
                      </NativeSettingsCell>
                      <NativeSettingsCell style={{ ...styles.cell, direction: 'ltr', textAlign: 'right' }}>
                        {row.code}
                      </NativeSettingsCell>
                      <NativeSettingsCell style={styles.cell}>
                        {row.name}
                        {isSelectableItem(row) && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                            <select aria-label={`واحد ${row.name}`} value={choice?.unitRecordId ?? ''} disabled={!canManage || applying}
                              onChange={event => changeUnitChoice(row, { unitRecordId: event.target.value })}>
                              <option value="">واحد مرجع را تعیین کنید</option>
                              {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                            </select>
                            {row.decision === 'CREATE' && <select aria-label={`نوع ${row.name}`} value={choice?.kind ?? ''} disabled={!canManage || applying}
                              onChange={event => changeUnitChoice(row, { kind: event.target.value as UnitChoice['kind'] })}>
                              <option value="">نوع را تعیین کنید</option>
                              <option value="PRODUCT">کالا</option>
                              <option value="SERVICE">خدمت</option>
                            </select>}
                          </div>
                        )}
                        {observationBits.length > 0 ? (
                          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--t-color-text-secondary, #666)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {observationBits.map((bit) => (
                              <span key={bit}>{bit}</span>
                            ))}
                          </div>
                        ) : null}
                        {choice?.unitRecordId &&
                        !crmUnitCompatible(row, units, choice) ? (
                          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--t-color-text-danger, #b42318)' }}>
                            واحد CRM با واحد اصلی مقصد یکی نیست
                          </div>
                        ) : null}
                      </NativeSettingsCell>
                      <NativeSettingsCell style={styles.cell}>{priceLabel}</NativeSettingsCell>
                      <NativeSettingsCell style={styles.cell}>
                        {row.suggestedInternalItemName === null
                          ? '—'
                          : row.suggestedInternalItemName}
                      </NativeSettingsCell>
                      <NativeSettingsCell style={styles.cell}>
                        <Badge tone={itemStatusTone(row.decision)}>
                          {ITEM_STATUS_LABELS[row.decision] ??
                            DECISION_LABELS[row.decision] ??
                            row.decision}
                        </Badge>
                      </NativeSettingsCell>
                    </NativeSettingsRow>
                  );
                })}
              </NativeSettingsBody>
            </NativeSettingsTable>
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

          {rowFilter !== 'ALL' ? <span style={styles.meta}>فیلتر وضعیت فقط روی این صفحه اعمال می‌شود؛ تعداد و صفحه‌بندی بر اساس کل نتیجهٔ جست‌وجو است.</span> : null}
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
