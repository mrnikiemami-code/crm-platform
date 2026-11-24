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

  const editorStyle: CSSProperties =
    editor === null ? styles.hidden : styles.editor;

  const combinedFieldIssue =
    editor === null
      ? null
      : combinedIssue(editor.ratePercentText, editor.dutyPercentText);

  // Only the absence of an action needs explaining; a footnote under every row is the
  // kind of repetition that makes an operator stop reading them.
  const rowHint = (row: TaxPolicyRow): string | null => {
    if (row.isDefault) {
      return 'پیش‌فرض فعلی است؛ برای تغییر، ابتدا پیش‌فرض دیگری انتخاب کنید.';
    }

    return row.isActive && row.quotationCount > 0
      ? `در ${toPersianDigits(String(row.quotationCount))} سند استفاده شده است؛ به‌جای حذف، غیرفعال می‌شود.`
      : null;
  };

  const actionStyle = (base: CSSProperties): CSSProperties =>
    busy ? { ...base, opacity: 0.5, cursor: 'not-allowed' } : base;

  return (
    <div style={styles.root} dir="rtl">
      <header style={styles.header}>
        <div style={styles.headerText}>
          <h2 style={styles.title}>مالیات و عوارض</h2>
          <p style={styles.subtitle}>
            سیاست پیش‌فرض شروع هر پیش‌فاکتور جدید است؛ اسناد صادرشده نرخ خود را
            نگه می‌دارند.
          </p>
        </div>
        {rows.length === 0 ? null : (
          <button
            type="button"
            style={actionStyle(styles.primaryButton)}
            disabled={busy}
            onClick={() => updateEditor(emptyEditor())}
          >
            افزودن سیاست
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
              style={actionStyle(styles.primaryButton)}
              disabled={busy}
              onClick={() => void onBootstrap()}
            >
              {busy ? 'در حال آماده‌سازی…' : 'ساخت سیاست پایهٔ ۹٪'}
            </button>
            <button
              type="button"
              style={actionStyle(styles.secondaryButton)}
              disabled={busy}
              onClick={() => updateEditor(emptyEditor())}
            >
              افزودن سیاست
            </button>
          </div>
        </section>
      ) : (
        <ul style={styles.list} aria-busy={busy}>
          {rows.map((row, index) => {
            const isConfirming = confirmingDeleteId === row.recordId;
            const hint = rowHint(row);

            return (
              <li
                // The front-component host repaints attribute wrappers around this list;
                // a row that flips its default flag is remounted so the badge and the
                // actions beside it can never show two different states.
                key={`${row.recordId}:${row.isDefault ? 'default' : 'standard'}`}
                style={{
                  ...(row.isActive
                    ? row.isDefault
                      ? styles.rowDefault
                      : styles.row
                    : styles.rowInactive),
                  ...(index === 0 ? null : styles.rowDivider),
                }}
              >
                <div style={styles.identity}>
                  <h3
                    style={row.isActive ? styles.rowName : styles.rowNameMuted}
                  >
                    {row.name}
                  </h3>
                  <div style={styles.badges}>
                    {row.isDefault ? (
                      <span style={styles.badgeDefault}>پیش‌فرض</span>
                    ) : null}
                    {row.isActive ? null : (
                      <span style={styles.badgeOff}>غیرفعال</span>
                    )}
                  </div>
                </div>

                <div style={styles.metrics}>
                  <div style={styles.metric}>
                    <span style={styles.metricLabel}>مالیات</span>
                    <span style={styles.metricValue}>
                      {percentLabel(row.ratePercent)}
                    </span>
                  </div>
                  <div style={styles.metric}>
                    <span style={styles.metricLabel}>عوارض</span>
                    <span style={styles.metricValue}>
                      {percentLabel(row.dutyRatePercent)}
                    </span>
                  </div>
                  <div style={styles.metric}>
                    <span style={styles.metricLabel}>جمع</span>
                    <span
                      style={
                        row.isActive
                          ? styles.metricValueTotal
                          : styles.metricValueMuted
                      }
                    >
                      {percentLabel(row.totalRatePercent)}
                    </span>
                  </div>
                  <div style={styles.metric}>
                    <span style={styles.metricLabel}>اسناد</span>
                    <span style={styles.metricValue}>
                      {toPersianDigits(String(row.quotationCount))}
                    </span>
                  </div>
                </div>

                <div style={styles.rowActions}>
                  {isConfirming ? (
                    <>
                      <span style={styles.confirmText}>
                        «{row.name}» حذف شود؟
                      </span>
                      <button
                        type="button"
                        style={actionStyle(styles.dangerButton)}
                        disabled={busy}
                        onClick={() => void onDelete(row)}
                      >
                        تأیید حذف
                      </button>
                      <button
                        type="button"
                        style={actionStyle(styles.ghostButton)}
                        disabled={busy}
                        onClick={() => setConfirmingDeleteId(null)}
                      >
                        انصراف
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        style={actionStyle(styles.ghostButton)}
                        disabled={busy}
                        onClick={() => updateEditor(editorFor(row))}
                      >
                        ویرایش
                      </button>
                      {row.isActive && !row.isDefault ? (
                        <button
                          type="button"
                          style={actionStyle(styles.ghostButton)}
                          disabled={busy}
                          onClick={() => void onSetDefault(row)}
                        >
                          انتخاب پیش‌فرض
                        </button>
                      ) : null}
                      {row.isActive && !row.isDefault ? (
                        <button
                          type="button"
                          style={actionStyle(styles.ghostButton)}
                          disabled={busy}
                          onClick={() => void onDeactivate(row)}
                        >
                          غیرفعال
                        </button>
                      ) : null}
                      {row.isActive ? null : (
                        <button
                          type="button"
                          style={actionStyle(styles.ghostButton)}
                          disabled={busy}
                          onClick={() => void onActivate(row)}
                        >
                          فعال‌سازی
                        </button>
                      )}
                      {row.isActive &&
                      !row.isDefault &&
                      row.quotationCount === 0 ? (
                        <button
                          type="button"
                          style={actionStyle(styles.ghostDanger)}
                          disabled={busy}
                          onClick={() => void onDelete(row)}
                        >
                          حذف
                        </button>
                      ) : null}
                    </>
                  )}
                </div>

                {hint === null || isConfirming ? null : (
                  <p style={styles.rowHint}>{hint}</p>
                )}
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

      <section style={editorStyle}>
        {editor === null ? null : (
          <>
            <h3 style={styles.sectionTitle}>
              {editor.recordId === null
                ? 'سیاست مالیات جدید'
                : 'ویرایش سیاست مالیات'}
            </h3>
            <div style={styles.fields}>
              <label style={styles.label}>
                نام سیاست
                <input
                  style={styles.input}
                  value={editor.name}
                  aria-invalid={editorError === null ? 'false' : 'true'}
                  aria-describedby={
                    editorError === null ? undefined : 'tax-policy-editor-error'
                  }
                  placeholder="مثلاً مالیات بر ارزش افزوده ۱۰٪"
                  onChange={(event) =>
                    updateEditor({ ...editor, name: event.target.value })
                  }
                />
              </label>
              <label style={styles.label}>
                درصد مالیات
                <input
                  style={
                    rateDisplayIssue === null
                      ? styles.input
                      : styles.inputInvalid
                  }
                  value={editor.ratePercentText}
                  inputMode="decimal"
                  aria-invalid={rateDisplayIssue !== null}
                  placeholder="۶٫۵"
                  onChange={(event) =>
                    updateEditor({
                      ...editor,
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
                درصد عوارض
                <input
                  style={
                    dutyDisplayIssue === null
                      ? styles.input
                      : styles.inputInvalid
                  }
                  value={editor.dutyPercentText}
                  inputMode="decimal"
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
                  <span role="alert" style={styles.fieldError}>
                    {dutyDisplayIssue}
                  </span>
                )}
              </label>
            </div>
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>جمع (مالیات + عوارض)</span>
              <output style={styles.totalValue}>
                {sumPercentText(editor.ratePercentText, editor.dutyPercentText)}
              </output>
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
            <div style={styles.actions}>
              <button
                type="button"
                style={actionStyle(styles.primaryButton)}
                disabled={busy}
                onClick={() => void onSave()}
              >
                {busy ? 'در حال ذخیره…' : 'ذخیره سیاست'}
              </button>
              <button
                type="button"
                style={actionStyle(styles.secondaryButton)}
                disabled={busy}
                onClick={() => updateEditor(null)}
              >
                انصراف
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

// Twenty's list surface: hairline dividers, one accent for the computed total, and a
// single tinted row for the active default. No per-row card, no shadow, no strikethrough
// on an inactive policy — an inactive rate is paused, not void.
const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 20,
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
    gap: 12,
    paddingBottom: 12,
    borderBottom: '1px solid #f1f1f1',
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    flex: '1 1 240px',
    minWidth: 0,
  },
  title: { margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.45 },
  subtitle: { margin: 0, fontSize: 12, color: '#666666', lineHeight: 1.7 },
  list: {
    display: 'flex',
    flexDirection: 'column',
    margin: 0,
    padding: 0,
    listStyle: 'none',
    border: '1px solid #f1f1f1',
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px 16px',
    padding: '10px 14px',
    background: '#ffffff',
  },
  rowDefault: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px 16px',
    padding: '10px 14px',
    background: '#f5f7ff',
    boxShadow: 'inset -3px 0 0 0 #4c6ef5',
  },
  rowInactive: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px 16px',
    padding: '10px 14px',
    background: '#fcfcfc',
  },
  rowDivider: { borderTop: '1px solid #f1f1f1' },
  identity: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: '1 1 190px',
    minWidth: 0,
  },
  rowName: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: '#333333',
    overflowWrap: 'anywhere',
  },
  rowNameMuted: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: '#666666',
    overflowWrap: 'anywhere',
  },
  badges: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  badgeDefault: {
    fontSize: 11,
    lineHeight: 1.7,
    color: '#14532d',
    background: '#dcfce7',
    borderRadius: 999,
    padding: '0 8px',
    whiteSpace: 'nowrap',
  },
  badgeOff: {
    fontSize: 11,
    lineHeight: 1.7,
    color: '#7f1d1d',
    background: '#fee2e2',
    borderRadius: 999,
    padding: '0 8px',
    whiteSpace: 'nowrap',
  },
  metrics: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '4px 18px',
  },
  metric: { display: 'flex', flexDirection: 'column', minWidth: 44 },
  metricLabel: { fontSize: 10, color: '#8a8a8a', lineHeight: 1.6 },
  metricValue: {
    fontSize: 13,
    fontWeight: 600,
    color: '#333333',
    lineHeight: 1.5,
    fontVariantNumeric: 'tabular-nums',
  },
  metricValueTotal: {
    fontSize: 13,
    fontWeight: 700,
    color: '#3b5bdb',
    lineHeight: 1.5,
    fontVariantNumeric: 'tabular-nums',
  },
  metricValueMuted: {
    fontSize: 13,
    fontWeight: 700,
    color: '#8a8a8a',
    lineHeight: 1.5,
    fontVariantNumeric: 'tabular-nums',
  },
  rowActions: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
    marginInlineStart: 'auto',
  },
  rowHint: {
    flexBasis: '100%',
    margin: 0,
    fontSize: 11,
    color: '#666666',
    lineHeight: 1.7,
  },
  rowError: {
    flexBasis: '100%',
    margin: 0,
    fontSize: 12,
    color: '#b42318',
    lineHeight: 1.7,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    border: '1px dashed #d6d6d6',
    borderRadius: 8,
    background: '#fcfcfc',
  },
  emptyText: { margin: 0, fontSize: 13, color: '#333333' },
  emptyActions: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  editor: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    border: '1px solid #ebebeb',
    borderRadius: 8,
    background: '#fcfcfc',
  },
  hidden: { display: 'none' },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 600 },
  fields: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 12,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 12,
    color: '#666666',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    height: 32,
    padding: '0 10px',
    borderRadius: 8,
    border: '1px solid #d6d6d6',
    fontSize: 13,
    color: '#333333',
    background: '#ffffff',
  },
  inputInvalid: {
    width: '100%',
    boxSizing: 'border-box',
    height: 32,
    padding: '0 10px',
    borderRadius: 8,
    border: '1px solid #e0a3a1',
    fontSize: 13,
    color: '#333333',
    background: '#ffffff',
  },
  totalRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 6,
    background: '#f4f4f4',
  },
  totalLabel: { fontSize: 12, color: '#666666' },
  totalValue: {
    fontSize: 14,
    fontWeight: 700,
    color: '#3b5bdb',
    fontVariantNumeric: 'tabular-nums',
  },
  meta: { margin: 0, fontSize: 11, color: '#666666', lineHeight: 1.7 },
  fieldError: { margin: 0, fontSize: 12, color: '#b42318', lineHeight: 1.6 },
  pageError: {
    margin: 0,
    padding: '8px 10px',
    borderRadius: 6,
    background: '#fdecea',
    color: '#b42318',
    fontSize: 12,
    lineHeight: 1.7,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  primaryButton: {
    height: 32,
    padding: '0 14px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: '#333333',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  secondaryButton: {
    height: 32,
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid #d6d6d6',
    background: '#ffffff',
    color: '#333333',
    fontSize: 13,
    cursor: 'pointer',
  },
  dangerButton: {
    height: 28,
    padding: '0 10px',
    borderRadius: 6,
    border: '1px solid transparent',
    background: '#b42318',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  ghostButton: {
    height: 28,
    padding: '0 8px',
    borderRadius: 6,
    border: '1px solid transparent',
    background: 'transparent',
    color: '#4c4c4c',
    fontSize: 12,
    cursor: 'pointer',
  },
  ghostDanger: {
    height: 28,
    padding: '0 8px',
    borderRadius: 6,
    border: '1px solid transparent',
    background: 'transparent',
    color: '#b42318',
    fontSize: 12,
    cursor: 'pointer',
  },
  confirmText: { fontSize: 12, color: '#b42318', whiteSpace: 'nowrap' },
};
