import { useCallback, useEffect, useRef, useState } from 'react';
import { AppPath, enqueueSnackbar, navigate } from 'twenty-sdk/front-component';

import {
  callAccountingConnectionNestAction,
  ACCOUNTING_IMPORT_ROUTE,
  ACCOUNTING_OUTBOUND_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import {
  parseAccountingNestPanel,
  readAccountingNestHealth,
  savedAccountingRecordFromNest,
} from 'src/components/accounting/accounting-nest-response';
import {
  catalogBlocksMappingEdits,
  emptyCatalogState,
  loadCurrencyCatalogFromNest,
  loadTaxCatalogFromNest,
  mergeCurrencyCatalogResult,
  mergeTaxCatalogResult,
  type CatalogReadState,
} from 'src/components/accounting/accounting-catalog-read';
import {
  Badge,
  Breadcrumbs,
  SectionNav,
  StateBlock,
  type SectionDescriptor,
} from 'src/components/accounting/accounting-business-ui';
import { AccountingCatalogSection } from 'src/components/accounting/accounting-catalog-section';
import { AccountingConnectionsSection } from 'src/components/accounting/accounting-connections-section';
import { AccountingCustomerSection } from 'src/components/accounting/accounting-customer-section';
import { AccountingDocumentsSection } from 'src/components/accounting/accounting-documents-section';
import { AccountingOverviewSection } from 'src/components/accounting/accounting-overview-section';
import {
  type ConnectionRecord,
  type FormState,
  type OperationRow,
  type PanelData,
  CONNECTION_HEALTH_LABELS,
  EMPTY_FORM,
  connectionHealthState,
  parseKeyValueLines,
  parseTaxPolicyMappingsText,
  readRows,
  readString,
  resolveAdapterContractAvailability,
  resolveFinancialModes,
  sharedStyles as styles,
  toForm,
  type CurrencyCatalogView,
  type TaxPolicyView,
} from 'src/components/accounting/accounting-shared';
import {
  parseItemMappingPage,
  parsePartyMappingPage,
  type SnapshotView,
} from 'src/components/accounting/accounting-mapping-types';
import { resolveTemporaryWorkingConnectionId } from 'src/domain/accounting/resolve-destination';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

type SectionId = 'overview' | 'connections' | 'catalog' | 'customers' | 'documents';

// The workspace accounting settings page.
//
// The shell owns three things: which connection is active, which section is open, and the
// authority the server granted (`canManage`). Every section stays mounted once visited, so
// a search, a page position or a half-made selection survives a trip to another section;
// the shell deliberately does not re-read a section's data when it comes back into view.
//
// Two kinds of movement exist and both are always available:
//   - between sections, from the rail (bottom bar on a phone), which never scrolls away;
//   - out of an inner view, from the sub-view's own back control, so editing a connection
//     cannot trap someone in a form.

// A connection that never dials out still has to carry an address in its record, because
// the stored shape is shared with adapters that do. `.invalid` is reserved by RFC 2606 and
// can never resolve, so this placeholder cannot become a real request by accident, and the
// form hides the field for such adapters instead of asking for something it will not use.
const MOCK_SERVICE_ADDRESS = 'http://mock.invalid';

const ACCOUNTING_GUIDE_STORAGE_KEY = 'quotation:accounting:section';

// Temporary working context for this browser only — not the workspace default destination.
// Workspace default lives on the server (`isDefault`). This key only remembers which row
// the operator is inspecting for catalog/customers while staying on the page.
const ACCOUNTING_CONNECTION_STORAGE_KEY = 'quotation:accounting:working-connection';

const readStoredConnectionId = (): string | null => {
  try {
    const stored = window.localStorage.getItem(ACCOUNTING_CONNECTION_STORAGE_KEY);

    return stored === null || stored.trim() === '' ? null : stored;
  } catch {
    return null;
  }
};

const SECTION_COPY: Record<SectionId, { label: string; description: string }> = {
  overview: {
    label: 'نمای کلی',
    description: 'وضعیت اتصال، تازگی اطلاعات و کاری که باید انجام دهید.',
  },
  connections: {
    label: 'اتصال‌ها',
    description: 'نرم‌افزار حسابداری‌ای که این فضای کاری با آن کار می‌کند.',
  },
  catalog: {
    label: 'کالاها',
    description: 'کالاهای حسابداری را به کالاهای CRM وصل کنید.',
  },
  customers: {
    label: 'مشتریان',
    description: 'برای هر مشتری حسابداری، مشتری CRM را انتخاب کنید.',
  },
  documents: {
    label: 'اسناد',
    description: 'آمادگی ارسال سند و تاریخچهٔ عملیات.',
  },
};

const SECTION_ORDER: SectionId[] = [
  'overview',
  'connections',
  'catalog',
  'customers',
  'documents',
];

export const AccountingSettingsPanel = () => {
  const [data, setData] = useState<PanelData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<SectionId>('overview');
  const [visited, setVisited] = useState<Set<SectionId>>(new Set<SectionId>(['overview']));
  // Which inner view the connections section shows. The list is the destination the rail
  // points at; the form is one step deeper and always carries a way back to the list.
  const [connectionView, setConnectionView] = useState<'list' | 'form'>('list');
  // The sub-section a deep link asked for («تعیین واحد پول» / «تنظیم مالیات حسابداری»).
  const [connectionFocus, setConnectionFocus] = useState<'money' | 'tax' | null>(null);
  // The selected destination is the state every section reads. Editing it is a different,
  // deliberately separate action; opening the form must not change the selection and
  // selecting must not open the form.
  //
  // Initialized from storage, not written to it, so the remembered destination is present
  // before the first load resolves: an effect that cleared storage while the selection was
  // still null would erase the choice on every reload.
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(
    readStoredConnectionId,
  );
  const [taxCatalog, setTaxCatalog] = useState<CatalogReadState<TaxPolicyView>>(
    emptyCatalogState,
  );
  const [currencyCatalog, setCurrencyCatalog] = useState<
    CatalogReadState<CurrencyCatalogView>
  >(emptyCatalogState);
  // The customers section owns its picker state; it reports the inner view label here so the
  // breadcrumb and title can name it without lifting the picker out of the section.
  const [customerView, setCustomerView] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    healthState: string;
    message: string;
    detail: string;
  } | null>(null);
  const [operations, setOperations] = useState<OperationRow[]>([]);
  const [pendingItems, setPendingItems] = useState(0);
  const [pendingCustomers, setPendingCustomers] = useState(0);
  // The overview promises to say how current the list is, so the same one-row read that
  // produces the counters also brings the snapshot it came from.
  const [snapshot, setSnapshot] = useState<SnapshotView | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const activeConnectionId = selectedConnectionId;

  const loadPanel = useCallback(async () => {
    setLoadError(null);

    try {
      const response = await callAccountingConnectionNestAction(, {
        action: 'list',
      });

      if (!response.ok || response.data.success !== true) {
        setLoadError(
          toPersianUiMessage(
            readString(response.data.message),
            'بارگذاری تنظیمات اتصال حسابداری انجام نشد.',
          ),
        );
        return;
      }

      const parsed = parseAccountingNestPanel(response.data);

      setData(parsed);

      // Temporary working context: remembered id if still present, else workspace default,
      // else null. Never invents a destination from row order.
      setSelectedConnectionId((current) =>
        resolveTemporaryWorkingConnectionId({
          connections: parsed.connections,
          rememberedConnectionId: current ?? readStoredConnectionId(),
        }),
      );

      // The edit draft follows the record it belongs to; a draft that was never saved stays
      // exactly as the person left it.
      setForm((current) => {
        if (current.id !== null) {
          const refreshed = parsed.connections.find(
            (entry) => entry.id === current.id,
          );

          return refreshed === undefined ? current : toForm(refreshed);
        }

        const workingId = resolveTemporaryWorkingConnectionId({
          connections: parsed.connections,
          rememberedConnectionId: readStoredConnectionId(),
        });
        const initial =
          parsed.connections.find((entry) => entry.id === workingId) ?? null;

        return initial === null ? current : toForm(initial);
      });
    } catch {
      setLoadError('تنظیمات اتصال حسابداری از سرور دریافت نشد یا پاسخ آن معتبر نبود. دوباره تلاش کنید.');
    }
  }, []);

  useEffect(() => {
    void loadPanel();
  }, [loadPanel]);

  useEffect(() => {
    try {
      if (selectedConnectionId === null) {
        window.localStorage.removeItem(ACCOUNTING_CONNECTION_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(
        ACCOUNTING_CONNECTION_STORAGE_KEY,
        selectedConnectionId,
      );
    } catch {
      // Storage can be unavailable in a sandboxed host; the selection still works for this
      // visit, it just will not survive a reload.
    }
  }, [selectedConnectionId]);

  // Catalog ownership for mapping rows: Nest list actions only (same as Financial Settings).
  // Independent settled reads so one failure never clears the other or masquerades as empty.
  const reloadCatalogs = useCallback(async () => {
    setTaxCatalog((previous) => ({
      status: 'loading',
      rows: previous.rows,
      stale:
        previous.status === 'ready_nonempty' || previous.status === 'ready_empty',
      errorMessage: null,
    }));
    setCurrencyCatalog((previous) => ({
      status: 'loading',
      rows: previous.rows,
      stale:
        previous.status === 'ready_nonempty' || previous.status === 'ready_empty',
      errorMessage: null,
    }));

    const [taxSettled, currencySettled] = await Promise.allSettled([
      loadTaxCatalogFromNest(),
      loadCurrencyCatalogFromNest(),
    ]);

    setTaxCatalog((previous) => {
      if (taxSettled.status === 'fulfilled') {
        return mergeTaxCatalogResult(previous, taxSettled.value);
      }

      return mergeTaxCatalogResult(previous, {
        ok: false,
        message:
          'فهرست سیاست‌های مالیات از سرور خوانده نشد. نگاشت وابسته تا بازخوانی موفق قفل است.',
      });
    });

    setCurrencyCatalog((previous) => {
      if (currencySettled.status === 'fulfilled') {
        return mergeCurrencyCatalogResult(previous, currencySettled.value);
      }

      return mergeCurrencyCatalogResult(previous, {
        ok: false,
        message:
          'فهرست ارزها از سرور خوانده نشد. نگاشت وابسته تا بازخوانی موفق قفل است.',
      });
    });
  }, []);

  useEffect(() => {
    void reloadCatalogs();
  }, [reloadCatalogs]);

  // The overview is the first screen, so it cannot wait for the catalog and customer panels
  // to be opened before it knows how much work is outstanding. One row is asked for; only
  // the counters are used, and a failure leaves them at zero without blocking the panel.
  useEffect(() => {
    if (activeConnectionId === null) {
      setPendingItems(0);
      setPendingCustomers(0);
      setSnapshot(null);
      return;
    }

    let cancelled = false;

    const loadCounts = async () => {
      const [items, parties] = await Promise.all([
        callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
          action: 'preview-items-page',
          connectionId: activeConnectionId,
          cursor: null,
          pageSize: 1,
          search: '',
        }).catch(() => null),
        callAppRoute(ACCOUNTING_IMPORT_ROUTE, {
          action: 'preview-parties-page',
          connectionId: activeConnectionId,
          cursor: null,
          pageSize: 1,
          search: '',
        }).catch(() => null),
      ]);

      if (cancelled) {
        return;
      }

      if (items !== null && items.data.success === true) {
        const page = parseItemMappingPage(items.data.page);
        setPendingItems(page.summary.unlinked ?? 0);
        setSnapshot(page.snapshot);
      }

      if (parties !== null && parties.data.success === true) {
        const summary = parsePartyMappingPage(parties.data.page).summary;
        setPendingCustomers(summary.NEEDS_CRM_RECORD ?? 0);
      }
    };

    void loadCounts();

    return () => {
      cancelled = true;
    };
  }, [activeConnectionId]);

  const goTo = useCallback(
    (id: SectionId) => {
      setSection(id);
      setVisited((current) => {
        if (current.has(id)) {
          return current;
        }

        const next = new Set(current);
        next.add(id);
        return next;
      });

      // Clicking the section you are already in returns to its list: that is the way out
      // of the connection form without hunting for the back bar. Coming back from another
      // section must not, otherwise an unfinished edit would be thrown away by a detour.
      if (id === 'connections' && section === 'connections') {
        setConnectionView('list');
      }
    },
    [section],
  );

  const backToCrm = useCallback(() => {
    // The panel is one page inside Twenty. Leaving is a real navigation, guarded because a
    // front component can be rendered where the host navigation is unavailable.
    try {
      void navigate(AppPath.Home);
    } catch {
      void enqueueSnackbar({
        message: 'برای بازگشت، از منوی اصلی CRM استفاده کنید.',
        variant: 'info',
      });
    }
  }, []);

  const save = async () => {
    if (busy) {
      return;
    }

    const adapterAvailability = resolveAdapterContractAvailability({
      adapterId: form.adapterId,
      adapters: data?.adapters ?? [],
    });

    if (adapterAvailability.status === 'unavailable') {
      await enqueueSnackbar({
        message:
          'آداپتور انتخاب‌شده در فهرست معتبر سرور نیست؛ ذخیره ممکن نیست و به‌عنوان آزمایشی فرض نمی‌شود.',
        variant: 'error',
      });
      return;
    }

    const selectedAdapter = adapterAvailability.descriptor;
    // isLive is display metadata for whether a service address is required — not authorization.
    const needsServiceAddress = selectedAdapter.isLive === true;
    // Resolved from what the server declared for this adapter/profile, so a row-code block
    // the form is not showing is not silently sent either.
    const savingModes = resolveFinancialModes({
      adapterId: form.adapterId,
      adapters: data?.adapters ?? [],
      financial: {
        baseCurrency: form.baseCurrency,
        currencyMappings: parseKeyValueLines(form.currencyMappingsText),
        conversionRate: form.conversionRate,
        mockProfile: form.mockProfile,
      },
    });
    const fieldsNeedTaxCatalog =
      savingModes.taxHandling !== 'UNSUPPORTED' &&
      savingModes.taxHandling !== null;
    const fieldsNeedCurrencyCatalog =
      savingModes.currencyHandling === 'CURRENCY_CODE' ||
      savingModes.currencyHandling === 'CURRENCY_NAME' ||
      savingModes.currencyHandling === 'CURRENCY_CODE_AND_RATE' ||
      savingModes.currencyHandling === 'SINGLE_CURRENCY';

    if (
      (fieldsNeedTaxCatalog && catalogBlocksMappingEdits(taxCatalog)) ||
      (fieldsNeedCurrencyCatalog && catalogBlocksMappingEdits(currencyCatalog))
    ) {
      await enqueueSnackbar({
        message:
          'کاتالوگ مالیات یا ارز هنوز تأیید نشده است؛ ابتدا بازخوانی کنید، سپس ذخیره کنید.',
        variant: 'warning',
      });
      return;
    }

    setBusy(true);

    try {
      const response = await callAccountingConnectionNestAction(, {
        action: 'save',
        name: form.name,
        adapterId: form.adapterId,
        ...(form.id === null ? {} : { recordId: form.id }),
        settings: {
          baseUrl:
            !needsServiceAddress && form.baseUrl.trim() === ''
              ? MOCK_SERVICE_ADDRESS
              : form.baseUrl,
          remoteUserId: form.remoteUserId,
          defaultStorageId: form.defaultStorageId,
          moneyUnit: form.moneyUnit,
          transportApproved: form.transportApproved,
          specialCodes: {
            discount: form.discount,
            duty: form.duty,
            tax: form.tax,
          },
          taxPolicyMappings: parseTaxPolicyMappingsText(
            form.taxPolicyMappingsText,
          ),
          // The installation's row codes. Sent only when the destination posts non-product
          // amounts as their own rows; a mock has no such rows, and sending them would look
          // like a claim about an installation that does not exist.
          ...(savingModes.requiresSpecialItemCodes
            ? {
                specialItemCodes: {
                  ...(form.specialDiscountCode.trim() === ''
                    ? {}
                    : { discount: form.specialDiscountCode.trim() }),
                  ...(form.specialDutyCode.trim() === ''
                    ? {}
                    : { duty: form.specialDutyCode.trim() }),
                  ...(form.specialTaxCode.trim() === ''
                    ? {}
                    : { tax: form.specialTaxCode.trim() }),
                },
              }
            : {}),
          // Only the destination's own declared contract reads these. Storing them on every
          // connection keeps a switch of test profile from silently erasing what was typed.
          // The mock profile is a statement about capabilities, so it is sent only to the
          // mock: the server refuses it on a live adapter, and a live save must not fail
          // because of a field nobody reads.
          financial: {
            baseCurrency: form.baseCurrency,
            currencyMappings: parseKeyValueLines(form.currencyMappingsText),
            conversionRate: form.conversionRate,
            ...(form.adapterId === 'mock'
              ? { mockProfile: form.mockProfile }
              : {}),
          },
        },
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'ذخیرهٔ تنظیمات اتصال انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      const savedRecord = savedAccountingRecordFromNest(response.data, form.id);
      setForm(toForm(savedRecord));
      // The server identifies the exact created/edited row, including duplicate names.
      // Never select a "last" connection or guess from its position in the list.
      setSelectedConnectionId(savedRecord.id);
      setTestResult(null);
      await enqueueSnackbar({
        message: 'تنظیمات اتصال ذخیره شد؛ اکنون «آزمایش اتصال» را بزنید.',
        variant: 'success',
      });
      await loadPanel();
    } catch {
      await enqueueSnackbar({
        message: 'ذخیره یا تأیید شناسه اتصال انجام نشد؛ دوباره بررسی کنید.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const test = async (targetConnectionId: string | null) => {
    // Testing judges a STORED record: the server dials the address it has, with the settings
    // it has. A brand-new draft has no record to probe, and falling back to whichever
    // connection happens to be selected would report one record's result as another's.
    if (busy) {
      return;
    }

    if (targetConnectionId === null) {
      await enqueueSnackbar({
        message: 'این اتصال ذخیره نشده است؛ ابتدا ذخیره کنید، سپس آزمایش بزنید.',
        variant: 'info',
      });
      return;
    }

    setBusy(true);

    try {
      const response = await callAccountingConnectionNestAction(, {
        action: 'test',
        connectionId: targetConnectionId,
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'آزمایش اتصال انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      const health = readAccountingNestHealth(response.data);
      setTestResult(health);

      await enqueueSnackbar({
        message: health.message,
        variant: health.healthState === 'OK' ? 'success' : 'warning',
      });
      await loadPanel();
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const loadOperations = async () => {
    if (busy || activeConnectionId === null) {
      return;
    }

    setBusy(true);

    try {
      const response = await callAppRoute(ACCOUNTING_OUTBOUND_ROUTE, {
        action: 'operations',
        connectionId: activeConnectionId,
      });

      if (response.ok && response.data.success === true) {
        setOperations(
          readRows(response.data.operations).map(
            (node) => node as unknown as OperationRow,
          ),
        );
      }
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (section !== 'documents' || activeConnectionId === null) {
      return;
    }

    void loadOperations();
    // Deliberately keyed on the connection and the section: re-opening the section is what
    // refreshes the history, not a timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, activeConnectionId]);

  // Entering a section or an inner view starts at its top: the previous scroll position
  // belonged to another screen and would drop the person into the middle of a form.
  useEffect(() => {
    const root = rootRef.current;

    if (root !== null) {
      root.scrollTop = 0;
    }
  }, [section, connectionView]);

  // A new destination starts empty. Saving it is the same authority-checked route as an
  // edit, so "create" is not a second write path.
  const startNewConnection = () => {
    setForm({ ...EMPTY_FORM, name: 'اتصال آزمایشی جدید', adapterId: 'mock' });
    setTestResult(null);
    setOperations([]);
    setConnectionFocus(null);
    goTo('connections');
    setConnectionView('form');
  };

  // Opening the form is an edit; it never changes which destination the workspace uses.
  const editConnection = (entry: ConnectionRecord) => {
    setForm(toForm(entry));
    setTestResult(null);
    setOperations([]);
    setConnectionFocus(null);
    goTo('connections');
    setConnectionView('form');
  };

  // Temporary working context only — does not change the workspace default destination.
  // Retired connections cannot become the working destination.
  const selectConnection = (entry: ConnectionRecord) => {
    if (entry.isActive === false) {
      return;
    }

    setSelectedConnectionId(entry.id);
    setTestResult(null);
  };

  const setWorkspaceDefault = async (entry: ConnectionRecord) => {
    if (busy || !data?.canManage) {
      return;
    }

    setBusy(true);

    try {
      const response = await callAccountingConnectionNestAction(, {
        action: 'set-default',
        connectionId: entry.id,
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'تعیین مقصد پیش‌فرض انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      await enqueueSnackbar({
        message: 'مقصد پیش‌فرض فضای کاری به‌روز شد.',
        variant: 'success',
      });
      await loadPanel();
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const deactivateConnection = async (entry: ConnectionRecord) => {
    if (busy || !data?.canManage) {
      return;
    }

    setBusy(true);

    try {
      const response = await callAccountingConnectionNestAction(, {
        action: 'deactivate',
        connectionId: entry.id,
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'بازنشسته‌کردن اتصال انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      // A retired id must not remain the temporary working destination.
      if (selectedConnectionId === entry.id) {
        setSelectedConnectionId(null);
        try {
          window.localStorage.removeItem(ACCOUNTING_CONNECTION_STORAGE_KEY);
        } catch {
          // Storage may be unavailable; selection state above still clears.
        }
      }

      await enqueueSnackbar({
        message: toPersianUiMessage(
          readString(response.data.message),
          'اتصال بازنشسته شد؛ سوابق حفظ شدند.',
        ),
        variant: 'success',
      });
      await loadPanel();
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const reactivateConnection = async (entry: ConnectionRecord) => {
    if (busy || !data?.canManage) {
      return;
    }

    setBusy(true);

    try {
      const response = await callAccountingConnectionNestAction(, {
        action: 'reactivate',
        connectionId: entry.id,
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'فعال‌سازی مجدد اتصال انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      await enqueueSnackbar({
        message: toPersianUiMessage(
          readString(response.data.message),
          'اتصال دوباره فعال شد؛ پیش‌فرض خودکار تنظیم نشد.',
        ),
        variant: 'success',
      });
      await loadPanel();
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  // Deep links from the documents readiness list: open the SELECTED connection at the exact
  // sub-section that fixes the item, instead of dumping the person somewhere in the panel.
  const openSelectedAt = (focus: 'money' | 'tax') => {
    const target =
      data?.connections.find((entry) => entry.id === selectedConnectionId) ??
      null;

    if (target === null) {
      startNewConnection();
      return;
    }

    setForm(toForm(target));
    setTestResult(null);
    setConnectionFocus(focus);
    goTo('connections');
    setConnectionView('form');
  };

  if (loadError !== null) {
    return (
      <div style={styles.root} dir="rtl">
        <StateBlock
          state="error"
          title="تنظیمات حسابداری خوانده نشد"
          description={loadError}
          action={
            <button
              type="button"
              style={styles.button}
              onClick={() => void loadPanel()}
            >
              تلاش دوباره
            </button>
          }
        />
      </div>
    );
  }

  if (data === null) {
    return (
      <div style={styles.root} dir="rtl">
        <StateBlock
          state="loading"
          title="در حال خواندن تنظیمات حسابداری…"
          description="این کار چند لحظه طول می‌کشد."
        />
      </div>
    );
  }

  const connection =
    data.connections.find((entry) => entry.id === activeConnectionId) ?? null;
  const workspaceDefaultConnection =
    data.connections.find((entry) => entry.isDefault && entry.isActive) ?? null;
  // Every section names the same destination, so the label and the readiness counts come
  // from the SELECTED record, never from an unsaved edit draft.
  const connectionMoneyUnit =
    connection?.settings.moneyUnit ??
    (form.id === null ? form.moneyUnit : 'UNCONFIRMED');
  const moneyUnitLabel =
    connectionMoneyUnit === 'TOMAN'
      ? 'تومان'
      : connectionMoneyUnit === 'RIAL'
        ? 'ریال'
        : '';
  const taxMappingCount = Object.keys(
    connection?.settings.taxPolicyMappings ?? {},
  ).length;
  const connectionHealth =
    connection === null ? null : connectionHealthState(connection);
  const formModes = resolveFinancialModes({
    adapterId: form.adapterId,
    adapters: data.adapters,
    financial: {
      baseCurrency: form.baseCurrency,
      currencyMappings: parseKeyValueLines(form.currencyMappingsText),
      conversionRate: form.conversionRate,
      mockProfile: form.mockProfile,
    },
  });

  const sections: SectionDescriptor[] = SECTION_ORDER.map((id) => ({
    id,
    label: SECTION_COPY[id].label,
    description: SECTION_COPY[id].description,
    ...(id === 'connections' ? { count: data.connections.length } : {}),
    ...(id === 'catalog' && pendingItems > 0 ? { alertCount: pendingItems } : {}),
    ...(id === 'customers' && pendingCustomers > 0
      ? { alertCount: pendingCustomers }
      : {}),
  }));

  const sectionCopy = SECTION_COPY[section];
  const innerViewLabel =
    section === 'connections' && connectionView === 'form'
      ? 'ویرایش اتصال'
      : section === 'customers' && customerView !== null
        ? customerView
        : null;
  const breadcrumbLabel = innerViewLabel ?? sectionCopy.label;

  return (
    <div className="acct-root" ref={rootRef} style={styles.root} dir="rtl">
      {/* Media queries and a visible focus ring are the two things inline styles cannot
          express. Everything else stays inline, next to the markup it belongs to. */}
      <style>{`
        .acct-root { --acct-gap: var(--t-spacing-3); }
        /* Visually hidden, still read: the section change is announced without moving focus
           off the rail button the person just pressed. */
        .acct-sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
        }
        .acct-root :focus-visible {
          outline: 2px solid var(--t-color-blue);
          outline-offset: 2px;
          border-radius: var(--t-border-radius-sm);
        }
        .acct-crumb { min-height: 36px; }
        /* A floor the components can share: 38px for a pointer, 44px for a thumb below.
           Inline min-heights are gone so this rule is the only source of the size. */
        .acct-root button, .acct-root input, .acct-root select { min-height: 38px; }
        .acct-crumb:hover { background: color-mix(in srgb, var(--t-color-blue) 10%, transparent); }
        .acct-body { display: grid; grid-template-columns: 232px minmax(0, 1fr); gap: var(--acct-gap); align-items: start; }
        .acct-rail { position: sticky; top: 0; display: flex; flex-direction: column; gap: var(--acct-gap); }
        .acct-main { min-width: 0; display: flex; flex-direction: column; gap: var(--acct-gap); }
        .acct-mobile-bar { display: none; }
        @media (max-width: 860px) {
          .acct-body { grid-template-columns: minmax(0, 1fr); padding-bottom: 12px; }
          .acct-rail { display: none; }
          .acct-main { order: 1; }
          .acct-root { padding-bottom: 0; }
          .acct-crumb { min-height: 44px; font-size: var(--t-font-size-sm); }
          /* 44px is the thumb floor. Inputs, filters and the details toggle used to come out
             at 24–38px on a phone; the sizes are set here rather than per component so a new
             control cannot be added below the floor. Checkboxes stay a checkbox, just bigger. */
          .acct-root button,
          .acct-root input:not([type="checkbox"]):not([type="radio"]),
          .acct-root select,
          .acct-root summary { min-height: 44px; }
          .acct-root input[type="checkbox"],
          .acct-root input[type="radio"] { width: 20px; height: 20px; }
          /* The panel body is its own scroll container and an ancestor uses
             will-change: transform, which anchors a fixed element to that ancestor rather
             than the viewport. Sticky, as the last child of the scroller, is what actually
             pins the bar to the bottom of the visible area. */
          .acct-mobile-bar {
            display: flex; position: sticky; bottom: 0; z-index: 6;
            margin: 0 calc(-1 * var(--t-spacing-4)); margin-bottom: calc(-1 * var(--t-spacing-4));
            background: var(--t-background-primary);
            border-top: 1px solid var(--t-border-color-medium);
            padding: 4px 6px calc(4px + env(safe-area-inset-bottom));
          }
          .acct-mobile-bar nav { display: flex !important; gap: 2px !important; width: 100%; }
          .acct-mobile-bar nav button {
            flex: 1 1 0; min-width: 0; min-height: 52px;
            flex-direction: column; justify-content: center; text-align: center;
            font-size: 12px; padding: 4px 2px; gap: 2px;
          }
        }
      `}</style>

      {data.metadataVerified === false ? (
        <div role="status" style={{
          border: '1px solid var(--t-border-color-medium)',
          borderRadius: 'var(--t-border-radius-sm)',
          padding: 'var(--t-spacing-2)',
          fontSize: 'var(--t-font-size-sm)',
        }}>
          وضعیت ارسال و تنظیمات امنیتی هنوز از سرور تأیید نشده‌اند؛
          ارسال سند از این صفحه فعال نمی‌شود.
        </div>
      ) : null}
      <header style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* The rail marks aria-current, but a screen reader gets no confirmation that the
            view under it changed: this is that confirmation, and it does not move focus. */}
        <p className="acct-sr-only" role="status" aria-live="polite">
          {`بخش «${breadcrumbLabel}» نمایش داده می‌شود.`}
        </p>
        <Breadcrumbs sectionLabel={breadcrumbLabel} onBackToCrm={backToCrm} />
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--t-spacing-2)',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <h2 style={styles.title}>
              {section === 'connections' && connectionView === 'form'
                ? form.id === null
                  ? 'اتصال جدید'
                  : `ویرایش اتصال: ${form.name}`
                : breadcrumbLabel}
            </h2>
            <p style={styles.meta}>{sectionCopy.description}</p>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge
              tone={workspaceDefaultConnection === null ? 'warning' : 'success'}
            >
              {workspaceDefaultConnection === null
                ? 'نیازمند انتخاب مقصد پیش‌فرض'
                : `پیش‌فرض فضای کاری: ${workspaceDefaultConnection.name}`}
            </Badge>
            <Badge
              tone={
                connectionHealth === null
                  ? 'warning'
                  : connectionHealth === 'LIVE_VERIFIED'
                    ? 'success'
                    : connectionHealth === 'FAILED'
                      ? 'danger'
                      : connectionHealth === 'INCOMPLETE'
                        ? 'warning'
                        : 'neutral'
              }
            >
              {connection === null || connectionHealth === null
                ? 'نمای موقت: اتصالی انتخاب نشده'
                : `نمای موقت: ${connection.name} — ${CONNECTION_HEALTH_LABELS[connectionHealth]}`}
            </Badge>
          </div>
        </div>
      </header>

      <div className="acct-body">
        <aside className="acct-rail" aria-label="ناوبری حسابداری">
          <SectionNav sections={sections} activeId={section} onSelect={(id) => goTo(id as SectionId)} />
          <div
            className="acct-rail-extra"
            style={{
              border: '1px solid var(--t-border-color-light)',
              borderRadius: 'var(--t-border-radius-sm)',
              padding: 'var(--t-spacing-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
              ارسال سند به حسابداری
            </span>
            <span style={{ fontSize: 'var(--t-font-size-sm)' }}>
              {data.metadataVerified === false
                ? 'وضعیت این قابلیت از سرور تأیید نشده است'
                : data.flags.documentExportEnabled
                  ? 'فعال'
                  : 'در این نسخه غیرفعال است'}
            </span>
            <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
              این صفحه هیچ سندی ارسال نمی‌کند.
            </span>
          </div>
        </aside>

        <main className="acct-main">
          {/* display, not the hidden attribute: the host renderer does not forward `hidden`,
              and a mounted-but-visible section would stack all five panels on top of each
              other. The wrappers stay mounted so their state survives a section switch. */}
          <div style={{ display: section === 'overview' ? 'block' : 'none' }}>
            {visited.has('overview') ? (
              <AccountingOverviewSection
                data={data}
                activeConnectionId={activeConnectionId}
                snapshot={snapshot}
                pendingItems={pendingItems}
                pendingCustomers={pendingCustomers}
                onGoTo={(id) => goTo(id as SectionId)}
                onTestConnection={() => void test(activeConnectionId)}
              />
            ) : null}
          </div>

          <div style={{ display: section === 'connections' ? 'block' : 'none' }}>
            {visited.has('connections') ? (
              <AccountingConnectionsSection
                data={data}
                form={form}
                modes={formModes}
                policies={taxCatalog.rows}
                currencies={currencyCatalog.rows}
                taxCatalog={taxCatalog}
                currencyCatalog={currencyCatalog}
                onRetryCatalogs={() => {
                  void reloadCatalogs();
                }}
                canManage={data.canManage}
                busy={busy}
                selectedConnectionId={selectedConnectionId}
                testResult={testResult}
                view={connectionView}
                focus={connectionFocus}
                onOpenList={() => {
                  setConnectionView('list');
                  setConnectionFocus(null);
                }}
                onSelectConnection={selectConnection}
                onSetWorkspaceDefault={(entry) => void setWorkspaceDefault(entry)}
                onDeactivateConnection={(entry) =>
                  void deactivateConnection(entry)
                }
                onReactivateConnection={(entry) =>
                  void reactivateConnection(entry)
                }
                onEditConnection={editConnection}
                onChange={(next) => {
                  // A previous probe's verdict belongs to the saved values; editing the
                  // draft makes it stale, so it is cleared instead of lingering.
                  setTestResult(null);
                  setForm(next);
                }}
                onSave={() => void save()}
                onTest={() => void test(form.id)}
                onStartNew={startNewConnection}
              />
            ) : null}
          </div>

          <div style={{ display: section === 'catalog' ? 'block' : 'none' }}>
            {visited.has('catalog') ? (
              <AccountingCatalogSection
                connectionId={activeConnectionId}
                canManage={data.canManage}
                moneyUnitLabel={moneyUnitLabel}
                onPendingCountChange={setPendingItems}
                onGoToConnections={() => goTo('connections')}
              />
            ) : null}
          </div>

          <div style={{ display: section === 'customers' ? 'block' : 'none' }}>
            {visited.has('customers') ? (
              <AccountingCustomerSection
                connectionId={activeConnectionId}
                canManage={data.canManage}
                onPendingCountChange={setPendingCustomers}
                onGoToConnections={() => goTo('connections')}
                onSubViewChange={setCustomerView}
              />
            ) : null}
          </div>

          <div style={{ display: section === 'documents' ? 'block' : 'none' }}>
            {visited.has('documents') ? (
              <AccountingDocumentsSection
                connection={connection}
                operations={operations}
                busy={busy}
                canManage={data.canManage}
                outboundEnabled={data.flags.outboundEnabled}
                documentExportEnabled={data.flags.documentExportEnabled}
                taxMappingCount={taxMappingCount}
                taxHandling={resolveFinancialModes({
                  adapterId: connection?.adapterId ?? 'mock',
                  adapters: data.adapters,
                  financial: connection?.settings.financial,
                }).taxHandling}
                onReload={() => void loadOperations()}
                onGoToConnections={() => goTo('connections')}
                onGoToCatalog={() => goTo('catalog')}
                onFixMoney={() => openSelectedAt('money')}
                onFixTax={() => openSelectedAt('tax')}
                onTestConnection={() => void test(activeConnectionId)}
              />
            ) : null}
          </div>
        </main>
      </div>

      <div className="acct-mobile-bar">
        <SectionNav
          sections={sections}
          activeId={section}
          onSelect={(id) => goTo(id as SectionId)}
        />
      </div>
    </div>
  );
};

// Kept as a named export for the app's registration file, which imports the panel by name.
export { ACCOUNTING_GUIDE_STORAGE_KEY };
