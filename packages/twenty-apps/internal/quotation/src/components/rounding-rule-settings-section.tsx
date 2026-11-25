import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import { callRoundingRulesNestAction } from 'src/components/quotation-api';
import { confirmDestructiveAction } from 'src/components/shared/confirm-destructive-action';
import { formatExactDecimalForPeople } from 'src/domain/money/display-format';
import { parseStepRialsText } from 'src/domain/money/rounding-rule';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

type RoundingRuleSettingsSectionProps = {
  alwaysOpen?: boolean;
};

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
          typeof row.stepRials === 'string'
            ? row.stepRials
            : String(row.stepRials ?? ''),
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
  `${formatExactDecimalForPeople(stepRials)} ریال`;

const canDeleteRow = (row: RoundingRuleRow): boolean =>
  !row.isDefault && row.quotationCount === 0;

const toast = (
  message: string,
  variant: 'success' | 'error' | 'warning',
  dedupeKey: string,
) => {
  if (message.trim() === '') {
    return;
  }

  void enqueueSnackbar({ message, variant, dedupeKey });
};

// Compact CRUD for named rounding rules inside existing financial settings.
export const RoundingRuleSettingsSection = ({
  alwaysOpen = false,
}: RoundingRuleSettingsSectionProps) => {
  const [opened, setOpened] = useState(alwaysOpen);
  const [rows, setRows] = useState<RoundingRuleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [openMoreRecordId, setOpenMoreRecordId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());
  const editorOpen = editor.recordId !== null || editor.name !== '' || editor.stepRialsText !== '';

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
          toast(message, 'error', `rounding-error:${String(body.action)}`);

          return false;
        }

        applyPayload(data);
        if (body.action !== 'list') {
          toast(
            successMessage,
            'success',
            `rounding-ok:${String(body.action)}`,
          );
        }

        return true;
      } catch {
        const message = 'ارتباط با سرور برقرار نشد';
        setLoadError(message);
        toast(message, 'error', 'rounding-network');

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

  const closeEditor = () => {
    setEditor(emptyEditor());
    setNameError(null);
    setStepError(null);
  };

  const onSave = async () => {
    const step = parseStepRialsText(editor.stepRialsText);
    let hasFieldError = false;

    if (editor.name.trim() === '') {
      setNameError('نام قاعده رُند را وارد کنید');
      hasFieldError = true;
    } else {
      setNameError(null);
    }

    if (!step.ok) {
      setStepError(step.refusal.detail);
      hasFieldError = true;
    } else {
      setStepError(null);
    }

    if (hasFieldError || !step.ok) {
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
      closeEditor();
    }
  };

  const requestDelete = async (row: RoundingRuleRow) => {
    setOpenMoreRecordId(null);

    if (!canDeleteRow(row)) {
      toast(
        row.isDefault
          ? 'قاعده پیش‌فرض را نمی‌توان حذف کرد'
          : 'این قاعده در سند استفاده شده و حذف نمی‌شود',
        'warning',
        `rounding-delete-blocked:${row.recordId}`,
      );

      return;
    }

    if (deletingRecordId !== null) {
      return;
    }

    const confirmation = await confirmDestructiveAction({
      title: 'حذف قاعده رُند',
      subtitle: `آیا قاعده «${row.name}» حذف شود؟ این عملیات قابل بازگشت نیست.`,
      confirmButtonText: 'حذف قاعده',
    });

    if (confirmation !== 'confirm') {
      return;
    }

    setDeletingRecordId(row.recordId);

    try {
      const ok = await runAction(
        { action: 'delete', recordId: row.recordId },
        'قاعده رُند حذف شد',
      );

      if (ok && editor.recordId === row.recordId) {
        closeEditor();
      }
    } finally {
      setDeletingRecordId(null);
    }
  };

  return (
    <section
      aria-labelledby="rounding-rule-heading"
      className="rounding-section"
      style={
        alwaysOpen
          ? { ...styles.section, marginTop: 0, paddingTop: 0, borderTop: 'none' }
          : styles.section
      }
      dir="rtl"
    >
      <style>{ROUNDING_CSS}</style>
      <header style={styles.header}>
        <h2 id="rounding-rule-heading" style={styles.title}>
          قواعد رُند کردن
        </h2>
        <div className="rounding-head-actions">
          {opened ? (
            <>
              <button
                type="button"
                className="tax-btn"
                disabled={busy}
                onClick={() =>
                  void runAction(
                    { action: 'bootstrap' },
                    'قواعد پایه آماده شد',
                  )
                }
              >
                قواعد پایه
              </button>
              <button
                type="button"
                className="tax-btn tax-btn-primary"
                disabled={busy}
                onClick={() => {
                  setOpenMoreRecordId(null);
                  setEditor(emptyEditor());
                  setNameError(null);
                  setStepError(null);
                }}
              >
                + قاعده جدید
              </button>
            </>
          ) : alwaysOpen ? null : (
            <button
              type="button"
              className="tax-btn"
              onClick={() => setOpened(true)}
            >
              مدیریت قواعد رُند
            </button>
          )}
        </div>
      </header>

      {opened ? (
        <>
          {loadError ? <p style={styles.error}>{loadError}</p> : null}

          <div className="rounding-editor">
            <label className="rounding-field">
              نام قاعده
              <input
                value={editor.name}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                disabled={busy}
              />
              {nameError ? (
                <span role="alert" className="rounding-field-error">
                  {nameError}
                </span>
              ) : null}
            </label>
            <label className="rounding-field">
              مبنای رُند (ریال)
              <input
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
              {stepError ? (
                <span role="alert" className="rounding-field-error">
                  {stepError}
                </span>
              ) : null}
            </label>
            <label className="rounding-check">
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
            <div className="rounding-editor-actions">
              <button
                type="button"
                className="tax-btn tax-btn-primary"
                disabled={busy}
                onClick={() => void onSave()}
              >
                {editor.recordId === null ? 'ایجاد' : 'ذخیره'}
              </button>
              {editorOpen ? (
                <button
                  type="button"
                  className="tax-btn"
                  disabled={busy}
                  onClick={() => closeEditor()}
                >
                  انصراف
                </button>
              ) : null}
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="rounding-empty">هنوز قاعده‌ای ثبت نشده است.</p>
          ) : (
            <ul className="rounding-list">
              {rows.map((row) => {
                const moreOpen = openMoreRecordId === row.recordId;
                const deleteBusy = deletingRecordId === row.recordId;

                return (
                  <li key={row.recordId} className="rounding-row">
                    <div className="rounding-row-main">
                      <strong>{row.name}</strong>
                      <span className="rounding-meta">
                        {formatStepLabel(row.stepRials)}
                        {row.isDefault ? ' · پیش‌فرض' : ''}
                        {row.isActive ? '' : ' · غیرفعال'}
                      </span>
                    </div>
                    <div className="rounding-row-actions">
                      <button
                        type="button"
                        className="tax-btn"
                        disabled={busy || deletingRecordId !== null}
                        onClick={() => {
                          setOpenMoreRecordId(null);
                          setEditor({
                            recordId: row.recordId,
                            name: row.name,
                            stepRialsText: row.stepRials,
                            isActive: row.isActive,
                          });
                          setNameError(null);
                          setStepError(null);
                        }}
                      >
                        ویرایش
                      </button>
                      <div className="rounding-more">
                        <button
                          type="button"
                          className="tax-btn"
                          aria-label={`عملیات بیشتر — ${row.name}`}
                          aria-expanded={moreOpen ? 'true' : 'false'}
                          disabled={busy || deletingRecordId !== null}
                          onClick={() =>
                            setOpenMoreRecordId(
                              moreOpen ? null : row.recordId,
                            )
                          }
                        >
                          بیشتر
                        </button>
                        {moreOpen ? (
                          <div className="rounding-more-menu" role="menu">
                            {row.isDefault ? null : (
                              <button
                                type="button"
                                role="menuitem"
                                className="rounding-more-item"
                                disabled={busy || !row.isActive}
                                onClick={() => {
                                  setOpenMoreRecordId(null);
                                  void runAction(
                                    {
                                      action: 'set-default',
                                      recordId: row.recordId,
                                    },
                                    'قاعده پیش‌فرض تغییر کرد',
                                  );
                                }}
                              >
                                پیش‌فرض
                              </button>
                            )}
                            {row.isDefault || !row.isActive ? null : (
                              <button
                                type="button"
                                role="menuitem"
                                className="rounding-more-item"
                                disabled={busy}
                                onClick={() => {
                                  setOpenMoreRecordId(null);
                                  void runAction(
                                    {
                                      action: 'deactivate',
                                      recordId: row.recordId,
                                    },
                                    'قاعده غیرفعال شد',
                                  );
                                }}
                              >
                                غیرفعال
                              </button>
                            )}
                            <button
                              type="button"
                              role="menuitem"
                              className="rounding-more-item rounding-more-item-danger"
                              disabled={
                                busy || deleteBusy || !canDeleteRow(row)
                              }
                              title={
                                canDeleteRow(row)
                                  ? undefined
                                  : row.isDefault
                                    ? 'قاعده پیش‌فرض حذف نمی‌شود'
                                    : 'به‌دلیل استفاده در سند حذف نمی‌شود'
                              }
                              onClick={() => void requestDelete(row)}
                            >
                              {deleteBusy ? 'در حال حذف…' : 'حذف'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
};

const ROUNDING_CSS = `
.rounding-head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.rounding-editor {
  display: grid;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px 14px;
  background: var(--t-color-gray1);
  border: 1px solid var(--t-color-gray5);
  border-radius: 10px;
  max-width: 560px;
}
.rounding-field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t-color-gray11);
}
.rounding-field input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--t-color-gray6);
  border-radius: 8px;
  font: inherit;
  color: var(--t-color-gray12);
  background: var(--t-color-gray1);
}
.rounding-field-error {
  font-size: 12px;
  font-weight: 500;
  color: var(--t-color-red11);
}
.rounding-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.rounding-editor-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.rounding-empty {
  margin: 0;
  font-size: 13px;
  color: var(--t-color-gray10);
}
.rounding-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  max-width: 720px;
}
.rounding-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border: 1px solid var(--t-color-gray4);
  border-radius: 8px;
  background: var(--t-color-gray1);
}
.rounding-row-main { display: grid; gap: 4px; min-width: 0; }
.rounding-meta { font-size: 12px; color: var(--t-color-gray10); }
.rounding-row-actions {
  display: inline-flex;
  gap: 6px;
  align-items: flex-start;
  position: relative;
}
.rounding-more { position: relative; }
.rounding-more-menu {
  position: absolute;
  inset-inline-end: 0;
  top: calc(100% + 4px);
  z-index: 20;
  min-width: 140px;
  padding: 4px;
  border: 1px solid var(--t-color-gray6);
  border-radius: 8px;
  background: var(--t-color-gray1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  display: grid;
  gap: 2px;
}
.rounding-more-item {
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
.rounding-more-item:hover:not(:disabled) { background: var(--t-color-gray3); }
.rounding-more-item:disabled {
  color: var(--t-color-gray9);
  cursor: not-allowed;
}
.rounding-more-item-danger { color: var(--t-color-red11); }
@media (max-width: 720px) {
  .rounding-field input { height: 44px; }
  .rounding-row-actions { width: 100%; display: grid; grid-template-columns: 1fr 1fr; }
  .rounding-more { width: 100%; }
  .rounding-more .tax-btn { width: 100%; }
  .rounding-more-item { min-height: 44px; }
}
`;

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
  error: { color: 'var(--t-color-red11)', fontSize: 13 },
};
