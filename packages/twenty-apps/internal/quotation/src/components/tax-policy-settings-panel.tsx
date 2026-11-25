import {
  type CSSProperties,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import { callTaxPoliciesNestAction } from 'src/components/quotation-api';
import { QuotationCurrencySettingsSection } from 'src/components/quotation-currency-settings-section';
import { RoundingRuleSettingsSection } from 'src/components/rounding-rule-settings-section';
import { RowActionsMenu } from 'src/components/shared/row-actions-menu';
import { runDestructiveConfirm } from 'src/components/shared/run-destructive-confirm';
import { SettingsDialog } from 'src/components/shared/settings-dialog';
import {
  formatExactDecimalForPeople,
  toPersianDigits,
} from 'src/domain/money/display-format';
import {
  formatBasisPointsAsPercent,
  parsePercentToBasisPoints,
} from 'src/domain/money/tax-policy';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

// Ledger + Inspector: the catalog is a comparable table; create/edit lives in one
// sticky inspector so browsing and writing stay separate surfaces. Tax and duty remain
// two fields of one policy; the server still owns default uniqueness and delete refusal.

type TaxPolicyRow = {
  recordId: string;
  code: string;
  name: string;
  ratePercent: string;
  dutyRatePercent: string;
  totalRatePercent: string;
  accountingCode: string;
  isActive: boolean;
  isDefault: boolean;
  isExempt: boolean;
  quotationCount: number;
};

type EditorState = {
  recordId: string | null;
  name: string;
  ratePercentText: string;
  dutyPercentText: string;
  accountingCodeText: string;
  isActive: boolean;
};

const readRows = (data: Record<string, unknown>): TaxPolicyRow[] => {
  const policies = Array.isArray(data.policies) ? data.policies : [];

  return policies.flatMap((candidate) => {
    if (candidate === null || typeof candidate !== 'object') {
      return [];
    }

    const row = candidate as Record<string, unknown>;
    const recordId = typeof row.recordId === 'string' ? row.recordId : '';

    if (recordId === '') {
      return [];
    }

    return [
      {
        recordId,
        code: typeof row.code === 'string' ? row.code : '',
        name: typeof row.name === 'string' ? row.name : '',
        ratePercent:
          typeof row.ratePercent === 'string'
            ? row.ratePercent
            : String(row.rateBasisPoints ?? ''),
        dutyRatePercent:
          typeof row.dutyRatePercent === 'string' ? row.dutyRatePercent : '0',
        totalRatePercent:
          typeof row.totalRatePercent === 'string'
            ? row.totalRatePercent
            : typeof row.ratePercent === 'string'
              ? row.ratePercent
              : '',
        accountingCode:
          typeof row.accountingCode === 'string' ? row.accountingCode : '',
        isActive: row.isActive !== false,
        isDefault: row.isDefault === true,
        isExempt: row.isExempt === true,
        quotationCount:
          typeof row.quotationCount === 'number' ? row.quotationCount : 0,
      },
    ];
  });
};

const emptyEditor = (): EditorState => ({
  recordId: null,
  name: '',
  ratePercentText: '',
  dutyPercentText: '0',
  accountingCodeText: '',
  isActive: true,
});

const editorFor = (row: TaxPolicyRow): EditorState => ({
  recordId: row.recordId,
  name: row.name,
  ratePercentText: row.ratePercent,
  dutyPercentText: row.dutyRatePercent,
  accountingCodeText: row.accountingCode,
  isActive: row.isActive,
});

const sumPercentText = (taxText: string, dutyText: string): string => {
  const tax = parsePercentToBasisPoints(taxText);
  const duty =
    dutyText.trim() === ''
      ? { ok: true as const, value: BigInt(0) }
      : parsePercentToBasisPoints(dutyText);

  if (!tax.ok || !duty.ok) {
    return '—';
  }

  const total = tax.value + duty.value;

  if (total === BigInt(0)) {
    return 'معاف';
  }

  return `${toPersianDigits(formatBasisPointsAsPercent(total))}٪`;
};

const percentLabel = (value: string): string =>
  `${formatExactDecimalForPeople(value)}٪`;

const displayPolicyName = (name: string): string => toPersianDigits(name);

const FALLBACK_ERROR = 'ذخیرهٔ تنظیمات مالیات انجام نشد؛ دوباره تلاش کنید.';

const UNSAVED_EDITOR_MESSAGE =
  'تغییرات ذخیره‌نشده دارید؛ ابتدا ذخیره یا انصراف کنید.';

const sameEditor = (left: EditorState, right: EditorState): boolean =>
  left.recordId === right.recordId &&
  left.name === right.name &&
  left.ratePercentText === right.ratePercentText &&
  left.dutyPercentText === right.dutyPercentText &&
  left.accountingCodeText === right.accountingCodeText &&
  left.isActive === right.isActive;

const rateFieldIssue = (text: string): string | null => {
  const parsed = parsePercentToBasisPoints(text);

  return parsed.ok ? null : parsed.refusal.detail;
};

const dutyFieldIssue = (text: string): string | null => {
  if (text.trim() === '') {
    return null;
  }

  const parsed = parsePercentToBasisPoints(text);

  return parsed.ok ? null : parsed.refusal.detail;
};

const combinedIssue = (taxText: string, dutyText: string): string | null => {
  const tax = parsePercentToBasisPoints(taxText);
  const duty =
    dutyText.trim() === ''
      ? { ok: true as const, value: BigInt(0) }
      : parsePercentToBasisPoints(dutyText);

  if (!tax.ok || !duty.ok) {
    return null;
  }

  return tax.value + duty.value > BigInt(10000)
    ? 'جمع مالیات و عوارض از ۱۰۰٪ بیشتر نمی‌شود'
    : null;
};

const canDeleteRow = (row: TaxPolicyRow): boolean =>
  !row.isDefault && row.quotationCount === 0;

const usageLine = (row: TaxPolicyRow): string => {
  if (row.isDefault) {
    return 'پیش‌فرض — حذف یا غیرفعال نمی‌شود';
  }

  if (row.quotationCount === 0) {
    return 'بدون سند وابسته';
  }

  return `${toPersianDigits(String(row.quotationCount))} سند وابسته`;
};

type SettingsTab = 'tax' | 'currencies' | 'rounding';

export const TaxPolicySettingsPanel = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('tax');
  const [rows, setRows] = useState<TaxPolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorNotice, setEditorNotice] = useState<{
    kind: 'instruction' | 'failure';
    message: string;
  } | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [rowIssue, setRowIssue] = useState<{
    recordId: string;
    kind: 'notice' | 'error';
    message: string;
  } | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [openMoreRecordId, setOpenMoreRecordId] = useState<string | null>(null);
  const [editorBaseline, setEditorBaseline] = useState<EditorState | null>(
    null,
  );
  // One catalog surface at a time: the ledger and the phone cards must not both sit
  // in the accessibility tree, or a rotor hears every policy twice.
  const [compactLayout, setCompactLayout] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const media = window.matchMedia('(max-width: 720px)');
    const sync = () => setCompactLayout(media.matches);

    sync();
    media.addEventListener('change', sync);

    return () => media.removeEventListener('change', sync);
  }, []);

  const updateEditor = useCallback((next: EditorState | null) => {
    setEditor(next);
    setEditorNotice(null);
    setNameError(null);
  }, []);

  const closeEditor = () => {
    updateEditor(null);
    setEditorBaseline(null);
  };

  const openEditor = (next: EditorState | null) => {
    if (next === null) {
      closeEditor();

      return;
    }

    if (
      editor !== null &&
      editorBaseline !== null &&
      !sameEditor(editor, editorBaseline)
    ) {
      setRowIssue({
        recordId: next.recordId ?? '',
        kind: 'notice',
        message: UNSAVED_EDITOR_MESSAGE,
      });

      return;
    }

    setRowIssue(null);
    setOpenMoreRecordId(null);
    setEditorBaseline(next);
    updateEditor(next);
  };

  const editorIsDirty =
    editor !== null &&
    editorBaseline !== null &&
    !sameEditor(editor, editorBaseline);

  const applyResponse = useCallback(
    (
      data: Record<string, unknown>,
      fallbackMessage: string,
      newDefaultRecordId?: string,
    ): string | null => {
      if (data.success !== true) {
        return toPersianUiMessage(data.message, FALLBACK_ERROR);
      }

      const nextRows = readRows(data);

      setRows(
        newDefaultRecordId === undefined
          ? nextRows
          : nextRows.map((nextRow) => ({
              ...nextRow,
              isDefault: nextRow.recordId === newDefaultRecordId,
            })),
      );
      setError(null);
      const successMessage = toPersianUiMessage(data.message, fallbackMessage);

      if (successMessage.trim() !== '') {
        void enqueueSnackbar({
          message: successMessage,
          variant: 'success',
          dedupeKey: `tax-success:${successMessage}`,
        });
      }

      return null;
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOpenMoreRecordId(null);

    try {
      const response = await callTaxPoliciesNestAction({
        action: 'list',
      });

      if (response.data.success !== true) {
        setError(toPersianUiMessage(response.data.message, FALLBACK_ERROR));
        return;
      }

      setRows(readRows(response.data));
    } catch (loadFailure) {
      console.error('tax-policy-settings: load failed', loadFailure);
      setError('فهرست سیاست‌های مالیات خوانده نشد؛ دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (
    body: Record<string, unknown>,
    fallbackMessage: string,
    newDefaultRecordId?: string,
  ): Promise<string | null> => {
    setBusy(true);

    try {
      const response = await callTaxPoliciesNestAction(body);

      return applyResponse(
        response.data,
        fallbackMessage,
        newDefaultRecordId,
      );
    } catch (actionFailure) {
      console.error('tax-policy-settings: action failed', actionFailure);

      return 'ارتباط با سرور برقرار نشد';
    } finally {
      setBusy(false);
    }
  };

  const rateDisplayIssue =
    editor === null || editor.ratePercentText.trim() === ''
      ? null
      : rateFieldIssue(editor.ratePercentText);
  const dutyDisplayIssue =
    editor === null || editor.dutyPercentText.trim() === ''
      ? null
      : dutyFieldIssue(editor.dutyPercentText);
  const combinedFieldIssue =
    editor === null
      ? null
      : combinedIssue(editor.ratePercentText, editor.dutyPercentText);

  const onSave = async () => {
    if (editor === null) {
      return;
    }

    if (editor.name.trim() === '') {
      setNameError('نام سیاست مالیات را وارد کنید');
      setEditorNotice(null);

      return;
    }

    setNameError(null);

    const issue =
      rateFieldIssue(editor.ratePercentText) ??
      dutyFieldIssue(editor.dutyPercentText) ??
      combinedIssue(editor.ratePercentText, editor.dutyPercentText);

    if (issue !== null) {
      const alreadyPainted =
        rateDisplayIssue === issue ||
        dutyDisplayIssue === issue ||
        combinedFieldIssue === issue;

      if (!alreadyPainted) {
        setEditorNotice({ kind: 'failure', message: issue });
      }

      return;
    }

    const failure = await runAction(
      {
        action: 'save',
        recordId: editor.recordId,
        name: editor.name,
        ratePercentText: editor.ratePercentText,
        dutyRatePercentText: editor.dutyPercentText,
        accountingCodeText: editor.accountingCodeText,
        isActive: editor.isActive,
      },
      'سیاست مالیات ذخیره شد',
    );

    if (failure === null) {
      closeEditor();

      return;
    }

    setEditorNotice({ kind: 'failure', message: failure });
  };

  const onSetDefault = async (row: TaxPolicyRow) => {
    setOpenMoreRecordId(null);
    setRowIssue(null);

    const failure = await runAction(
      { action: 'set-default', recordId: row.recordId },
      'سیاست پیش‌فرض تغییر کرد',
      row.recordId,
    );

    if (failure !== null) {
      setRowIssue({ recordId: row.recordId, kind: 'error', message: failure });
    }
  };

  const onDeactivate = async (row: TaxPolicyRow) => {
    setOpenMoreRecordId(null);
    setRowIssue(null);

    const failure = await runAction(
      { action: 'deactivate', recordId: row.recordId },
      'سیاست مالیات غیرفعال شد',
    );

    if (failure !== null) {
      setRowIssue({ recordId: row.recordId, kind: 'error', message: failure });
    }
  };

  const onActivate = async (row: TaxPolicyRow) => {
    setOpenMoreRecordId(null);
    setRowIssue(null);

    const failure = await runAction(
      {
        action: 'save',
        recordId: row.recordId,
        name: row.name,
        ratePercentText: row.ratePercent,
        dutyRatePercentText: row.dutyRatePercent,
        accountingCodeText: row.accountingCode,
        isActive: true,
      },
      'سیاست مالیات فعال شد',
    );

    if (failure !== null) {
      setRowIssue({ recordId: row.recordId, kind: 'error', message: failure });
    }
  };

  const requestDelete = async (row: TaxPolicyRow) => {
    setRowIssue(null);
    setOpenMoreRecordId(null);

    if (!canDeleteRow(row)) {
      const reason = row.isDefault
        ? 'سیاست پیش‌فرض را نمی‌توان حذف کرد'
        : 'این سیاست در سند استفاده شده و حذف نمی‌شود';
      void enqueueSnackbar({
        message: reason,
        variant: 'warning',
        dedupeKey: `tax-delete-blocked:${row.recordId}`,
      });

      return;
    }

    if (deletingRecordId !== null) {
      return;
    }

    const nameText = displayPolicyName(row.name);
    const confirmation = await runDestructiveConfirm({
      title: 'حذف سیاست مالیات',
      subtitle: `آیا سیاست «${nameText}» حذف شود؟ این عملیات قابل بازگشت نیست.`,
      confirmButtonText: 'حذف سیاست',
    });

    if (confirmation !== 'confirm') {
      return;
    }

    setDeletingRecordId(row.recordId);

    try {
      const failure = await runAction(
        { action: 'delete', recordId: row.recordId },
        'سیاست مالیات حذف شد',
      );

      if (failure !== null) {
        setRowIssue({
          recordId: row.recordId,
          kind: 'error',
          message: failure,
        });
        void enqueueSnackbar({
          message: failure,
          variant: 'error',
          dedupeKey: `tax-delete-error:${row.recordId}`,
        });

        return;
      }

      if (editor?.recordId === row.recordId) {
        closeEditor();
      }
    } finally {
      setDeletingRecordId(null);
    }
  };

  const onBootstrap = async () => {
    const failure = await runAction(
      { action: 'bootstrap' },
      'سیاست پایه آماده شد',
    );

    if (failure !== null) {
      setError(failure);
    }
  };

  const defaultRow = rows.find((row) => row.isDefault && row.isActive) ?? null;
  const editingRow =
    editor?.recordId === null
      ? null
      : (rows.find((row) => row.recordId === editor?.recordId) ?? null);

  const statusBadge = (row: TaxPolicyRow) => {
    if (row.isDefault) {
      return <span className="tax-badge tax-badge-default">پیش‌فرض</span>;
    }

    if (row.isActive) {
      return <span className="tax-badge tax-badge-active">فعال</span>;
    }

    return <span className="tax-badge tax-badge-off">غیرفعال</span>;
  };

  const renderRowActions = (row: TaxPolicyRow) => {
    const nameText = displayPolicyName(row.name);
    const moreOpen = openMoreRecordId === row.recordId;
    const deleteBusy = deletingRecordId === row.recordId;
    const menuItems = [
      ...(row.isActive && !row.isDefault
        ? [
            {
              id: 'default',
              label: 'پیش‌فرض',
              disabled: busy,
              onSelect: () => {
                void onSetDefault(row);
              },
            },
          ]
        : []),
      row.isActive
        ? {
            id: 'deactivate',
            label: 'غیرفعال',
            disabled: busy || row.isDefault,
            title: row.isDefault
              ? 'پیش‌فرض را نمی‌توان غیرفعال کرد'
              : undefined,
            onSelect: () => {
              void onDeactivate(row);
            },
          }
        : {
            id: 'activate',
            label: 'فعال',
            disabled: busy,
            onSelect: () => {
              void onActivate(row);
            },
          },
      {
        id: 'delete',
        label: deleteBusy ? 'در حال حذف…' : 'حذف',
        disabled: busy || deleteBusy || !canDeleteRow(row),
        danger: true,
        title: canDeleteRow(row)
          ? undefined
          : row.isDefault
            ? 'سیاست پیش‌فرض حذف نمی‌شود'
            : 'به‌دلیل استفاده در سند حذف نمی‌شود',
        onSelect: () => {
          void requestDelete(row);
        },
      },
    ];

    return (
      <div
        className="tax-row-actions"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="tax-btn"
          aria-label={`ویرایش — ${nameText}`}
          disabled={busy || deletingRecordId !== null}
          onClick={() => openEditor(editorFor(row))}
        >
          ویرایش
        </button>
        <RowActionsMenu
          label={`عملیات بیشتر — ${nameText}`}
          open={moreOpen}
          onOpenChange={(nextOpen) =>
            setOpenMoreRecordId(nextOpen ? row.recordId : null)
          }
          disabled={busy || deletingRecordId !== null}
          items={menuItems}
        />
      </div>
    );
  };

  return (
    <div className="tax-root" style={styles.root} dir="rtl">
      <style>{PANEL_CSS}</style>

      <div className="tax-toolbar">
        <nav className="tax-tabs" aria-label="بخش‌های پیش‌نیازهای حسابداری">
          {(
            [
              { id: 'tax', label: 'مالیات و عوارض' },
              { id: 'currencies', label: 'ارزها' },
              { id: 'rounding', label: 'قواعد رُند کردن' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={
                activeTab === tab.id ? 'tax-tab tax-tab-active' : 'tax-tab'
              }
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {activeTab === 'tax' && rows.length > 0 && error === null ? (
          <button
            type="button"
            className="tax-btn tax-btn-primary tax-add"
            aria-label="سیاست جدید"
            disabled={busy}
            onClick={() => openEditor(emptyEditor())}
          >
            + سیاست جدید
          </button>
        ) : null}
      </div>

      {activeTab !== 'tax' ? null : error === null ? null : (
        <div className="tax-page-error">
          <p role="alert" style={styles.pageError}>
            {error}
          </p>
          <button
            type="button"
            className="tax-btn"
            disabled={busy || loading}
            onClick={() => void load()}
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {activeTab !== 'tax' ? null : loading ? (
        <p role="status" style={styles.meta}>
          در حال خواندن سیاست‌ها…
        </p>
      ) : null}

      {activeTab !== 'tax' ||
      loading ||
      error !== null ||
      defaultRow === null ? null : (
        <section className="tax-default-banner" aria-label="سیاست پیش‌فرض فعال">
          <div>
            <strong>
              پیش‌فرض — {displayPolicyName(defaultRow.name)}
            </strong>
          </div>
          <div className="tax-rate-pill">
            <span>
              {defaultRow.isExempt
                ? 'معاف'
                : percentLabel(defaultRow.totalRatePercent)}
            </span>
          </div>
        </section>
      )}

      {activeTab !== 'tax' || loading ? null : error !== null ? null : rows.length === 0 ? (
        <section className="tax-empty">
          <p style={styles.emptyText}>
            هنوز سیاست مالیات و عوارضی ثبت نشده است.
          </p>
          <div className="tax-empty-actions">
            <button
              type="button"
              className="tax-btn tax-btn-primary"
              disabled={busy}
              onClick={() => void onBootstrap()}
            >
              {busy ? 'در حال آماده‌سازی…' : 'ساخت سیاست پایهٔ ۹٪'}
            </button>
            <button
              type="button"
              className="tax-btn"
              disabled={busy}
              onClick={() => openEditor(emptyEditor())}
            >
              سیاست جدید
            </button>
          </div>
        </section>
      ) : (
        <div className="tax-workspace tax-workspace-closed">
          <section className="tax-panel" aria-labelledby="tax-list-title">
            <div className="tax-panel-toolbar">
              <h3 id="tax-list-title" style={styles.listTitle}>
                سیاست‌ها
                <span className="tax-count">
                  {' '}
                  {toPersianDigits(String(rows.length))}
                </span>
              </h3>
              <button
                type="button"
                className="tax-btn"
                disabled={busy || loading}
                onClick={() => void load()}
              >
                بازخوانی
              </button>
            </div>

            {compactLayout ? (
              <div className="tax-mobile-cards" aria-label="فهرست موبایل">
                {rows.map((row) => {
                  const nameText = displayPolicyName(row.name);
                  const selected = editor?.recordId === row.recordId;

                  return (
                    <article
                      key={`m-${row.recordId}`}
                      className={[
                        'tax-m-card',
                        selected ? 'is-selected' : '',
                        row.isActive ? '' : 'is-inactive',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      data-record-id={row.recordId}
                    >
                      <div className="tax-m-top">
                        <div>
                          <div className="tax-name">{nameText}</div>
                          <div className="tax-code" dir="ltr">
                            {row.code}
                          </div>
                        </div>
                        {statusBadge(row)}
                      </div>
                      <div className="tax-m-rates">
                        <div>
                          <small>مالیات</small>
                          <strong className="tax-num">
                            {percentLabel(row.ratePercent)}
                          </strong>
                        </div>
                        <div>
                          <small>عوارض</small>
                          <strong className="tax-num">
                            {percentLabel(row.dutyRatePercent)}
                          </strong>
                        </div>
                        <div>
                          <small>نرخ کل</small>
                          <strong
                            className={
                              row.isExempt ? 'tax-num tax-exempt' : 'tax-num'
                            }
                          >
                            {row.isExempt
                              ? 'معاف'
                              : percentLabel(row.totalRatePercent)}
                          </strong>
                        </div>
                      </div>
                      {rowIssue?.recordId === row.recordId ? (
                        <p
                          role={
                            rowIssue.kind === 'notice' ? 'status' : 'alert'
                          }
                          className={
                            rowIssue.kind === 'notice'
                              ? 'tax-row-notice'
                              : 'tax-row-error'
                          }
                        >
                          {rowIssue.message}
                        </p>
                      ) : null}
                      {renderRowActions(row)}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="tax-table-wrap">
                <table className="tax-ledger" aria-busy={busy}>
                  <thead>
                    <tr>
                      <th scope="col">سیاست</th>
                      <th scope="col">مالیات</th>
                      <th scope="col">عوارض</th>
                      <th scope="col">نرخ کل</th>
                      <th scope="col">وضعیت</th>
                      <th scope="col">
                        <span className="tax-sr-only">عملیات</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const nameText = displayPolicyName(row.name);
                      const selected = editor?.recordId === row.recordId;

                      return (
                        <tr
                          key={`${row.recordId}:${row.isDefault ? 'd' : 's'}`}
                          className={[
                            selected ? 'is-selected' : '',
                            row.isActive ? '' : 'is-inactive',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          data-record-id={row.recordId}
                          tabIndex={0}
                          onClick={() => openEditor(editorFor(row))}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') {
                              return;
                            }

                            event.preventDefault();
                            openEditor(editorFor(row));
                          }}
                        >
                          <td className="tax-col-policy">
                            <div className="tax-name">{nameText}</div>
                            <div className="tax-code" dir="ltr">
                              {row.code}
                            </div>
                            {rowIssue?.recordId === row.recordId ? (
                              <p
                                role={
                                  rowIssue.kind === 'notice'
                                    ? 'status'
                                    : 'alert'
                                }
                                className={
                                  rowIssue.kind === 'notice'
                                    ? 'tax-row-notice'
                                    : 'tax-row-error'
                                }
                              >
                                {rowIssue.message}
                              </p>
                            ) : null}
                          </td>
                          <td className="tax-col-num">
                            <span className="tax-num">
                              {percentLabel(row.ratePercent)}
                            </span>
                          </td>
                          <td className="tax-col-num">
                            <span className="tax-num">
                              {percentLabel(row.dutyRatePercent)}
                            </span>
                          </td>
                          <td className="tax-col-num">
                            <span
                              className={
                                row.isExempt
                                  ? 'tax-num tax-exempt'
                                  : 'tax-num tax-total'
                              }
                            >
                              {row.isExempt
                                ? 'معاف'
                                : percentLabel(row.totalRatePercent)}
                            </span>
                          </td>
                          <td className="tax-col-status">{statusBadge(row)}</td>
                          <td className="tax-col-actions">
                            {renderRowActions(row)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </section>

        </div>
      )}

      {editor === null ? null : (
        <SettingsDialog
          title={editor.recordId === null ? 'سیاست جدید' : 'ویرایش سیاست'}
          busy={busy}
          onClose={() => closeEditor()}
          footer={
            <>
              <button
                type="button"
                className="tax-btn tax-btn-primary"
                disabled={busy}
                onClick={() => void onSave()}
              >
                {busy ? 'در حال ذخیره…' : 'ذخیره'}
              </button>
              <button
                type="button"
                className="tax-btn"
                disabled={busy}
                onClick={() => closeEditor()}
              >
                انصراف
              </button>
            </>
          }
        >
          <div
            className={
              nameError === null ? 'tax-field' : 'tax-field is-invalid'
            }
          >
            <label htmlFor="tax-policy-name">نام سیاست</label>
            <input
              id="tax-policy-name"
              value={editor.name}
              aria-invalid={nameError !== null}
              aria-describedby={
                nameError === null ? undefined : 'tax-policy-name-error'
              }
              placeholder="مثلاً مالیات بر ارزش افزوده"
              onChange={(event) => {
                setNameError(null);
                updateEditor({ ...editor, name: event.target.value });
              }}
            />
            {nameError === null ? null : (
              <span
                id="tax-policy-name-error"
                role="alert"
                className="tax-field-error"
              >
                {nameError}
              </span>
            )}
          </div>

          <div className="tax-split-2">
            <div
              className={
                rateDisplayIssue === null
                  ? 'tax-field'
                  : 'tax-field is-invalid'
              }
            >
              <label htmlFor="tax-policy-rate">مالیات ٪</label>
              <input
                id="tax-policy-rate"
                value={editor.ratePercentText}
                inputMode="decimal"
                dir="ltr"
                aria-invalid={rateDisplayIssue !== null}
                placeholder="۹"
                onChange={(event) =>
                  updateEditor({
                    ...editor,
                    ratePercentText: event.target.value,
                  })
                }
              />
              {rateDisplayIssue === null ? null : (
                <span role="alert" className="tax-field-error">
                  {rateDisplayIssue}
                </span>
              )}
            </div>
            <div
              className={
                dutyDisplayIssue === null
                  ? 'tax-field'
                  : 'tax-field is-invalid'
              }
            >
              <label htmlFor="tax-policy-duty">عوارض ٪</label>
              <input
                id="tax-policy-duty"
                value={editor.dutyPercentText}
                inputMode="decimal"
                dir="ltr"
                aria-invalid={dutyDisplayIssue !== null}
                placeholder="۰"
                onChange={(event) =>
                  updateEditor({
                    ...editor,
                    dutyPercentText: event.target.value,
                  })
                }
              />
              {dutyDisplayIssue === null ? null : (
                <span role="alert" className="tax-field-error">
                  {dutyDisplayIssue}
                </span>
              )}
            </div>
          </div>

          <p className="tax-hint">هر دو نرخ صفر یعنی معاف از مالیات.</p>

          <div className="tax-field">
            <label htmlFor="tax-policy-accounting-code">
              کد حسابداری (اختیاری)
            </label>
            <input
              id="tax-policy-accounting-code"
              value={editor.accountingCodeText}
              dir="ltr"
              placeholder="اختیاری"
              maxLength={64}
              onChange={(event) =>
                updateEditor({
                  ...editor,
                  accountingCodeText: event.target.value,
                })
              }
            />
          </div>

          <div className="tax-computed" aria-live="polite">
            <span>نرخ کل</span>
            <strong>
              {sumPercentText(editor.ratePercentText, editor.dutyPercentText)}
            </strong>
          </div>

          {editorIsDirty ? (
            <p role="status" className="tax-unsaved">
              ذخیره‌نشده
            </p>
          ) : null}

          {combinedFieldIssue === null ? null : (
            <p role="alert" className="tax-field-error">
              {combinedFieldIssue}
            </p>
          )}
          {editorNotice === null ? null : (
            <p
              role={editorNotice.kind === 'instruction' ? 'status' : 'alert'}
              className={
                editorNotice.kind === 'instruction'
                  ? 'tax-row-notice'
                  : 'tax-field-error'
              }
            >
              {editorNotice.message}
            </p>
          )}
          {editingRow === null ? null : (
            <p className="tax-hint">{usageLine(editingRow)}</p>
          )}
        </SettingsDialog>
      )}

      {activeTab === 'currencies' ? (
        <QuotationCurrencySettingsSection alwaysOpen />
      ) : null}
      {activeTab === 'rounding' ? (
        <RoundingRuleSettingsSection alwaysOpen />
      ) : null}
    </div>
  );
};

const PANEL_CSS = `
.tax-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.tax-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--t-color-gray5);
  border-radius: 10px;
  background: var(--t-color-gray2);
  flex: 1 1 auto;
  min-width: 0;
}
.tax-tab {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--t-color-gray11);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  min-height: 40px;
  padding: 8px 14px;
  border-radius: 9px;
  cursor: pointer;
}
.tax-tab-active {
  background: var(--t-color-gray1);
  color: var(--t-color-gray12);
  box-shadow: 0 1px 0 var(--t-color-gray4);
}
.tax-page-error {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.tax-default-banner {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  margin-bottom: 16px;
  border: 1px solid var(--t-color-blue4);
  border-radius: 10px;
  background: var(--t-color-blue2);
}
.tax-rate-pill {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--t-color-gray6);
  background: var(--t-color-gray1);
  font-weight: 700;
  color: var(--t-color-blue11);
}
.tax-root {
  container-type: inline-size;
  container-name: tax-settings;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: clip;
}
.tax-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
  gap: 16px;
  align-items: start;
  min-width: 0;
}
.tax-workspace-closed { grid-template-columns: minmax(0, 1fr); }
.tax-panel {
  background: var(--t-color-gray1);
  border: 1px solid var(--t-color-gray6);
  border-radius: 10px;
  overflow: visible;
}
.tax-panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--t-color-gray6);
  background: var(--t-color-gray2);
}
.tax-count { color: var(--t-color-gray10); font-weight: 500; }
.tax-table-wrap {
  overflow-x: auto;
  max-width: 100%;
}
.tax-ledger {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  min-width: 0;
}
.tax-ledger th {
  text-align: right;
  font-size: 12px;
  font-weight: 600;
  color: var(--t-color-gray10);
  padding: 10px 12px;
  border-bottom: 1px solid var(--t-color-gray6);
  background: var(--t-color-gray2);
  white-space: nowrap;
}
.tax-ledger td {
  padding: 12px;
  border-bottom: 1px solid var(--t-color-gray5);
  vertical-align: middle;
}
.tax-col-policy { width: 28%; }
.tax-col-num { width: 10%; white-space: nowrap; }
.tax-col-status { width: 12%; white-space: nowrap; }
.tax-col-actions {
  width: 22%;
  white-space: nowrap;
}
.tax-ledger tbody tr { cursor: pointer; }
.tax-ledger tbody tr:hover { background: var(--t-color-gray2); }
.tax-ledger tbody tr.is-selected { background: var(--t-color-blue2); }
.tax-ledger tbody tr.is-inactive .tax-name { color: var(--t-color-gray10); }
.tax-name {
  font-weight: 600;
  color: var(--t-color-gray12);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tax-code {
  margin-top: 2px;
  font-size: 12px;
  color: var(--t-color-gray10);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.tax-num {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  direction: ltr;
  unicode-bidi: plaintext;
  display: inline-block;
}
.tax-total { color: var(--t-color-blue11); font-size: 15px; }
.tax-exempt { color: var(--t-color-turquoise11); }
.tax-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.tax-badge-default {
  background: var(--t-color-blue3);
  color: var(--t-color-blue11);
}
.tax-badge-active {
  background: var(--t-color-turquoise3);
  color: var(--t-color-turquoise11);
}
.tax-badge-off {
  background: var(--t-color-gray4);
  color: var(--t-color-gray11);
}
.tax-usage {
  display: block;
  font-size: 13px;
  color: var(--t-color-gray11);
  white-space: nowrap;
}
.tax-usage-detail {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--t-color-gray10);
}
.tax-row-actions {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  position: relative;
}
.tax-col-actions .tax-btn {
  flex: 0 0 auto;
  padding: 0 10px;
  min-height: 32px;
}
.tax-more { position: relative; }
.tax-more-menu {
  position: absolute;
  inset-inline-end: 0;
  top: calc(100% + 4px);
  z-index: 20;
  min-width: 148px;
  padding: 4px;
  border: 1px solid var(--t-color-gray6);
  border-radius: 8px;
  background: var(--t-color-gray1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  display: grid;
  gap: 2px;
}
.tax-more-item {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--t-color-gray12);
  font: inherit;
  font-size: 13px;
  text-align: right;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  min-height: 36px;
}
.tax-more-item:hover:not(:disabled) { background: var(--t-color-gray3); }
.tax-more-item:disabled {
  color: var(--t-color-gray9);
  cursor: not-allowed;
}
.tax-more-item-danger { color: var(--t-color-red11); }
.tax-more-item-danger:hover:not(:disabled) { background: var(--t-color-red2); }
.tax-mobile-cards {
  display: grid;
  gap: 10px;
  padding: 12px;
}
.tax-m-card {
  border: 1px solid var(--t-color-gray6);
  border-radius: 10px;
  padding: 12px;
  background: var(--t-color-gray1);
}
.tax-m-card.is-selected {
  border-color: var(--t-color-blue7);
  background: var(--t-color-blue2);
}
.tax-m-card.is-inactive { background: var(--t-color-gray2); }
.tax-m-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.tax-m-rates {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}
.tax-m-rates div {
  background: var(--t-color-gray3);
  border-radius: 8px;
  padding: 8px;
}
.tax-m-rates small {
  display: block;
  color: var(--t-color-gray10);
  font-size: 11px;
  margin-bottom: 2px;
}
.tax-footnote {
  margin: 0;
  padding: 0 14px 14px;
  font-size: 12px;
  color: var(--t-color-gray10);
}
.tax-inspector { position: sticky; top: 16px; }
.tax-inspector-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--t-color-gray6);
}
.tax-inspector-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--t-color-gray10);
}
.tax-editor-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 18px;
}
.tax-field { display: flex; flex-direction: column; gap: 6px; }
.tax-field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--t-color-gray11);
}
.tax-field input {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--t-color-gray6);
  border-radius: 8px;
  background: var(--t-color-gray1);
  color: var(--t-color-gray12);
}
.tax-field.is-invalid input {
  border-color: var(--t-color-red8);
  background: var(--t-color-red2);
}
.tax-field input:focus-visible {
  outline: 2px solid var(--t-color-blue9);
  outline-offset: 1px;
}
.tax-split-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.tax-computed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  border: 1px dashed var(--t-color-gray6);
  background: var(--t-color-gray2);
}
.tax-computed span {
  font-size: 12px;
  font-weight: 600;
  color: var(--t-color-gray10);
}
.tax-computed strong {
  font-size: 20px;
  font-weight: 700;
  color: var(--t-color-blue11);
  font-variant-numeric: tabular-nums;
  direction: ltr;
  unicode-bidi: plaintext;
}
.tax-hint { margin: 0; font-size: 12px; color: var(--t-color-gray10); }
.tax-unsaved {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--t-color-orange11);
}
.tax-field-error, .tax-row-error {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--t-color-red11);
}
.tax-row-notice {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--t-color-orange11);
}
.tax-inspector-lifecycle {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}
.tax-inspector-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.tax-foot-danger { margin-inline-start: auto; }
.tax-empty {
  padding: 24px;
  border: 1px dashed var(--t-color-gray6);
  border-radius: 10px;
  background: var(--t-color-gray1);
}
.tax-empty-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.tax-btn {
  height: 32px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--t-color-gray6);
  border-radius: 8px;
  background: var(--t-color-gray1);
  color: var(--t-color-gray12);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.tax-btn:hover:not(:disabled) { background: var(--t-color-gray3); }
.tax-btn:focus-visible {
  outline: 2px solid var(--t-color-blue9);
  outline-offset: 1px;
}
.tax-btn:disabled {
  background: var(--t-color-gray2);
  border-color: var(--t-color-gray5);
  color: var(--t-color-gray9);
  cursor: not-allowed;
}
.tax-btn-primary {
  background: var(--t-color-gray12);
  border-color: var(--t-color-gray12);
  color: var(--t-color-gray1);
}
.tax-btn-primary:hover:not(:disabled) {
  background: var(--t-color-gray11);
  border-color: var(--t-color-gray11);
}
.tax-btn-danger {
  border-color: var(--t-color-red7);
  color: var(--t-color-red11);
}
.tax-btn-danger:hover:not(:disabled) { background: var(--t-color-red2); }
.tax-btn-danger-solid {
  background: var(--t-color-red11);
  border-color: var(--t-color-red11);
  color: var(--t-color-gray1);
}
.tax-btn-danger-solid:hover:not(:disabled) {
  background: var(--t-color-red12);
  border-color: var(--t-color-red12);
}
.tax-add { flex: 0 0 auto; white-space: nowrap; }
.tax-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@container tax-settings (max-width: 960px) {
  .tax-workspace,
  .tax-workspace-closed { grid-template-columns: 1fr; }
  .tax-inspector { position: static; }
}
@container tax-settings (max-width: 720px) {
  .tax-toolbar { flex-direction: column; align-items: stretch; }
  .tax-add { width: 100%; min-height: 44px; height: 44px; }
  .tax-tabs { width: 100%; }
  .tax-tab { flex: 1 1 auto; text-align: center; min-height: 40px; }
  .tax-row-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
  }
  .tax-more { width: 100%; }
  .tax-more .tax-btn { width: 100%; }
  .tax-more-menu {
    inset-inline: 0;
    min-width: 0;
  }
  .tax-btn { min-height: 44px; height: 44px; width: 100%; }
  .tax-more-item { min-height: 44px; }
  .tax-field input { height: 44px; }
  .tax-split-2 { grid-template-columns: 1fr; }
}
@media (max-width: 960px) {
  .tax-workspace,
  .tax-workspace-closed { grid-template-columns: 1fr; }
  .tax-inspector { position: static; }
}
@media (max-width: 720px) {
  .tax-toolbar { flex-direction: column; align-items: stretch; }
  .tax-add { width: 100%; min-height: 44px; height: 44px; }
  .tax-tabs { width: 100%; }
  .tax-tab { flex: 1 1 auto; text-align: center; min-height: 40px; }
  .tax-row-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
  }
  .tax-btn { min-height: 44px; height: 44px; width: 100%; }
  .tax-field input { height: 44px; }
  .tax-split-2 { grid-template-columns: 1fr; }
}
`;

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    fontFamily: 'inherit',
    color: 'var(--t-color-gray12)',
    maxWidth: 1180,
    width: '100%',
    minWidth: 0,
  },
  listTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--t-color-gray11)',
  },
  meta: {
    margin: 0,
    fontSize: 13,
    color: 'var(--t-color-gray10)',
  },
  pageError: {
    margin: 0,
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--t-color-red11)',
  },
  emptyText: {
    margin: 0,
    fontSize: 14,
    color: 'var(--t-color-gray11)',
  },
};
