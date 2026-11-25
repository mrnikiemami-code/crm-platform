import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import { callRoundingRulesNestAction } from 'src/components/quotation-api';
import { toPersianDigits } from 'src/domain/money/display-format';
import { parseStepRialsText } from 'src/domain/money/rounding-rule';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

type RoundingRuleRow = {
  recordId: string;
  code: string;
  name: string;
  stepRials: string;
  isActive: boolean;
  isDefault: boolean;
  quotationCount: number;
};

type EditorState = {
  recordId: string | null;
  name: string;
  stepRialsText: string;
  isActive: boolean;
};

const readRows = (data: Record<string, unknown>): RoundingRuleRow[] => {
  const rules = Array.isArray(data.rules) ? data.rules : [];

  return rules.flatMap((candidate) => {
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
        stepRials:
          typeof row.stepRials === 'string' ? row.stepRials : String(row.stepRials ?? ''),
        isActive: row.isActive !== false,
        isDefault: row.isDefault === true,
        quotationCount:
          typeof row.quotationCount === 'number' ? row.quotationCount : 0,
      },
    ];
  });
};

const emptyEditor = (): EditorState => ({
  recordId: null,
  name: '',
  stepRialsText: '',
  isActive: true,
});

const formatStepLabel = (stepRials: string): string =>
  `${toPersianDigits(stepRials)} ریال`;

// Compact CRUD for named rounding rules inside existing financial settings.
export const RoundingRuleSettingsSection = () => {
  const [opened, setOpened] = useState(false);
  const [rows, setRows] = useState<RoundingRuleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());

  const applyPayload = useCallback((data: Record<string, unknown>) => {
    setRows(readRows(data));
  }, []);

  const runAction = useCallback(
    async (body: Record<string, unknown>, successMessage: string) => {
      setBusy(true);
      setLoadError(null);

      try {
        const response = await callRoundingRulesNestAction(body);
        const data = response.data;

        if (data.success !== true) {
          const message = toPersianUiMessage(
            data.message,
            'عملیات قواعد رُند ناموفق بود',
          );
          setLoadError(message);
          enqueueSnackbar(message, { variant: 'error' });

          return false;
        }

        applyPayload(data);
        if (body.action !== 'list') {
          enqueueSnackbar(successMessage, { variant: 'success' });
        }

        return true;
      } catch {
        const message = 'ارتباط با سرور برقرار نشد';
        setLoadError(message);
        enqueueSnackbar(message, { variant: 'error' });

        return false;
      } finally {
        setBusy(false);
      }
    },
    [applyPayload],
  );

  useEffect(() => {
    if (!opened) {
      return;
    }

    void runAction({ action: 'list' }, 'فهرست قواعد رُند خوانده شد');
  }, [opened, runAction]);

  const onSave = async () => {
    const step = parseStepRialsText(editor.stepRialsText);

    if (editor.name.trim() === '') {
      enqueueSnackbar('نام قاعده رُند را وارد کنید', { variant: 'error' });

      return;
    }

    if (!step.ok) {
      enqueueSnackbar(step.refusal.detail, { variant: 'error' });

      return;
    }

    const ok = await runAction(
      {
        action: 'save',
        recordId: editor.recordId,
        name: editor.name.trim(),
        stepRialsText: step.value.toString(),
        isActive: editor.isActive,
        isDefault: false,
      },
      editor.recordId === null ? 'قاعده رُند ساخته شد' : 'قاعده رُند ذخیره شد',
    );

    if (ok) {
      setEditor(emptyEditor());
    }
  };

  return (
    <section
      aria-labelledby="rounding-rule-heading"
      style={styles.section}
      dir="rtl"
    >
      <header style={styles.header}>
        <div>
          <h2 id="rounding-rule-heading" style={styles.title}>
            قواعد رُند کردن
          </h2>
          <p style={styles.hint}>
            مبنای رُند مبلغ نهایی قابل پرداخت برحسب ریال. مقادیر دلخواه مانند ۹۹
            مجازند؛ اسناد مهرشده مبنای ذخیره‌شدهٔ خود را نگه می‌دارند.
          </p>
        </div>
        {opened ? (
          <button
            type="button"
            className="tax-btn"
            disabled={busy}
            onClick={() =>
              void runAction({ action: 'bootstrap' }, 'قواعد پایه آماده شد')
            }
          >
            راه‌اندازی قواعد پایه
          </button>
        ) : (
          <button
            type="button"
            className="tax-btn"
            onClick={() => setOpened(true)}
          >
            مدیریت قواعد رُند
          </button>
        )}
      </header>

      {opened ? null : (
        <p style={styles.hint}>
          برای فهرست، ایجاد، ویرایش و انتخاب پیش‌فرض، «مدیریت قواعد رُند» را باز
          کنید.
        </p>
      )}

      {opened ? (
        <>
          {loadError ? <p style={styles.error}>{loadError}</p> : null}

          <div style={styles.editor}>
            <label style={styles.label}>
              نام قاعده
              <input
                style={styles.input}
                value={editor.name}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                disabled={busy}
              />
            </label>
            <label style={styles.label}>
              مبنای رُند (ریال)
              <input
                style={styles.input}
                inputMode="numeric"
                value={editor.stepRialsText}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    stepRialsText: event.target.value,
                  }))
                }
                disabled={busy}
                placeholder="مثلاً ۹۹"
              />
            </label>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={editor.isActive}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                disabled={busy}
              />
              فعال
            </label>
            <div style={styles.editorActions}>
              <button
                type="button"
                className="tax-btn tax-btn-primary"
                disabled={busy}
                onClick={() => void onSave()}
              >
                {editor.recordId === null ? 'ایجاد قاعده' : 'ذخیره تغییرات'}
              </button>
              {editor.recordId === null ? null : (
                <button
                  type="button"
                  className="tax-btn"
                  disabled={busy}
                  onClick={() => setEditor(emptyEditor())}
                >
                  انصراف
                </button>
              )}
            </div>
          </div>

          <ul style={styles.list}>
            {rows.map((row) => (
              <li key={row.recordId} style={styles.row}>
                <div style={styles.rowMain}>
                  <strong>{row.name}</strong>
                  <span style={styles.meta}>
                    {formatStepLabel(row.stepRials)}
                    {row.isDefault ? ' · پیش‌فرض' : ''}
                    {row.isActive ? '' : ' · غیرفعال'}
                    {row.quotationCount > 0
                      ? ` · ${toPersianDigits(String(row.quotationCount))} سند`
                      : ''}
                  </span>
                </div>
                <div style={styles.rowActions}>
                  <button
                    type="button"
                    className="tax-btn"
                    disabled={busy}
                    onClick={() =>
                      setEditor({
                        recordId: row.recordId,
                        name: row.name,
                        stepRialsText: row.stepRials,
                        isActive: row.isActive,
                      })
                    }
                  >
                    ویرایش
                  </button>
                  {row.isDefault ? null : (
                    <button
                      type="button"
                      className="tax-btn"
                      disabled={busy || !row.isActive}
                      onClick={() =>
                        void runAction(
                          { action: 'set-default', recordId: row.recordId },
                          'قاعده پیش‌فرض تغییر کرد',
                        )
                      }
                    >
                      پیش‌فرض
                    </button>
                  )}
                  {row.isDefault || !row.isActive ? null : (
                    <button
                      type="button"
                      className="tax-btn"
                      disabled={busy}
                      onClick={() =>
                        void runAction(
                          { action: 'deactivate', recordId: row.recordId },
                          'قاعده غیرفعال شد',
                        )
                      }
                    >
                      غیرفعال
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
};

const styles: Record<string, CSSProperties> = {
  section: {
    marginTop: 28,
    paddingTop: 20,
    borderTop: '1px solid var(--t-color-gray4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: { margin: 0, fontSize: 16, fontWeight: 700 },
  hint: {
    margin: '6px 0 0',
    fontSize: 13,
    color: 'var(--t-color-gray10)',
  },
  error: { color: 'var(--t-color-red)', fontSize: 13 },
  editor: {
    display: 'grid',
    gap: 10,
    marginBottom: 16,
    padding: 12,
    background: 'var(--t-color-gray1)',
    borderRadius: 8,
  },
  label: { display: 'grid', gap: 4, fontSize: 13 },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
  },
  input: {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--t-color-gray5)',
    fontSize: 14,
  },
  editorActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    padding: '10px 12px',
    border: '1px solid var(--t-color-gray4)',
    borderRadius: 8,
  },
  rowMain: { display: 'grid', gap: 4, minWidth: 0 },
  meta: { fontSize: 12, color: 'var(--t-color-gray10)' },
  rowActions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
};
