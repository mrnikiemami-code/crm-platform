import { useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import { callQuotationUnitsNestAction } from 'src/components/quotation-api';
import { SettingsDialog } from 'src/components/shared/settings-dialog';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

type QuotationUnitSettingsSectionProps = {
  alwaysOpen?: boolean;
};

type UnitRow = {
  recordId: string;
  code: string;
  name: string;
  isActive: boolean;
  accountingCode: string;
  catalogItemCount: number;
};

type EditorState = {
  recordId: string | null;
  name: string;
  accountingCodeText: string;
  isActive: boolean;
};

const readRows = (data: Record<string, unknown>): UnitRow[] => {
  const units = Array.isArray(data.units) ? data.units : [];

  return units.flatMap((candidate) => {
    if (candidate === null || typeof candidate !== 'object') {
      return [];
    }

    const row = candidate as Record<string, unknown>;
    const recordId = typeof row.recordId === 'string' ? row.recordId : '';
    const code = typeof row.code === 'string' ? row.code : '';

    if (recordId === '' || code === '') {
      return [];
    }

    return [
      {
        recordId,
        code,
        name: typeof row.name === 'string' ? row.name : code,
        isActive: row.isActive !== false,
        accountingCode:
          typeof row.accountingCode === 'string' ? row.accountingCode : '',
        catalogItemCount:
          typeof row.catalogItemCount === 'number' ? row.catalogItemCount : 0,
      },
    ];
  });
};

const emptyEditor = (): EditorState => ({
  recordId: null,
  name: '',
  accountingCodeText: '',
  isActive: true,
});

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

export const QuotationUnitSettingsSection = ({
  alwaysOpen = false,
}: QuotationUnitSettingsSectionProps) => {
  const [opened, setOpened] = useState(alwaysOpen);
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const applyPayload = useCallback((data: Record<string, unknown>) => {
    setRows(readRows(data));
  }, []);

  const runAction = useCallback(
    async (
      body: Record<string, unknown>,
      successMessage: string,
    ): Promise<boolean> => {
      setBusy(true);
      setLoadError(null);

      try {
        const response = await callQuotationUnitsNestAction(body);
        const data = response.data;

        if (data.success !== true) {
          const message = toPersianUiMessage(
            data.message,
            'عملیات واحد ناموفق بود',
          );
          setLoadError(message);
          toast(message, 'error', `unit-error:${String(body.action)}`);

          return false;
        }

        applyPayload(data);
        if (body.action !== 'list') {
          toast(successMessage, 'success', `unit-ok:${String(body.action)}`);
        }

        return true;
      } catch {
        const message = 'ارتباط با سرور برقرار نشد';
        setLoadError(message);
        toast(message, 'error', 'unit-network');

        return false;
      } finally {
        setBusy(false);
      }
    },
    [applyPayload],
  );

  const load = useCallback(async () => {
    await runAction({ action: 'list' }, '');
  }, [runAction]);

  useEffect(() => {
    if (opened) {
      void load();
    }
  }, [load, opened]);

  useEffect(() => {
    if (alwaysOpen) {
      setOpened(true);
    }
  }, [alwaysOpen]);

  const onSave = async () => {
    if (editor === null) {
      return;
    }

    const ok = await runAction(
      {
        action: 'save',
        recordId: editor.recordId,
        name: editor.name,
        accountingCodeText: editor.accountingCodeText,
        isActive: editor.isActive,
      },
      'واحد ذخیره شد',
    );

    if (ok) {
      setEditor(null);
    }
  };

  const onDeactivate = async (row: UnitRow) => {
    await runAction(
      { action: 'deactivate', recordId: row.recordId },
      'واحد غیرفعال شد',
    );
  };

  if (!alwaysOpen && !opened) {
    return (
      <button type="button" onClick={() => setOpened(true)}>
        واحدهای اندازه‌گیری
      </button>
    );
  }

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <motionless-toolbar
        busy={busy}
        onReload={() => void load()}
        onCreate={() => setEditor(emptyEditor())}
      />
      {loadError === null ? null : (
        <p role="alert" style={{ color: '#b42318' }}>
          {loadError}
        </p>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>کد</th>
            <th>نام</th>
            <th>کد حسابداری</th>
            <th>کالا</th>
            <th>وضعیت</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.recordId}>
              <td>{row.code}</td>
              <td>{row.name}</td>
              <td>{row.accountingCode || '—'}</td>
              <td>{row.catalogItemCount}</td>
              <td>{row.isActive ? 'فعال' : 'غیرفعال'}</td>
              <td>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setEditor({
                      recordId: row.recordId,
                      name: row.name,
                      accountingCodeText: row.accountingCode,
                      isActive: row.isActive,
                    })
                  }
                >
                  ویرایش
                </button>{' '}
                {row.isActive ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onDeactivate(row)}
                  >
                    غیرفعال
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editor === null ? null : (
        <SettingsDialog
          title={editor.recordId === null ? 'واحد جدید' : 'ویرایش واحد'}
          busy={busy}
          size="md"
          onClose={() => setEditor(null)}
          footer={
            <>
              <button type="button" disabled={busy} onClick={() => void onSave()}>
                {busy ? 'در حال ذخیره…' : 'ذخیره'}
              </button>
              <button type="button" disabled={busy} onClick={() => setEditor(null)}>
                انصراف
              </button>
            </>
          }
        >
          <label style={{ display: 'block', marginBottom: 8 }}>
            نام
            <input
              value={editor.name}
              onChange={(event) =>
                setEditor({ ...editor, name: event.target.value })
              }
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            کد حسابداری (اختیاری)
            <input
              value={editor.accountingCodeText}
              onChange={(event) =>
                setEditor({ ...editor, accountingCodeText: event.target.value })
              }
            />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={editor.isActive}
              onChange={(event) =>
                setEditor({ ...editor, isActive: event.target.checked })
              }
            />
            فعال
          </label>
        </SettingsDialog>
      )}
    </div>
  );
};

const motionlessToolbar = ({
  busy,
  onReload,
  onCreate,
}: {
  busy: boolean;
  onReload: () => void;
  onCreate: () => void;
}) => (
  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
    <button type="button" disabled={busy} onClick={onCreate}>
      واحد جدید
    </button>
    <button type="button" disabled={busy} onClick={onReload}>
      بازخوانی
    </button>
  </div>
);