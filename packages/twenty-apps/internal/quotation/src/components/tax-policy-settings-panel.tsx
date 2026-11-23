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
  isActive: boolean;
  isDefault: boolean;
  isExempt: boolean;
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
  isDefault: false,
  isExempt: false,
});

const editorFor = (row: TaxPolicyRow): EditorState => ({
  recordId: row.recordId,
  name: row.name,
  ratePercentText: row.ratePercent,
  dutyPercentText: row.dutyRatePercent,
  isActive: row.isActive,
  isDefault: row.isDefault,
  isExempt: row.isExempt,
});

// The total is computed, never typed: two values that cannot be added are shown as
// "—" instead of a number the server would refuse anyway.
const sumPercentText = (taxText: string, dutyText: string): string => {
  const tax = parsePercentToBasisPoints(taxText);
  const duty = dutyText.trim() === ''
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

export const TaxPolicySettingsPanel = () => {
  const [rows, setRows] = useState<TaxPolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const applyResponse = useCallback(
    (data: Record<string, unknown>, fallbackMessage: string) => {
      if (data.success !== true) {
        setError(toPersianUiMessage(data.message, FALLBACK_ERROR));
        return false;
      }

      setRows(readRows(data));
      setError(null);
      enqueueSnackbar({
        message: toPersianUiMessage(data.message, fallbackMessage),
        variant: 'success',
      });

      return true;
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

  const runAction = async (
    body: Record<string, unknown>,
    fallbackMessage: string,
  ): Promise<boolean> => {
    setBusy(true);

    try {
      const response = await callAppRoute(TAX_POLICIES_ROUTE, body);

      return applyResponse(response.data, fallbackMessage);
    } catch (actionFailure) {
      console.error('tax-policy-settings: action failed', actionFailure);
      setError('ارتباط با سرور برقرار نشد');

      return false;
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (editor === null) {
      return;
    }

    const saved = await runAction(
      {
        action: 'save',
        recordId: editor.recordId,
        name: editor.name,
        ratePercentText: editor.ratePercentText,
        dutyRatePercentText: editor.dutyPercentText,
        isActive: editor.isActive,
        isDefault: editor.isDefault,
        isExempt: editor.isExempt,
      },
      'سیاست مالیات ذخیره شد',
    );

    if (saved) {
      setEditor(null);
    }
  };

  const onSetDefault = async (row: TaxPolicyRow) => {
    await runAction(
      { action: 'set-default', recordId: row.recordId },
      'سیاست پیش‌فرض تغییر کرد',
    );
  };

  const onDeactivate = async (row: TaxPolicyRow) => {
    await runAction(
      { action: 'deactivate', recordId: row.recordId },
      'سیاست مالیات غیرفعال شد',
    );
  };

  // The initial 9% policy is created only here, by an explicit admin action. It is
  // idempotent on the server, so a second press cannot create a duplicate.
  const onBootstrap = async () => {
    await runAction({ action: 'bootstrap' }, 'سیاست پایه آماده شد');
  };

  const editorStyle: CSSProperties = editor === null ? styles.hidden : styles.editor;

  return (
    <div style={styles.root} dir="rtl">
      <header style={styles.header}>
        <h2 style={styles.title}>مالیات و عوارض</h2>
        <p style={styles.hint}>
          نرخ مالیات از اینجا تعیین می‌شود، نه از کد. سیاست پیش‌فرض شروع پیش‌فاکتور
          جدید است و اسناد صادرشده نرخ زمان صدور خود را نگه می‌دارند.
        </p>
      </header>

      {error === null ? null : <p style={styles.error}>{error}</p>}
      {loading ? <p style={styles.meta}>در حال خواندن سیاست‌ها…</p> : null}

      {loading ? null : (
        <section style={styles.list}>
          {rows.length === 0 ? (
            <p style={styles.meta}>
              هنوز سیاستی تعریف نشده است. می‌توانید سیاست پایهٔ ۹٪ را بسازید یا
              سیاست دلخواه خود را اضافه کنید.
            </p>
          ) : (
            rows.map((row) => (
              <div
                key={row.recordId}
                style={row.isActive ? styles.row : styles.rowInactive}
              >
                <div style={styles.rowMain}>
                  <strong style={styles.rowName}>{row.name}</strong>
                  <span style={styles.rate}>
                    {percentLabel(row.totalRatePercent)}
                  </span>
                  <span style={styles.rateSplit}>
                    مالیات {percentLabel(row.ratePercent)} + عوارض{' '}
                    {percentLabel(row.dutyRatePercent)}
                  </span>
                  <div style={styles.badges}>
                    {row.isDefault ? (
                      <span style={styles.badgeDefault}>پیش‌فرض</span>
                    ) : null}
                    {row.isExempt ? (
                      <span style={styles.badge}>معاف</span>
                    ) : null}
                    {row.isActive ? null : (
                      <span style={styles.badgeOff}>غیرفعال</span>
                    )}
                    {row.quotationCount > 0 ? (
                      <span style={styles.badge}>
                        در {row.quotationCount} سند
                      </span>
                    ) : null}
                  </div>
                </div>
                <div style={styles.rowActions}>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    disabled={busy}
                    onClick={() => setEditor(editorFor(row))}
                  >
                    ویرایش
                  </button>
                  {row.isDefault || !row.isActive ? null : (
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      disabled={busy}
                      onClick={() => void onSetDefault(row)}
                    >
                      پیش‌فرض
                    </button>
                  )}
                  {row.isActive ? (
                    <button
                      type="button"
                      style={styles.linkButton}
                      disabled={busy}
                      onClick={() => void onDeactivate(row)}
                    >
                      غیرفعال
                    </button>
                  ) : (
                    <button
                      type="button"
                      style={styles.linkButton}
                      disabled={busy}
                      onClick={() => setEditor(editorFor(row))}
                    >
                      فعال‌سازی
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {rows.length === 0 && !loading && editor === null ? (
        <div style={styles.actions}>
          <button
            type="button"
            style={styles.primaryButton}
            disabled={busy}
            onClick={() => void onBootstrap()}
          >
            {busy ? 'در حال آماده‌سازی…' : 'ساخت سیاست پایهٔ ۹٪'}
          </button>
          <button
            type="button"
            style={styles.secondaryButton}
            disabled={busy}
            onClick={() => setEditor(emptyEditor())}
          >
            افزودن سیاست مالیات
          </button>
        </div>
      ) : null}

      {rows.length > 0 && editor === null ? (
        <button
          type="button"
          style={styles.secondaryButton}
          disabled={busy}
          onClick={() => setEditor(emptyEditor())}
        >
          افزودن سیاست مالیات
        </button>
      ) : null}

      <section style={editorStyle}>
        {editor === null ? null : (
          <>
            <h3 style={styles.sectionTitle}>
              {editor.recordId === null ? 'سیاست مالیات جدید' : 'ویرایش سیاست مالیات'}
            </h3>
            <label style={styles.label}>
              نام سیاست
              <input
                style={styles.input}
                value={editor.name}
                placeholder="مثلاً مالیات بر ارزش افزوده ۱۰٪"
                onChange={(event) =>
                  setEditor({ ...editor, name: event.target.value })
                }
              />
            </label>
            <label style={styles.label}>
              درصد مالیات
              <input
                style={styles.input}
                value={editor.ratePercentText}
                placeholder="۶ یا ۶٫۵ — صفر یعنی بدون مالیات"
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    ratePercentText: event.target.value,
                  })
                }
              />
            </label>
            <label style={styles.label}>
              درصد عوارض
              <input
                style={styles.input}
                value={editor.dutyPercentText}
                placeholder="۴ — خالی یا صفر یعنی بدون عوارض"
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    dutyPercentText: event.target.value,
                  })
                }
              />
            </label>
            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>جمع (مالیات + عوارض)</span>
              <output style={styles.totalValue}>
                {sumPercentText(editor.ratePercentText, editor.dutyPercentText)}
              </output>
            </div>
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={editor.isActive}
                onChange={(event) =>
                  setEditor({ ...editor, isActive: event.target.checked })
                }
              />
              فعال (در پیش‌فاکتور جدید قابل انتخاب)
            </label>
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={editor.isExempt}
                onChange={(event) =>
                  setEditor({ ...editor, isExempt: event.target.checked })
                }
              />
              معاف از مالیات (فقط با نرخ صفر)
            </label>
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={editor.isDefault}
                onChange={(event) =>
                  setEditor({ ...editor, isDefault: event.target.checked })
                }
              />
              سیاست پیش‌فرض
            </label>
            <div style={styles.actions}>
              <button
                type="button"
                style={styles.primaryButton}
                disabled={busy}
                onClick={() => void onSave()}
              >
                {busy ? 'در حال ذخیره…' : 'ذخیره سیاست'}
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                انصراف
              </button>
            </div>
            <p style={styles.meta}>
              سیاستی که در اسناد استفاده شده حذف نمی‌شود؛ فقط غیرفعال می‌شود تا
              اسناد قبلی معتبر بمانند.
            </p>
          </>
        )}
      </section>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 16,
    fontFamily: 'inherit',
    color: '#1a1a1a',
    background: '#fff',
    minHeight: 0,
  },
  header: { display: 'flex', flexDirection: 'column', gap: 6 },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  hint: { margin: 0, color: '#666', fontSize: 12, lineHeight: 1.8 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    background: '#f8fafc',
  },
  rowInactive: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    border: '1px dashed #cbd5e1',
    borderRadius: 10,
    background: '#f1f5f9',
    opacity: 0.75,
  },
  rowMain: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  rowName: { fontSize: 14 },
  rate: { fontSize: 14, fontWeight: 700, color: '#1d4ed8' },
  rateSplit: { fontSize: 11, color: '#475569' },
  totalRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 10px',
    border: '1px dashed #cbd5e1',
    borderRadius: 8,
    background: '#f8fafc',
  },
  totalLabel: { fontSize: 12, color: '#475569' },
  totalValue: { fontSize: 14, fontWeight: 700, color: '#1d4ed8' },
  badges: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  badge: {
    fontSize: 11,
    color: '#475569',
    background: '#e2e8f0',
    borderRadius: 6,
    padding: '2px 8px',
  },
  badgeDefault: {
    fontSize: 11,
    color: '#14532d',
    background: '#dcfce7',
    borderRadius: 6,
    padding: '2px 8px',
  },
  badgeOff: {
    fontSize: 11,
    color: '#7f1d1d',
    background: '#fee2e2',
    borderRadius: 6,
    padding: '2px 8px',
  },
  rowActions: { display: 'flex', alignItems: 'center', gap: 8 },
  editor: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
    border: '1px solid #c5cdd8',
    borderRadius: 10,
    background: '#fff',
  },
  hidden: { display: 'none' },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 650 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #d0d0d0',
    fontSize: 14,
    background: '#fff',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
  },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  meta: { margin: 0, fontSize: 11, color: '#777', lineHeight: 1.7 },
  error: { margin: 0, color: '#b42318', fontSize: 13 },
  primaryButton: {
    alignSelf: 'flex-start',
    background: '#1a1a1a',
    color: '#fff',
    border: 0,
    borderRadius: 8,
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: 13,
  },
  secondaryButton: {
    background: '#f5f5f5',
    color: '#1a1a1a',
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 12,
  },
  linkButton: {
    background: 'transparent',
    border: 0,
    color: '#b42318',
    cursor: 'pointer',
    padding: 0,
    fontSize: 12,
  },
};
