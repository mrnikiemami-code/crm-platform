import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import { TAX_POLICIES_ROUTE, callAppRoute } from 'src/components/quotation-api';
import { toPersianDigits } from 'src/domain/money/display-format';
import {
  formatBasisPointsAsPercent,
  parsePercentToBasisPoints,
} from 'src/domain/money/tax-policy';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

// The tax settings panel. It only renders and forwards what the operator typed: the
// rate is validated, the single default is enforced and "used by quotations" is
// counted on the server, because a browser cannot be the authority for a tax rate.
//
// ONE POLICY, TWO COMPONENTS: tax (مالیات) and duty (عوارض) are two fields of the same
// row, not two policies. The list shows one line per policy with its total, and the
// editor shows both components plus the computed total, which is display-only.

type TaxPolicyRow = {
  recordId: string;
  code: string;
  name: string;
  ratePercent: string;
  dutyRatePercent: string;
  totalRatePercent: string;
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
  // Carried through the edit so saving a rate does not silently reactivate a policy;
  // activation has its own row action.
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
        // A policy written before duty existed reads as "no duty", which is what its
        // documents were priced with; the row is still one policy.
        dutyRatePercent:
          typeof row.dutyRatePercent === 'string' ? row.dutyRatePercent : '0',
        totalRatePercent:
          typeof row.totalRatePercent === 'string'
            ? row.totalRatePercent
            : typeof row.ratePercent === 'string'
              ? row.ratePercent
              : '',
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
  isActive: true,
});

const editorFor = (row: TaxPolicyRow): EditorState => ({
  recordId: row.recordId,
  name: row.name,
  ratePercentText: row.ratePercent,
  dutyPercentText: row.dutyRatePercent,
  isActive: row.isActive,
});

// The total is computed, never typed: two values that cannot be added are shown as
// "—" instead of a number the server would refuse anyway.
const sumPercentText = (taxText: string, dutyText: string): string => {
  const tax = parsePercentToBasisPoints(taxText);
  const duty =
    dutyText.trim() === ''
      ? { ok: true as const, value: BigInt(0) }
      : parsePercentToBasisPoints(dutyText);

  if (!tax.ok || !duty.ok) {
    return '—';
  }

  return `${toPersianDigits(
    formatBasisPointsAsPercent(tax.value + duty.value),
  )}٪`;
};

const percentLabel = (value: string): string => `${toPersianDigits(value)}٪`;

const FALLBACK_ERROR = 'ذخیرهٔ تنظیمات مالیات انجام نشد؛ دوباره تلاش کنید.';

// The same two parsers the server uses, run here first so a bad rate is reported under
// the input that holds it instead of as one generic message at the top of the page.
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

export const TaxPolicySettingsPanel = () => {
  const [rows, setRows] = useState<TaxPolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  // A refusal belongs to the row that caused it ("used in 8 documents") and a delete
  // asks for a second press, so the row the operator acted on is the one that answers.
  const [rowIssue, setRowIssue] = useState<{
    recordId: string;
    message: string;
  } | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );

  const updateEditor = useCallback((next: EditorState | null) => {
    setEditor(next);
    setEditorError(null);
  }, []);

  const applyResponse = useCallback(
    (
      data: Record<string, unknown>,
      fallbackMessage: string,
      newDefaultRecordId?: string,
    ): string | null => {
      if (data.success !== true) {
        // The refusal is returned, not painted here: the caller owns the surface it
        // belongs to (the row that was acted on, or the field being edited), so the
        // operator never reads the same sentence twice.
        return toPersianUiMessage(data.message, FALLBACK_ERROR);
      }

      const nextRows = readRows(data);

      // The payload is read before the demoted row is repainted, so it can still carry
      // the old default flag next to the new one; the row the operator pressed is the
      // one this action made default.
      setRows(
        newDefaultRecordId === undefined
          ? nextRows
          : nextRows.map((nextRow) => ({
              ...nextRow,
              isDefault: nextRow.recordId === newDefaultRecordId,
            })),
      );
      setError(null);
      enqueueSnackbar({
        message: toPersianUiMessage(data.message, fallbackMessage),
        variant: 'success',
      });

      return null;
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await callAppRoute(TAX_POLICIES_ROUTE, {
        action: 'list',
      });

      if (response.data.success !== true) {
        setError(toPersianUiMessage(response.data.message, FALLBACK_ERROR));
        return;
      }

      setRows(readRows(response.data));
    } catch (loadFailure) {
      console.error('tax-policy-settings: load failed', loadFailure);
      setError('فهرست سیاست‌های مالیات خوانده نشد؛ صفحه را دوباره باز کنید.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // `null` means the action persisted. A failure is returned as its real message so the
  // caller can show it beside the fields the operator is editing, not only at the top.
  const runAction = async (
    body: Record<string, unknown>,
    fallbackMessage: string,
    newDefaultRecordId?: string,
  ): Promise<string | null> => {
    setBusy(true);

    try {
      const response = await callAppRoute(TAX_POLICIES_ROUTE, body);

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

  const onSave = async () => {
    if (editor === null) {
      return;
    }

    const issue =
      rateFieldIssue(editor.ratePercentText) ??
      dutyFieldIssue(editor.dutyPercentText) ??
      combinedIssue(editor.ratePercentText, editor.dutyPercentText);

    if (issue !== null) {
      setEditorError(issue);
      return;
    }

    const failure = await runAction(
      {
        action: 'save',
        recordId: editor.recordId,
        name: editor.name,
        ratePercentText: editor.ratePercentText,
        dutyRatePercentText: editor.dutyPercentText,
        isActive: editor.isActive,
      },
      'سیاست مالیات ذخیره شد',
    );

    if (failure === null) {
      setEditor(null);
      setEditorError(null);
      return;
    }

    setEditorError(failure);
  };

  const onSetDefault = async (row: TaxPolicyRow) => {
    setConfirmingDeleteId(null);
    setRowIssue(null);

    const failure = await runAction(
      { action: 'set-default', recordId: row.recordId },
      'سیاست پیش‌فرض تغییر کرد',
      row.recordId,
    );

    if (failure !== null) {
      setRowIssue({ recordId: row.recordId, message: failure });
    }
  };

  const onDeactivate = async (row: TaxPolicyRow) => {
    setConfirmingDeleteId(null);
    setRowIssue(null);

    const failure = await runAction(
      { action: 'deactivate', recordId: row.recordId },
      'سیاست مالیات غیرفعال شد',
    );

    if (failure !== null) {
      setRowIssue({ recordId: row.recordId, message: failure });
    }
  };

  const onDelete = async (row: TaxPolicyRow) => {
    setRowIssue(null);

    if (confirmingDeleteId !== row.recordId) {
      // First press asks; the second press is the confirmed deletion.
      setConfirmingDeleteId(row.recordId);
      return;
    }

    const failure = await runAction(
      { action: 'delete', recordId: row.recordId },
      'سیاست مالیات حذف شد',
    );

    setConfirmingDeleteId(null);

    if (failure !== null) {
      setRowIssue({ recordId: row.recordId, message: failure });
    }
  };

  const onActivate = async (row: TaxPolicyRow) => {
    setConfirmingDeleteId(null);
    setRowIssue(null);

    // Reactivation is the same write as an edit, with the flag turned back on; the
    // server still checks that the catalog keeps one active default.
    const failure = await runAction(
      {
        action: 'save',
        recordId: row.recordId,
        name: row.name,
        ratePercentText: row.ratePercent,
        dutyRatePercentText: row.dutyRatePercent,
        isActive: true,
      },
      'سیاست مالیات فعال شد',
    );

    if (failure !== null) {
      setRowIssue({ recordId: row.recordId, message: failure });
    }
  };

  // The initial 9% policy is created only here, by an explicit admin action. It is
  // idempotent on the server, so a second press cannot create a duplicate.
  const onBootstrap = async () => {
    const failure = await runAction(
      { action: 'bootstrap' },
      'سیاست پایه آماده شد',
    );

    if (failure !== null) {
      setError(failure);
    }
  };

  // An untouched empty field is not an error yet; the operator has not typed anything
  // to be wrong about, and a red line under a blank field reads as a page failure.
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

  const actionStyle = (base: CSSProperties): CSSProperties =>
    busy ? { ...base, opacity: 0.5, cursor: 'not-allowed' } : base;

  // The designer's row is a card whose metrics answer one question ("what does this
  // policy cost") and whose actions are physically separated from those numbers. The
  // usage count is contextual, so it sits under the name instead of competing with the
  // rates as a fourth figure.
  const usageLine = (row: TaxPolicyRow): string =>
    row.quotationCount === 0
      ? 'در هیچ سندی استفاده نشده'
      : `در ${toPersianDigits(String(row.quotationCount))} سند استفاده شده`;

  const totalOf = (row: TaxPolicyRow): string => percentLabel(row.totalRatePercent);

  const renderEditor = (current: EditorState) => {
    const editingRow =
      current.recordId === null
        ? null
        : (rows.find((row) => row.recordId === current.recordId) ?? null);

    return (
      <>
        <div style={styles.editorHeader}>
          <h3 style={styles.editorTitle}>
            {current.recordId === null ? 'سیاست مالیات جدید' : 'ویرایش سیاست'}
          </h3>
          <div style={styles.editorHeaderActions}>
            <button
              type="button"
              className="tax-btn"
              style={actionStyle(styles.actionButton)}
              disabled={busy}
              onClick={() => updateEditor(null)}
            >
              انصراف
            </button>
            <button
              type="button"
              className="tax-btn"
              style={actionStyle(styles.primaryButton)}
              disabled={busy}
              onClick={() => void onSave()}
            >
              {busy ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
            </button>
          </div>
        </div>

        <div style={styles.fields}>
          <label style={{ ...styles.label, ...styles.fieldWide }}>
            نام سیاست
            <input
              style={styles.input}
              value={current.name}
              aria-invalid={editorError === null ? 'false' : 'true'}
              aria-describedby={
                editorError === null ? undefined : 'tax-policy-editor-error'
              }
              placeholder="مثلاً مالیات بر ارزش افزوده ۱۰٪"
              onChange={(event) =>
                updateEditor({ ...current, name: event.target.value })
              }
            />
          </label>
          <label style={styles.label}>
            مالیات (٪)
            <input
              style={
                rateDisplayIssue === null ? styles.input : styles.inputInvalid
              }
              value={current.ratePercentText}
              inputMode="decimal"
              aria-invalid={rateDisplayIssue !== null}
              placeholder="۶٫۵"
              onChange={(event) =>
                updateEditor({
                  ...current,
                  ratePercentText: event.target.value,
                })
              }
            />
            {rateDisplayIssue === null ? null : (
              <span role="alert" style={styles.fieldError}>
                {rateDisplayIssue}
              </span>
            )}
          </label>
          <label style={styles.label}>
            عوارض (٪)
            <input
              style={
                dutyDisplayIssue === null ? styles.input : styles.inputInvalid
              }
              value={current.dutyPercentText}
              inputMode="decimal"
              aria-invalid={dutyDisplayIssue !== null}
              placeholder="۰"
              onChange={(event) =>
                updateEditor({
                  ...current,
                  dutyPercentText: event.target.value,
                })
              }
            />
            {dutyDisplayIssue === null ? null : (
              <span role="alert" style={styles.fieldError}>
                {dutyDisplayIssue}
              </span>
            )}
          </label>
        </div>

        {/* The footer carries the two facts the operator needs while typing: whether
            this rate is still safely deletable, and what the two rates add up to. */}
        <div style={styles.editorFooter}>
          <p style={styles.editorFooterInfo}>
            {editingRow === null
              ? 'در هیچ سندی استفاده نشده'
              : usageLine(editingRow)}
          </p>
          <div style={styles.editorTotalBlock}>
            <span style={styles.totalLabel}>جمع محاسباتی:</span>
            <output style={styles.totalValueLg}>
              {sumPercentText(current.ratePercentText, current.dutyPercentText)}
            </output>
          </div>
        </div>

        <p style={styles.meta}>هر دو نرخ صفر یعنی معاف از مالیات.</p>
        {combinedFieldIssue === null ? null : (
          <span role="alert" style={styles.fieldError}>
            {combinedFieldIssue}
          </span>
        )}
        {editorError === null ? null : (
          <p id="tax-policy-editor-error" role="alert" style={styles.fieldError}>
            {editorError}
          </p>
        )}
      </>
    );
  };

  const editingRowId = editor?.recordId ?? null;

  return (
    <div style={styles.root} dir="rtl">
      <style>{PANEL_CSS}</style>

      <header style={styles.header}>
        <div style={styles.headerText}>
          <h2 style={styles.title}>مالیات و عوارض</h2>
          <p style={styles.subtitle}>
            سیاست پیش‌فرض برای شروع هر پیش‌فاکتور جدید استفاده می‌شود؛ اسناد
            صادرشده نرخ خود را حفظ می‌کنند.
          </p>
        </div>
        {rows.length === 0 ? null : (
          <button
            type="button"
            className="tax-add tax-btn"
            aria-label="افزودن سیاست"
            style={actionStyle(styles.addButton)}
            disabled={busy}
            onClick={() => updateEditor(emptyEditor())}
          >
            <span aria-hidden="true" style={styles.addButtonPlus}>
              +
            </span>
            <span className="tax-add-label">افزودن سیاست</span>
          </button>
        )}
      </header>

      {error === null ? null : (
        <p role="alert" style={styles.pageError}>
          {error}
        </p>
      )}

      {loading ? <p style={styles.meta}>در حال خواندن سیاست‌ها…</p> : null}

      {loading ? null : rows.length === 0 ? (
        <section style={styles.empty}>
          <p style={styles.emptyText}>هنوز سیاست مالیاتی ثبت نشده است.</p>
          <div style={styles.emptyActions}>
            <button
              type="button"
              className="tax-btn"
              style={actionStyle(styles.primaryButton)}
              disabled={busy}
              onClick={() => void onBootstrap()}
            >
              {busy ? 'در حال آماده‌سازی…' : 'ساخت سیاست پایهٔ ۹٪'}
            </button>
            <button
              type="button"
              className="tax-btn"
              style={actionStyle(styles.actionButton)}
              disabled={busy}
              onClick={() => updateEditor(emptyEditor())}
            >
              افزودن سیاست
            </button>
          </div>
        </section>
      ) : (
        <ul style={styles.list} aria-busy={busy}>
          {editor !== null && editor.recordId === null ? (
            <li key="new-policy" className="tax-editor">
              {renderEditor(editor)}
            </li>
          ) : null}

          {rows.map((row) => {
            const isConfirming = confirmingDeleteId === row.recordId;

            // The editor takes the row's place, so the operator edits the policy they
            // are looking at instead of scrolling to a detached form.
            if (editor !== null && editingRowId === row.recordId) {
              return (
                <li key={`${row.recordId}:editor`} className="tax-editor">
                  {renderEditor(editor)}
                </li>
              );
            }

            return (
              <li
                // The front-component host repaints attribute wrappers around this list;
                // a row that flips its default flag is remounted so the badge and the
                // actions beside it can never show two different states.
                key={`${row.recordId}:${row.isDefault ? 'default' : 'standard'}`}
                className={row.isActive ? 'tax-row' : 'tax-row tax-row-inactive'}
              >
                <div className="tax-row-main" style={styles.rowMain}>
                  <div style={styles.identity}>
                    <div style={styles.nameLine}>
                      <h3
                        style={
                          row.isActive ? styles.rowName : styles.rowNameMuted
                        }
                      >
                        {row.name}
                      </h3>
                      {row.isDefault ? (
                        <span style={styles.badgeDefault}>پیش‌فرض</span>
                      ) : null}
                      {row.isActive ? null : (
                        <span style={styles.badgeOff}>غیرفعال</span>
                      )}
                    </div>
                    <p style={styles.usage}>{usageLine(row)}</p>
                  </div>

                  <div className="tax-metrics" style={styles.metrics}>
                    <div style={styles.totalBlock}>
                      <span style={styles.metricLabel}>جمع کل</span>
                      <span
                        className="tax-total"
                        style={
                          row.isActive
                            ? styles.totalValue
                            : styles.totalValueMuted
                        }
                      >
                        {totalOf(row)}
                      </span>
                    </div>
                    <div style={styles.formulaChip}>
                      <span className="tax-formula-full">
                        مالیات: {percentLabel(row.ratePercent)}
                      </span>
                      <span className="tax-formula-short">
                        م: {percentLabel(row.ratePercent)}
                      </span>
                      <span style={styles.formulaDivider} aria-hidden="true">
                        |
                      </span>
                      <span className="tax-formula-full">
                        عوارض: {percentLabel(row.dutyRatePercent)}
                      </span>
                      <span className="tax-formula-short">
                        ع: {percentLabel(row.dutyRatePercent)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="tax-row-actions" style={styles.rowActions}>
                  {isConfirming ? (
                    <>
                      <span className="tax-confirm-text" style={styles.confirmText}>
                        «{row.name}» حذف شود؟
                      </span>
                      <button
                        type="button"
                        className="tax-btn tax-btn-danger-solid"
                        style={actionStyle(styles.dangerSolidButton)}
                        disabled={busy}
                        onClick={() => void onDelete(row)}
                      >
                        تأیید حذف
                      </button>
                      <button
                        type="button"
                        className="tax-btn"
                        style={actionStyle(styles.actionButton)}
                        disabled={busy}
                        onClick={() => setConfirmingDeleteId(null)}
                      >
                        انصراف
                      </button>
                    </>
                  ) : (
                    <>
                      {row.isActive && !row.isDefault ? (
                        <button
                          type="button"
                          className="tax-btn"
                          style={actionStyle(styles.actionButton)}
                          disabled={busy}
                          onClick={() => void onSetDefault(row)}
                        >
                          پیش‌فرض
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="tax-btn"
                        style={actionStyle(styles.actionButton)}
                        disabled={busy}
                        onClick={() => updateEditor(editorFor(row))}
                      >
                        ویرایش
                      </button>
                      {row.isActive &&
                      !row.isDefault &&
                      row.quotationCount > 0 ? (
                        <button
                          type="button"
                          className="tax-btn tax-btn-danger"
                          style={actionStyle(styles.dangerButton)}
                          disabled={busy}
                          onClick={() => void onDeactivate(row)}
                        >
                          غیرفعال‌سازی
                        </button>
                      ) : null}
                      {row.isActive &&
                      !row.isDefault &&
                      row.quotationCount === 0 ? (
                        <button
                          type="button"
                          className="tax-btn tax-btn-danger"
                          style={actionStyle(styles.dangerButton)}
                          disabled={busy}
                          onClick={() => void onDelete(row)}
                        >
                          حذف
                        </button>
                      ) : null}
                      {row.isActive ? null : (
                        <button
                          type="button"
                          className="tax-btn"
                          style={actionStyle(styles.actionButton)}
                          disabled={busy}
                          onClick={() => void onActivate(row)}
                        >
                          فعال‌سازی
                        </button>
                      )}
                    </>
                  )}
                </div>

                {rowIssue?.recordId === row.recordId ? (
                  <p role="alert" style={styles.rowError}>
                    {rowIssue.message}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {editor !== null && editor.recordId !== null && editingRowId === null ? (
        <section className="tax-editor" style={styles.editor}>
          {renderEditor(editor)}
        </section>
      ) : null}
    </div>
  );
};

// Designer-owned interaction rules that inline styles cannot express: hover and focus
// feedback, the 767 px stacking, and the two label lengths. Everything else is inline so
// the computed presentation stays readable next to the markup it belongs to.
const PANEL_CSS = `
.tax-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px;
  border: 1px solid #d6d6d6;
  border-radius: 8px;
  background: #fcfcfc;
}
.tax-row-inactive { opacity: 0.8; filter: grayscale(1); }
.tax-row-main {
  display: flex;
  align-items: center;
  gap: 32px;
  flex: 1 1 320px;
  min-width: 0;
}
.tax-metrics {
  display: flex;
  align-items: center;
  gap: 24px;
  border-inline-start: 1px solid #d6d6d6;
  padding-inline-start: 24px;
}
.tax-row-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tax-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 2px solid #4c6ef5;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}
.tax-btn {
  height: 32px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  font-family: inherit;
}
.tax-btn:hover:not(:disabled) { background: #f1f1f1; }
.tax-btn-danger:hover:not(:disabled) { background: #fdf1f0; }
.tax-btn-danger-solid:hover:not(:disabled) { background: #b83833; }
.tax-btn:focus-visible {
  outline: 2px solid #4c6ef5;
  outline-offset: 1px;
}
.tax-btn:disabled { cursor: not-allowed; }
.tax-add { height: 32px; padding: 0 16px; }
.tax-add:hover:not(:disabled) { background: #000000; }
.tax-formula-short { display: none; }
.tax-btn-primary:hover:not(:disabled) { background: #000000; }
@media (max-width: 767px) {
  .tax-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 12px;
  }
  .tax-row-main { flex-direction: column; align-items: stretch; gap: 12px; }
  .tax-metrics {
    justify-content: space-between;
    border-inline-start: none;
    padding-inline-start: 8px;
    padding-inline-end: 8px;
    padding-block: 8px;
    border-radius: 6px;
    background: #f1f1f1;
    gap: 12px;
  }
  .tax-row-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 8px;
  }
  .tax-row-actions > .tax-btn { width: 100%; }
  .tax-confirm-text { grid-column: 1 / -1; }
  .tax-formula-full { display: none; }
  .tax-formula-short { display: inline; }
  .tax-add { width: 32px; padding: 0; }
  .tax-add-label { display: none; }
}
`;

// Twenty's list surface: one hairline border per policy card, the computed total as the
// only accent, and actions that are unmistakably controls. An inactive rate is paused,
// not void: it stays readable, greyed and explicitly badged.
const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    fontFamily: 'inherit',
    color: '#333333',
    background: '#ffffff',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    padding: '24px',
    borderBottom: '1px solid #d6d6d6',
    background: '#fcfcfc',
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: '1 1 320px',
    minWidth: 0,
  },
  title: { margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.45 },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: '#666666',
    lineHeight: 1.8,
    maxWidth: 640,
  },
  addButton: {
    height: 32,
    padding: '0 16px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: '#333333',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
  },
  addButtonPlus: { fontSize: 16, lineHeight: 1 },
  pageError: {
    margin: 0,
    padding: '8px 12px',
    borderRadius: 8,
    background: '#fdecea',
    color: '#d3453f',
    fontSize: 13,
    lineHeight: 1.8,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    margin: 0,
    padding: '24px',
    listStyle: 'none',
  },
  rowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 32,
    flex: '1 1 320px',
    minWidth: 0,
  },
  identity: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 },
  nameLine: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowName: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#333333',
    overflowWrap: 'anywhere',
  },
  rowNameMuted: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#666666',
    overflowWrap: 'anywhere',
  },
  badgeDefault: {
    fontSize: 12,
    lineHeight: 1.8,
    fontWeight: 500,
    color: '#1e40af',
    background: '#dbeafe',
    borderRadius: 999,
    padding: '0 8px',
    whiteSpace: 'nowrap',
  },
  badgeOff: {
    fontSize: 12,
    lineHeight: 1.8,
    fontWeight: 500,
    color: '#525252',
    background: '#e5e5e5',
    border: '1px solid #d4d4d4',
    borderRadius: 999,
    padding: '0 8px',
    whiteSpace: 'nowrap',
  },
  usage: {
    margin: 0,
    fontSize: 12,
    color: '#666666',
    lineHeight: 1.8,
    fontVariantNumeric: 'tabular-nums',
  },
  metrics: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    borderInlineStart: '1px solid #d6d6d6',
    paddingInlineStart: 24,
  },
  totalBlock: { display: 'flex', flexDirection: 'column', gap: 2 },
  metricLabel: { fontSize: 12, color: '#666666', lineHeight: 1.8 },
  totalValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#4c6ef5',
    lineHeight: 1.5,
    fontVariantNumeric: 'tabular-nums',
  },
  totalValueMuted: {
    fontSize: 18,
    fontWeight: 700,
    color: '#666666',
    lineHeight: 1.5,
    fontVariantNumeric: 'tabular-nums',
  },
  formulaChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 12px',
    borderRadius: 8,
    background: '#f1f1f1',
    fontSize: 14,
    color: '#666666',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  formulaDivider: { color: '#d6d6d6' },
  rowActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  confirmText: {
    fontSize: 13,
    color: '#d3453f',
    lineHeight: 1.8,
  },
  rowError: {
    flexBasis: '100%',
    margin: 0,
    fontSize: 12,
    color: '#d3453f',
    lineHeight: 1.8,
  },
  actionButton: {
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid #d6d6d6',
    background: 'transparent',
    color: '#333333',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dangerButton: {
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid #d3453f',
    background: 'transparent',
    color: '#d3453f',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dangerSolidButton: {
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid #d3453f',
    background: '#d3453f',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primaryButton: {
    height: 32,
    padding: '0 16px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: '#333333',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  secondaryButton: {
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid #d6d6d6',
    background: 'transparent',
    color: '#333333',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
    margin: '24px',
    padding: 16,
    border: '1px dashed #d6d6d6',
    borderRadius: 8,
    background: '#fcfcfc',
  },
  emptyText: { margin: 0, fontSize: 14, color: '#333333' },
  emptyActions: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  editor: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    border: '2px solid #4c6ef5',
    borderRadius: 8,
    background: '#ffffff',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
  },
  editorHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 16,
    borderBottom: '1px solid #d6d6d6',
  },
  editorTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#333333',
  },
  editorHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  fields: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 16,
  },
  fieldWide: { gridColumn: 'span 2' },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12,
    color: '#666666',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid #d6d6d6',
    fontSize: 14,
    color: '#333333',
    background: '#ffffff',
    fontFamily: 'inherit',
  },
  inputInvalid: {
    width: '100%',
    boxSizing: 'border-box',
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid #d3453f',
    fontSize: 14,
    color: '#333333',
    background: '#ffffff',
    fontFamily: 'inherit',
  },
  fieldError: { margin: 0, fontSize: 12, color: '#d3453f', lineHeight: 1.7 },
  editorFooter: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    border: '1px solid #d6d6d6',
    background: '#fcfcfc',
  },
  editorFooterInfo: {
    margin: 0,
    fontSize: 14,
    color: '#666666',
    lineHeight: 1.8,
  },
  editorTotalBlock: { display: 'flex', alignItems: 'center', gap: 16 },
  totalLabel: { fontSize: 14, color: '#666666' },
  totalValueLg: {
    fontSize: 18,
    fontWeight: 700,
    color: '#4c6ef5',
    fontVariantNumeric: 'tabular-nums',
  },
  meta: { margin: 0, fontSize: 12, color: '#666666', lineHeight: 1.8 },
};
