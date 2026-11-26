import { useCallback, useEffect, useRef, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import { RoundingList } from 'src/components/financial-settings/rounding-list';
import { callRoundingRulesNestAction } from 'src/components/quotation-api';
import { runDestructiveConfirm } from 'src/components/shared/run-destructive-confirm';
import { SettingsDialog } from 'src/components/shared/settings-dialog';
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
  const [editor, setEditor] = useState<EditorState | null>(null);
  const deleteLatchRef = useRef(false);

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
        if (body.action !== 'list' && body.action !== 'bootstrap') {
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

  const ensureCatalog = useCallback(async () => {
    setBusy(true);
    setLoadError(null);

    try {
      const listResponse = await callRoundingRulesNestAction({
        action: 'list',
      });
      const listData = listResponse.data;

      if (listData.success !== true) {
        const message = toPersianUiMessage(
          listData.message,
          'عملیات قواعد رُند ناموفق بود',
        );
        setLoadError(message);
        toast(message, 'error', 'rounding-error:list');

        return;
      }

      const listed = readRows(listData);

      if (listed.length > 0) {
        applyPayload(listData);

        return;
      }

      const bootResponse = await callRoundingRulesNestAction({
        action: 'bootstrap',
      });
      const bootData = bootResponse.data;

      if (bootData.success !== true) {
        const message = toPersianUiMessage(
          bootData.message,
          'راه‌اندازی قواعد رُند ناموفق بود',
        );
        setLoadError(message);
        toast(message, 'error', 'rounding-error:bootstrap');

        return;
      }

      applyPayload(bootData);
    } catch {
      const message = 'ارتباط با سرور برقرار نشد';
      setLoadError(message);
      toast(message, 'error', 'rounding-network');
    } finally {
      setBusy(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    if (!opened) {
      return;
    }

    void ensureCatalog();
  }, [ensureCatalog, opened]);

  const closeEditor = () => {
    setEditor(null);
    setNameError(null);
    setStepError(null);
  };

  const onSave = async () => {
    if (editor === null) {
      return;
    }

    const step = parseStepRialsText(editor.stepRialsText);
    let hasFieldError = false;

    if (editor.name.trim() === '') {
      setNameError('نام قاعده را وارد کنید');
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

    if (deleteLatchRef.current || deletingRecordId !== null) {
      return;
    }

    deleteLatchRef.current = true;
    setDeletingRecordId(row.recordId);

    try {
      await runDestructiveConfirm(
        {
          title: 'حذف قاعده رُند',
          subtitle: `آیا قاعده «${row.name}» حذف شود؟ این عملیات قابل بازگشت نیست.`,
          confirmButtonText: 'حذف قاعده',
        },
        async () => {
          const ok = await runAction(
            { action: 'delete', recordId: row.recordId },
            'قاعده رُند حذف شد',
          );

          if (ok && editor?.recordId === row.recordId) {
            closeEditor();
          }
        },
      );
    } finally {
      deleteLatchRef.current = false;
      setDeletingRecordId(null);
    }
  };

  const defaultStep =
    rows.find((row) => row.isDefault)?.stepRials ??
    rows[0]?.stepRials ??
    '1000';

  const ladderRows = rows.map((row) => ({
    id: row.recordId,
    stepAmount: formatExactDecimalForPeople(row.stepRials),
    isDefault: row.isDefault,
    isActive: row.isActive,
    quotationCount: row.quotationCount,
  }));

  const findRow = (id: string) => rows.find((row) => row.recordId === id);

  const openCreate = () => {
    setOpenMoreRecordId(null);
    setEditor(emptyEditor());
    setNameError(null);
    setStepError(null);
  };

  return (
    <section className="rounding-section" dir="rtl">
      <style>{ROUNDING_CSS}</style>
      {opened || alwaysOpen ? null : (
        <button
          type="button"
          className="tax-btn"
          onClick={() => setOpened(true)}
        >
          مدیریت قواعد رُند
        </button>
      )}

      {opened ? (
        <RoundingList
          rows={ladderRows}
          defaultStep={formatExactDecimalForPeople(defaultStep)}
          loading={busy && rows.length === 0 && loadError === null}
          error={loadError}
          onRetry={() => {
            void ensureCatalog();
          }}
          onCreate={openCreate}
          onEdit={(id) => {
            const row = findRow(id);
            if (!row) {
              return;
            }
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
          onMakeDefault={(id) => {
            void runAction(
              { action: 'set-default', recordId: id },
              'قاعده پیش‌فرض تغییر کرد',
            );
          }}
          onDelete={(id) => {
            const row = findRow(id);
            if (row) {
              void requestDelete(row);
            }
          }}
        />
      ) : null}

      {editor === null ? null : (
        <SettingsDialog
          title={editor.recordId === null ? 'قاعده جدید' : 'ویرایش قاعده'}
          busy={busy}
          onClose={closeEditor}
          footer={
            <>
              <button
                type="button"
                className="tax-btn tax-btn-primary"
                disabled={busy}
                onClick={() => void onSave()}
              >
                {editor.recordId === null ? 'ایجاد' : 'ذخیره'}
              </button>
              <button
                type="button"
                className="tax-btn"
                disabled={busy}
                onClick={closeEditor}
              >
                انصراف
              </button>
            </>
          }
        >
          <label className="rounding-field">
            نام قاعده
            <input
              value={editor.name}
              onChange={(event) =>
                setEditor((current) =>
                  current === null
                    ? current
                    : { ...current, name: event.target.value },
                )
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
                setEditor((current) =>
                  current === null
                    ? current
                    : { ...current, stepRialsText: event.target.value },
                )
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
                setEditor((current) =>
                  current === null
                    ? current
                    : { ...current, isActive: event.target.checked },
                )
              }
              disabled={busy}
            />
            فعال
          </label>
        </SettingsDialog>
      )}
    </section>
  );
};

const ROUNDING_CSS = `
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
.tax-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  height: 36px;
  padding: 0 14px;
  border-radius: 6px;
  border: 1px solid var(--t-color-gray6);
  background: var(--t-color-gray1);
  color: var(--t-color-gray12);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.tax-btn-primary {
  background: var(--t-color-blue9);
  border-color: var(--t-color-blue9);
  color: var(--t-color-gray1);
}
@media (max-width: 720px) {
  .rounding-field input { height: 44px; }
}
`;

