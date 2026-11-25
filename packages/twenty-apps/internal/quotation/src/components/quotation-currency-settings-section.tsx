import { useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import { callQuotationCurrenciesNestAction } from 'src/components/quotation-api';
import { SettingsDialog } from 'src/components/shared/settings-dialog';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

type QuotationCurrencySettingsSectionProps = {
  alwaysOpen?: boolean;
};

type CurrencyRow = {
  recordId: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  accountingCode: string;
};

const readRows = (data: Record<string, unknown>): CurrencyRow[] => {
  const currencies = Array.isArray(data.currencies) ? data.currencies : [];

  return currencies.flatMap((candidate) => {
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
        isDefault: row.isDefault === true,
        isActive: row.isActive !== false,
        accountingCode:
          typeof row.accountingCode === 'string' ? row.accountingCode : '',
      },
    ];
  });
};

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

// Phase-1 IRR card. Bootstrap is automatic/idempotent — no operator button.
export const QuotationCurrencySettingsSection = ({
  alwaysOpen = false,
}: QuotationCurrencySettingsSectionProps) => {
  const [opened, setOpened] = useState(alwaysOpen);
  const [rows, setRows] = useState<CurrencyRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<CurrencyRow | null>(null);
  const [draftCode, setDraftCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const applyPayload = useCallback((data: Record<string, unknown>) => {
    setRows(readRows(data));
  }, []);

  const runAction = useCallback(
    async (
      body: Record<string, unknown>,
      successMessage: string,
    ): Promise<string | null> => {
      setBusy(true);
      setLoadError(null);

      try {
        const response = await callQuotationCurrenciesNestAction(body);
        const data = response.data;

        if (data.success !== true) {
          const message = toPersianUiMessage(
            data.message,
            'عملیات ارز ناموفق بود',
          );
          setLoadError(message);
          toast(message, 'error', `currency-error:${String(body.action)}`);

          return message;
        }

        applyPayload(data);
        if (body.action !== 'list' && body.action !== 'bootstrap') {
          toast(successMessage, 'success', `currency-ok:${String(body.action)}`);
        }

        return null;
      } catch {
        const message = 'ارتباط با سرور برقرار نشد';
        setLoadError(message);
        toast(message, 'error', 'currency-network');

        return message;
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
      const listResponse = await callQuotationCurrenciesNestAction({
        action: 'list',
      });
      const listData = listResponse.data;

      if (listData.success !== true) {
        const message = toPersianUiMessage(
          listData.message,
          'عملیات ارز ناموفق بود',
        );
        setLoadError(message);
        toast(message, 'error', 'currency-error:list');

        return;
      }

      const listed = readRows(listData);

      if (listed.length > 0) {
        applyPayload(listData);

        return;
      }

      const bootResponse = await callQuotationCurrenciesNestAction({
        action: 'bootstrap',
      });
      const bootData = bootResponse.data;

      if (bootData.success !== true) {
        const message = toPersianUiMessage(
          bootData.message,
          'راه‌اندازی ارز ناموفق بود',
        );
        setLoadError(message);
        toast(message, 'error', 'currency-error:bootstrap');

        return;
      }

      applyPayload(bootData);
    } catch {
      const message = 'ارتباط با سرور برقرار نشد';
      setLoadError(message);
      toast(message, 'error', 'currency-network');
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

  const openEdit = (row: CurrencyRow) => {
    setEditingRow(row);
    setDraftCode(row.accountingCode);
    setFieldError(null);
  };

  const closeEdit = () => {
    setEditingRow(null);
    setDraftCode('');
    setFieldError(null);
  };

  const onSaveCode = async () => {
    if (editingRow === null) {
      return;
    }

    setFieldError(null);
    const failure = await runAction(
      {
        action: 'save',
        recordId: editingRow.recordId,
        name: editingRow.name,
        accountingCodeText: draftCode,
        isActive: editingRow.isActive,
        isDefault: editingRow.isDefault,
      },
      'کد حسابداری ذخیره شد',
    );

    if (failure !== null) {
      setFieldError(failure);

      return;
    }

    closeEdit();
  };

  return (
    <section className="currency-section" dir="rtl">
      <style>{CURRENCY_CSS}</style>
      {opened || alwaysOpen ? null : (
        <button
          type="button"
          className="tax-btn"
          onClick={() => setOpened(true)}
        >
          مدیریت ارزها
        </button>
      )}

      {opened ? (
        <>
          {loadError === null ? null : (
            <div className="currency-error-bar">
              <p role="alert" className="currency-error">
                {loadError}
              </p>
              <button
                type="button"
                className="tax-btn"
                disabled={busy}
                onClick={() => void ensureCatalog()}
              >
                تلاش مجدد
              </button>
            </div>
          )}

          {busy && rows.length === 0 ? (
            <p className="currency-empty">در حال آماده‌سازی ارز…</p>
          ) : null}

          {rows.length === 0 && !busy && loadError === null ? (
            <p className="currency-empty">ارز عملیاتی هنوز آماده نیست.</p>
          ) : (
            <ul className="currency-list">
              {rows.map((row) => (
                <li key={row.recordId} className="currency-card">
                  <div className="currency-card-main">
                    <div>
                      <strong>
                        {row.name}{' '}
                        <span className="currency-code" dir="ltr">
                          ({row.code})
                        </span>
                      </strong>
                      <div className="currency-meta">
                        {row.isDefault ? 'پیش‌فرض' : 'فعال'}
                        {row.accountingCode
                          ? ` · کد ${row.accountingCode}`
                          : ' · بدون کد حسابداری'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="tax-btn"
                      disabled={busy}
                      onClick={() => openEdit(row)}
                    >
                      ویرایش
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {editingRow === null ? null : (
        <SettingsDialog
          title={`ویرایش ${editingRow.code}`}
          busy={busy}
          onClose={closeEdit}
          footer={
            <>
              <button
                type="button"
                className="tax-btn tax-btn-primary"
                disabled={busy}
                onClick={() => void onSaveCode()}
              >
                {busy ? 'در حال ذخیره…' : 'ذخیره'}
              </button>
              <button
                type="button"
                className="tax-btn"
                disabled={busy}
                onClick={closeEdit}
              >
                انصراف
              </button>
            </>
          }
        >
          <p className="currency-dialog-meta">
            {editingRow.name}
            {editingRow.isDefault ? ' · پیش‌فرض' : ''}
          </p>
          <label className="currency-field">
            کد حسابداری
            <input
              aria-label={`کد حسابداری ${editingRow.code}`}
              value={draftCode}
              dir="ltr"
              maxLength={64}
              placeholder="اختیاری"
              disabled={busy}
              onChange={(event) => setDraftCode(event.target.value)}
            />
          </label>
          {fieldError === null ? null : (
            <p role="alert" className="currency-field-error">
              {fieldError}
            </p>
          )}
        </SettingsDialog>
      )}
    </section>
  );
};

const CURRENCY_CSS = `
.currency-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  max-width: 560px;
}
.currency-card {
  padding: 12px 14px;
  border: 1px solid var(--t-color-gray4);
  border-radius: 10px;
  background: var(--t-color-gray1);
}
.currency-card-main {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.currency-code { font-weight: 600; color: var(--t-color-gray11); }
.currency-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--t-color-gray10);
}
.currency-empty, .currency-dialog-meta {
  margin: 0;
  font-size: 13px;
  color: var(--t-color-gray10);
}
.currency-error-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.currency-error, .currency-field-error {
  margin: 0;
  font-size: 13px;
  color: var(--t-color-red11);
}
.currency-field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--t-color-gray11);
}
.currency-field input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--t-color-gray6);
  border-radius: 8px;
  background: var(--t-color-gray1);
  color: var(--t-color-gray12);
  font: inherit;
}
@media (max-width: 720px) {
  .currency-field input { height: 44px; }
  .currency-card .tax-btn { min-height: 44px; }
}
`;
