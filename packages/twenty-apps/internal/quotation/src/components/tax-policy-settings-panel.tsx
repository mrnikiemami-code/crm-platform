import {
  type CSSProperties,
  Fragment,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import { TAX_POLICIES_ROUTE, callAppRoute } from 'src/components/quotation-api';
import {
  formatExactDecimalForPeople,
  toPersianDigits,
} from 'src/domain/money/display-format';
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

// The same fraction separator the money format uses, so a rate never mixes an ASCII
// dot into a screen whose placeholder and error copy already use the momayyez.
const percentLabel = (value: string): string =>
  `${formatExactDecimalForPeople(value)}٪`;

// Display only: a policy name is stored exactly as the operator typed it, but a card
// that shows Persian digits in its rates must not show Latin digits in its own title.
const displayPolicyName = (name: string): string => toPersianDigits(name);

const FALLBACK_ERROR = 'ذخیرهٔ تنظیمات مالیات انجام نشد؛ دوباره تلاش کنید.';

const UNSAVED_EDITOR_MESSAGE =
  'تغییرات ذخیره‌نشده دارید؛ ابتدا ذخیره یا انصراف کنید.';

const sameEditor = (left: EditorState, right: EditorState): boolean =>
  left.recordId === right.recordId &&
  left.name === right.name &&
  left.ratePercentText === right.ratePercentText &&
  left.dutyPercentText === right.dutyPercentText &&
  left.isActive === right.isActive;

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
  // Two kinds of message share the editor's message slot: an instruction (the editor
  // holds unsaved work) is a status, a save or transport failure is an alert. A name
  // problem is its own field's, so the name input never answers for a rate error.
  const [editorNotice, setEditorNotice] = useState<{
    kind: 'instruction' | 'failure';
    message: string;
  } | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  // A refusal belongs to the row that caused it ("used in 8 documents") and a delete
  // asks for a second press, so the row the operator acted on is the one that answers.
  const [rowIssue, setRowIssue] = useState<{
    recordId: string;
    kind: 'notice' | 'error';
    message: string;
  } | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  // The editor's opening snapshot, so "has the operator typed anything" is a fact
  // rather than a guess. Cleared whenever the editor closes.
  const [editorBaseline, setEditorBaseline] = useState<EditorState | null>(null);

  const updateEditor = useCallback((next: EditorState | null) => {
    setEditor(next);
    setEditorNotice(null);
    setNameError(null);
  }, []);

  // Closing releases every surface the editor owned: its message, the name's error and
  // a delete confirmation a row may have been left in.
  const closeEditor = () => {
    updateEditor(null);
    setEditorBaseline(null);
    setConfirmingDeleteId(null);
  };

  // Opening another row's editor while this one holds typed numbers would throw them
  // away, and the other rows' controls stay one click away. The refusal is written on
  // the row that was pressed, which is where the operator is looking, not in an editor
  // card further up the list. No dialog: this task needs neither interruption nor
  // protected focus.
  const openEditor = (next: EditorState | null) => {
    if (next === null) {
      closeEditor();

      return;
    }

    setConfirmingDeleteId(null);

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
    setConfirmingDeleteId(null);

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
      setError('فهرست سیاست‌های مالیات خوانده نشد؛ دوباره تلاش کنید.');
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

    // The client check runs before the round trip so Enter reports the bad field in
    // place instead of coming back with a server sentence.
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
      // A sentence already painted under the field or below the pair is not repeated in
      // the editor's message slot; that slot exists for what has no home yet, such as an
      // untouched empty rate.
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
    setConfirmingDeleteId(null);
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
    setConfirmingDeleteId(null);
    setRowIssue(null);

    const failure = await runAction(
      { action: 'deactivate', recordId: row.recordId },
      'سیاست مالیات غیرفعال شد',
    );

    if (failure !== null) {
      setRowIssue({ recordId: row.recordId, kind: 'error', message: failure });
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
      setRowIssue({ recordId: row.recordId, kind: 'error', message: failure });
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
      setRowIssue({ recordId: row.recordId, kind: 'error', message: failure });
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

  // The designer's row is a card whose metrics answer one question ("what does this
  // policy cost") and whose actions are physically separated from those numbers. The
  // usage count is contextual, so it sits under the name instead of competing with the
  // rates as a fourth figure — and the sentence that explains a blocked control is that
  // same visible line, because a description targeted from a disabled button cannot be
  // reached by keyboard or screen reader.
  const usageLine = (row: TaxPolicyRow): string => {
    const count =
      row.quotationCount === 0
        ? 'در هیچ سندی استفاده نشده است'
        : `در ${toPersianDigits(String(row.quotationCount))} سند استفاده شده است`;

    if (row.isDefault) {
      return `${count}؛ سیاست پیش‌فرض غیرفعال یا حذف نمی‌شود.`;
    }

    return row.quotationCount === 0 ? count : `${count}؛ حذف‌شدنی نیست.`;
  };

  const totalOf = (row: TaxPolicyRow): string => percentLabel(row.totalRatePercent);

  const renderEditor = (current: EditorState) => {
    const editingRow =
      current.recordId === null
        ? null
        : (rows.find((row) => row.recordId === current.recordId) ?? null);

    return (
      // A real form, so Enter in any field saves. The local issue check runs first and
      // the browser's own bubble validation is off, because the panel's messages are
      // written where the field is, not in a UA tooltip.
      <form
        className="tax-editor-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();

          if (busy) {
            return;
          }

          void onSave();
        }}
      >
        <div style={styles.editorHeader}>
          <h3 style={styles.editorTitle}>
            {current.recordId === null
              ? 'سیاست مالیات و عوارض جدید'
              : 'ویرایش سیاست'}
          </h3>
          <div style={styles.editorHeaderActions}>
            {/* The pill sits beside the actions, not inside the heading: a heading that
                changes its own name with the dirty flag reads as a badge stuck to a
                button once a screen reader announces it. */}
            {editorIsDirty ? (
              <span role="status" style={styles.unsavedMark}>
                ذخیره‌نشده
              </span>
            ) : null}
            <button
              type="button"
              className="tax-btn"
              disabled={busy}
              onClick={() => closeEditor()}
            >
              انصراف
            </button>
            <button
              type="submit"
              className="tax-btn tax-btn-primary"
              disabled={busy}
            >
              {busy ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
            </button>
          </div>
        </div>

        <div className="tax-fields">
          <div className="tax-field-wide" style={styles.field}>
            <label htmlFor="tax-policy-name" style={styles.label}>
              نام سیاست
            </label>
            <input
              id="tax-policy-name"
              style={nameError === null ? styles.input : styles.inputInvalid}
              value={current.name}
              aria-invalid={nameError !== null}
              aria-describedby={
                nameError === null ? undefined : 'tax-policy-name-error'
              }
              placeholder="مثلاً مالیات بر ارزش افزوده"
              onChange={(event) => {
                setNameError(null);
                updateEditor({ ...current, name: event.target.value });
              }}
            />
            {nameError === null ? null : (
              <span
                id="tax-policy-name-error"
                role="alert"
                style={styles.fieldError}
              >
                {nameError}
              </span>
            )}
          </div>
          {/* Each field owns its message: the error is a sibling of the control and is
              named by aria-describedby, so it is announced as a description rather than
              becoming part of the input's own name. */}
          <div style={styles.field}>
            <label htmlFor="tax-policy-rate" style={styles.label}>
              مالیات (٪)
            </label>
            <input
              id="tax-policy-rate"
              style={
                rateDisplayIssue === null ? styles.input : styles.inputInvalid
              }
              value={current.ratePercentText}
              inputMode="decimal"
              aria-invalid={rateDisplayIssue !== null}
              aria-describedby={
                rateDisplayIssue === null
                  ? 'tax-policy-exempt-legend'
                  : 'tax-policy-rate-error'
              }
              placeholder="۶٫۵"
              onChange={(event) =>
                updateEditor({
                  ...current,
                  ratePercentText: event.target.value,
                })
              }
            />
            {rateDisplayIssue === null ? null : (
              <span
                id="tax-policy-rate-error"
                role="alert"
                style={styles.fieldError}
              >
                {rateDisplayIssue}
              </span>
            )}
          </div>
          <div style={styles.field}>
            <label htmlFor="tax-policy-duty" style={styles.label}>
              عوارض (٪)
            </label>
            <input
              id="tax-policy-duty"
              style={
                dutyDisplayIssue === null ? styles.input : styles.inputInvalid
              }
              value={current.dutyPercentText}
              inputMode="decimal"
              aria-invalid={dutyDisplayIssue !== null}
              aria-describedby={
                dutyDisplayIssue === null
                  ? 'tax-policy-exempt-legend'
                  : 'tax-policy-duty-error'
              }
              placeholder="۰"
              onChange={(event) =>
                updateEditor({
                  ...current,
                  dutyPercentText: event.target.value,
                })
              }
            />
            {dutyDisplayIssue === null ? null : (
              <span
                id="tax-policy-duty-error"
                role="alert"
                style={styles.fieldError}
              >
                {dutyDisplayIssue}
              </span>
            )}
          </div>
        </div>

        {/* The exemption rule belongs beside the two fields it explains, not at the
            bottom of the card under the save actions. */}
        <p id="tax-policy-exempt-legend" style={styles.meta}>
          هر دو نرخ صفر یعنی معاف از مالیات.
        </p>

        {/* The footer carries the two facts the operator needs while typing: whether
            this rate is still safely deletable, and what the two rates add up to. */}
        <div style={styles.editorFooter}>
          <p style={styles.editorFooterInfo}>
            {editingRow === null
              ? 'در هیچ سندی استفاده نشده است'
              : usageLine(editingRow)}
          </p>
          <div style={styles.editorTotalBlock}>
            <span style={styles.totalLabel}>جمع محاسباتی:</span>
            <output style={styles.totalValueLg}>
              {sumPercentText(current.ratePercentText, current.dutyPercentText)}
            </output>
          </div>
        </div>

        {/* One message about the pair, and one about the whole editor. A sentence that
            is already painted under the field it belongs to is never painted twice. */}
        {combinedFieldIssue === null ? null : (
          <p role="alert" style={styles.fieldError}>
            {combinedFieldIssue}
          </p>
        )}
        {editorNotice === null ? null : (
          <p
            id="tax-policy-editor-notice"
            role={editorNotice.kind === 'instruction' ? 'status' : 'alert'}
            style={
              editorNotice.kind === 'instruction'
                ? styles.notice
                : styles.fieldError
            }
          >
            {editorNotice.message}
          </p>
        )}
      </form>
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
        {rows.length === 0 || error !== null ? null : (
          <button
            type="button"
            className="tax-add tax-btn tax-btn-primary"
            aria-label="افزودن سیاست"
            disabled={busy}
            onClick={() => openEditor(emptyEditor())}
          >
            <span aria-hidden="true" style={styles.addButtonPlus}>
              +
            </span>
            <span className="tax-add-label">افزودن سیاست</span>
          </button>
        )}
      </header>

      {error === null ? null : (
        <div style={styles.pageErrorRow}>
          <p role="alert" style={styles.pageError}>
            {error}
          </p>
          {/* A failed read used to end with "reopen the page". The one next action is
              the read itself. */}
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

      {loading ? (
        <p role="status" style={styles.meta}>
          در حال خواندن سیاست‌ها…
        </p>
      ) : null}

      {/* A failure is not an empty catalog: the bootstrap action is hidden while the
          read is broken, so the screen cannot invite a write it has not verified. */}
      {loading ? null : error !== null ? null : rows.length === 0 ? (
        <section style={styles.empty}>
          <p style={styles.emptyText}>
            هنوز سیاست مالیات و عوارضی ثبت نشده است.
          </p>
          <div style={styles.emptyActions}>
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
              افزودن سیاست
            </button>
          </div>
        </section>
      ) : (
        <ul style={styles.list} aria-busy={busy}>
          {editor !== null && editor.recordId === null ? (
            <li key="new-policy" id="tax-editor-new" className="tax-editor">
              {renderEditor(editor)}
            </li>
          ) : null}

          {rows.map((row) => {
            const isConfirming = confirmingDeleteId === row.recordId;
            const rowEditorOpen = editor !== null && editingRowId === row.recordId;
            const nameText = displayPolicyName(row.name);

            // The editor is the row's next sibling, not its replacement: the pressed
            // `ویرایش` button is never unmounted, so the browser never moves focus to
            // <body>, and no imperative focus call is needed in the host at all.
            return (
              <Fragment key={`${row.recordId}:${row.isDefault ? 'default' : 'standard'}`}>
                <li
                  className={row.isActive ? 'tax-row' : 'tax-row tax-row-inactive'}
                >
                  <div style={styles.identity}>
                    <div style={styles.nameLine}>
                      <h3
                        style={
                          row.isActive ? styles.rowName : styles.rowNameMuted
                        }
                      >
                        {nameText}
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

                  <div className="tax-metrics">
                    <div style={styles.totalBlock}>
                      <span style={styles.metricLabel}>نرخ کل</span>
                      <span
                        className="tax-total"
                        style={
                          row.isActive
                            ? styles.totalValue
                            : styles.totalValueMuted
                        }
                      >
                        {row.isExempt ? 'معاف' : totalOf(row)}
                      </span>
                    </div>
                    <div style={styles.formulaChip}>
                      <span>مالیات: {percentLabel(row.ratePercent)}</span>
                      <span style={styles.formulaDivider} aria-hidden="true">
                        ·
                      </span>
                      <span>عوارض: {percentLabel(row.dutyRatePercent)}</span>
                    </div>
                  </div>

                  <div className="tax-row-actions">
                    {isConfirming ? (
                      <div className="tax-confirm">
                        <span
                          className="tax-confirm-text"
                          role="status"
                          style={styles.confirmText}
                        >
                          «{nameText}» حذف شود؟
                        </span>
                        <button
                          type="button"
                          className="tax-btn tax-btn-danger-solid"
                          disabled={busy}
                          onClick={() => void onDelete(row)}
                        >
                          تأیید حذف
                        </button>
                        <button
                          type="button"
                          className="tax-btn"
                          disabled={busy}
                          onClick={() => setConfirmingDeleteId(null)}
                        >
                          انصراف
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* One action set per row; only enablement changes. A control
                            that vanishes reads as a permission change, and an inactive
                            policy with no delete forced reactivate-then-delete. */}
                        <div className="tax-actions-main">
                          {row.isActive && !row.isDefault ? (
                            <button
                              type="button"
                              className="tax-btn"
                              aria-label={`پیش‌فرض — ${nameText}`}
                              disabled={busy || rowEditorOpen}
                              onClick={() => void onSetDefault(row)}
                            >
                              پیش‌فرض
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="tax-btn"
                            aria-label={`ویرایش — ${nameText}`}
                            // String, not boolean: the host serialises a true attribute to an
                            // empty string, which assistive tech does not read as expanded.
                            aria-expanded={rowEditorOpen ? 'true' : 'false'}
                            aria-controls={`tax-editor-${row.recordId}`}
                            // The toggle must stay enabled even while its own editor
                            // is open: a disabled control the operator just pressed
                            // blurs itself and drops focus on the document body.
                            disabled={busy}
                            onClick={() =>
                              rowEditorOpen
                                ? closeEditor()
                                : openEditor(editorFor(row))
                            }
                          >
                            {rowEditorOpen ? 'بستن' : 'ویرایش'}
                          </button>
                          {row.isActive ? (
                            <button
                              type="button"
                              className="tax-btn"
                              aria-label={`غیرفعال‌سازی — ${nameText}`}
                              disabled={busy || row.isDefault || rowEditorOpen}
                              onClick={() => void onDeactivate(row)}
                            >
                              غیرفعال‌سازی
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="tax-btn"
                              aria-label={`فعال‌سازی — ${nameText}`}
                              disabled={busy || rowEditorOpen}
                              onClick={() => void onActivate(row)}
                            >
                              فعال‌سازی
                            </button>
                          )}
                        </div>
                        {/* Delete is isolated from the three set-and-edit controls and,
                            on a phone, keeps its own position instead of moving into a
                            cell that means something else on the card beside it. */}
                        <div className="tax-actions-danger">
                          <button
                            type="button"
                            className="tax-btn tax-btn-danger"
                            aria-label={`حذف — ${nameText}`}
                            disabled={
                              busy ||
                              row.isDefault ||
                              row.quotationCount > 0 ||
                              rowEditorOpen
                            }
                            onClick={() => setConfirmingDeleteId(row.recordId)}
                          >
                            حذف
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {rowIssue?.recordId === row.recordId ? (
                    <p
                      role={rowIssue.kind === 'notice' ? 'status' : 'alert'}
                      style={
                        rowIssue.kind === 'notice'
                          ? styles.rowNotice
                          : styles.rowError
                      }
                    >
                      {rowIssue.message}
                    </p>
                  ) : null}
                </li>

                {rowEditorOpen ? (
                  <li
                    id={`tax-editor-${row.recordId}`}
                    className="tax-editor"
                  >
                    {renderEditor(editor)}
                  </li>
                ) : null}
              </Fragment>
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
/* Three slots per row: identity (which takes the slack), the rate pair, the actions.
   Slack inside the identity column keeps a long policy name beside its number instead
   of leaving a void that makes the card read as three unrelated islands. */
.tax-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  column-gap: 32px;
  row-gap: 12px;
  padding: 16px;
  border: 1px solid var(--t-color-gray6);
  border-radius: 8px;
  background: var(--t-color-gray2);
}
/* Paused, not void: the row steps to the page surface instead of being faded, because
   opacity pushed its own 12–16px labels under the 4.5:1 the product contracts for. */
.tax-row-inactive { background: var(--t-color-gray1); }
.tax-metrics {
  display: flex;
  align-items: center;
  gap: 24px;
  border-inline-start: 1px solid var(--t-color-gray6);
  padding-inline-start: 24px;
}
.tax-row-actions { display: flex; align-items: center; gap: 24px; }
.tax-actions-main { display: flex; align-items: center; gap: 8px; }
.tax-actions-danger { display: flex; align-items: center; }
.tax-confirm { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
/* The band only appears under the row it belongs to, and never under a sibling card. */
.tax-confirm-text { font-size: 13px; }
.tax-fields {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}
/* Height lives here, not in the inline styles, so the 767 px block can raise the
   targets to the 44 px the product contracts for. */
.tax-fields input { height: 32px; }
/* The form owns the editor's rhythm, and a 1100 px cap keeps the fields from being
   stretched into a corridor on a wide screen. */
.tax-editor-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 720px;
}
.tax-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 2px solid var(--t-color-blue9);
  border-radius: 8px;
  background: var(--t-color-gray1);
}
/* A row control is a control at rest: hairline, label, no fill. Danger is carried by the
   word, the isolated position and the second press — not by prefilled alarm colour. */
.tax-btn {
  height: 32px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--t-color-gray6);
  border-radius: 8px;
  background: transparent;
  color: var(--t-color-gray11);
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.tax-btn:hover:not(:disabled) {
  background: var(--t-color-gray4);
  color: var(--t-color-gray12);
}
.tax-btn-danger:hover:not(:disabled) {
  background: var(--t-color-red3);
  border-color: var(--t-color-red11);
  color: var(--t-color-red11);
}
.tax-btn-primary,
.tax-add {
  background: var(--t-color-gray12);
  border-color: var(--t-color-gray12);
  color: var(--t-color-gray1);
}
.tax-btn-primary:hover:not(:disabled),
.tax-add:hover:not(:disabled) {
  background: var(--t-color-gray11);
  border-color: var(--t-color-gray11);
}
.tax-btn-danger-solid {
  background: var(--t-color-red11);
  border-color: var(--t-color-red11);
  color: var(--t-color-gray1);
}
.tax-btn-danger-solid:hover:not(:disabled) {
  background: var(--t-color-red12);
  border-color: var(--t-color-red12);
}
.tax-btn:focus-visible,
.tax-fields input:focus-visible {
  outline: 2px solid var(--t-color-blue9);
  outline-offset: 1px;
}
/* Disabled is a state the eye can see: no fill, no hover, a quieter hairline and label,
   and never the danger red. It is declared after the filled variants so it wins. */
.tax-btn:disabled {
  background: var(--t-color-gray2);
  border-color: var(--t-color-gray5);
  color: var(--t-color-gray9);
  cursor: not-allowed;
}
.tax-add { height: 32px; padding: 0 16px; flex: 0 0 auto; }
@media (max-width: 767px) {
  .tax-row {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 12px;
    padding: 12px;
  }
  .tax-fields { grid-template-columns: 1fr 1fr; }
  .tax-field-wide { grid-column: 1 / -1; }
  /* The product contract asks for 44px targets on a phone; the designer's floor is 32. */
  .tax-btn, .tax-add { height: 44px; }
  .tax-metrics {
    justify-content: space-between;
    border-inline-start: none;
    border-top: 1px solid var(--t-color-gray6);
    padding-inline: 0;
    padding-block: 8px 0;
    gap: 12px;
  }
  /* Three fixed slots in the main group, and delete outside it: a control never moves
     cell between two adjacent cards, so a thumb aimed at delete cannot hit something
     else on the card beside it. */
  .tax-row-actions { gap: 8px; align-items: stretch; }
  .tax-actions-main {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    flex: 1 1 auto;
  }
  .tax-actions-danger { flex: 0 0 auto; margin-inline-start: 8px; }
  .tax-actions-main > .tax-btn,
  .tax-actions-danger > .tax-btn { width: 100%; }
  /* Three equal slots must also hold the longest label in the panel; 12px of side padding
     made that label bleed into the slot beside it. The 44px height still stands. */
  .tax-btn { padding: 0 4px; }
  .tax-confirm { flex-wrap: wrap; }
  .tax-add { width: 44px; padding: 0; }
  .tax-add-label { display: none; }
  .tax-fields input { height: 44px; }
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
    color: 'var(--t-color-gray12)',
    background: 'var(--t-color-gray1)',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    padding: '24px',
    borderBottom: '1px solid var(--t-color-gray6)',
    background: 'var(--t-color-gray2)',
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
    color: 'var(--t-color-gray11)',
    lineHeight: 1.8,
    maxWidth: 640,
  },
  addButtonPlus: { fontSize: 16, lineHeight: 1 },
  pageErrorRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    margin: '0 24px',
  },
  pageError: {
    margin: 0,
    padding: '8px 12px',
    borderRadius: 8,
    background: 'var(--t-color-red3)',
    color: 'var(--t-color-red11)',
    fontSize: 13,
    lineHeight: 1.8,
    flex: '1 1 240px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    margin: '0 auto',
    padding: '24px',
    width: '100%',
    maxWidth: 1100,
    boxSizing: 'border-box',
    listStyle: 'none',
  },
  identity: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  nameLine: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowName: {
    margin: 0,
    fontSize: 17,
    fontWeight: 600,
    color: 'var(--t-color-gray12)',
    overflowWrap: 'anywhere',
  },
  rowNameMuted: {
    margin: 0,
    fontSize: 17,
    fontWeight: 600,
    color: 'var(--t-color-gray11)',
    overflowWrap: 'anywhere',
  },
  badgeDefault: {
    fontSize: 12,
    lineHeight: 1.8,
    fontWeight: 500,
    color: 'var(--t-color-blue11)',
    background: 'var(--t-color-blue3)',
    borderRadius: 999,
    padding: '0 8px',
    whiteSpace: 'nowrap',
  },
  badgeOff: {
    fontSize: 12,
    lineHeight: 1.8,
    fontWeight: 500,
    color: 'var(--t-color-gray11)',
    background: 'var(--t-color-gray5)',
    border: '1px solid var(--t-color-gray6)',
    borderRadius: 999,
    padding: '0 8px',
    whiteSpace: 'nowrap',
  },
  usage: {
    margin: 0,
    fontSize: 12,
    color: 'var(--t-color-gray11)',
    lineHeight: 1.8,
    fontVariantNumeric: 'tabular-nums',
  },
  totalBlock: { display: 'flex', flexDirection: 'column', gap: 2 },
  metricLabel: { fontSize: 12, color: 'var(--t-color-gray11)', lineHeight: 1.8 },
  // The figure no longer outranks the policy it belongs to: colour alone carries the
  // accent, and the name is a step heavier than the number.
  totalValue: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--t-color-blue9)',
    lineHeight: 1.5,
    fontVariantNumeric: 'tabular-nums',
  },
  totalValueMuted: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--t-color-gray11)',
    lineHeight: 1.5,
    fontVariantNumeric: 'tabular-nums',
  },
  // A hairline, not a fill: the chip must not compete with the total beside it, and on a
  // phone it must not disappear into a filled metric band.
  formulaChip: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid var(--t-color-gray6)',
    fontSize: 14,
    color: 'var(--t-color-gray11)',
    fontVariantNumeric: 'tabular-nums',
  },
  formulaDivider: { color: 'var(--t-color-gray6)' },
  confirmText: {
    fontSize: 13,
    color: 'var(--t-color-red11)',
    lineHeight: 1.8,
  },
  rowError: {
    gridColumn: '1 / -1',
    margin: 0,
    fontSize: 12,
    color: 'var(--t-color-red11)',
    lineHeight: 1.8,
  },
  // An instruction is not a failure: same slot, quiet ink.
  rowNotice: {
    gridColumn: '1 / -1',
    margin: 0,
    fontSize: 12,
    color: 'var(--t-color-gray11)',
    lineHeight: 1.8,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
    margin: '24px',
    padding: 16,
    border: '1px dashed var(--t-color-gray6)',
    borderRadius: 8,
    background: 'var(--t-color-gray2)',
  },
  emptyText: { margin: 0, fontSize: 14, color: 'var(--t-color-gray12)' },
  emptyActions: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  editor: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    border: '2px solid var(--t-color-blue9)',
    borderRadius: 8,
    background: 'var(--t-color-gray1)',
  },
  editorHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 16,
    borderBottom: '1px solid var(--t-color-gray6)',
  },
  editorTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--t-color-gray12)' },
  // A state, not a control: squared corners and quiet ink keep it from reading as a
  // third button beside انصراف and ذخیره.
  unsavedMark: {
    fontSize: 12,
    lineHeight: 1.8,
    fontWeight: 500,
    color: 'var(--t-color-gray11)',
    backgroundColor: 'transparent',
    border: '1px solid var(--t-color-gray6)',
    borderRadius: 4,
    padding: '0 6px',
    whiteSpace: 'nowrap',
  },
  editorHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12,
    color: 'var(--t-color-gray11)',
  },
  notice: {
    margin: 0,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--t-color-gray6)',
    background: 'var(--t-color-gray2)',
    fontSize: 13,
    color: 'var(--t-color-gray11)',
    lineHeight: 1.8,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid var(--t-color-gray6)',
    fontSize: 14,
    color: 'var(--t-color-gray12)',
    background: 'var(--t-color-gray1)',
    fontFamily: 'inherit',
  },
  inputInvalid: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0 12px',
    borderRadius: 8,
    border: '1px solid var(--t-color-red11)',
    fontSize: 14,
    color: 'var(--t-color-gray12)',
    background: 'var(--t-color-gray1)',
    fontFamily: 'inherit',
  },
  fieldError: { margin: 0, fontSize: 12, color: 'var(--t-color-red11)', lineHeight: 1.7 },
  editorFooter: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    border: '1px solid var(--t-color-gray6)',
    background: 'var(--t-color-gray2)',
  },
  editorFooterInfo: {
    margin: 0,
    fontSize: 14,
    color: 'var(--t-color-gray11)',
    lineHeight: 1.8,
  },
  editorTotalBlock: { display: 'flex', alignItems: 'center', gap: 16 },
  totalLabel: { fontSize: 14, color: 'var(--t-color-gray11)' },
  totalValueLg: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--t-color-blue9)',
    fontVariantNumeric: 'tabular-nums',
  },
  meta: { margin: 0, fontSize: 12, color: 'var(--t-color-gray11)', lineHeight: 1.8 },
};
