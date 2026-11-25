import { useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import { callQuotationCurrenciesNestAction } from 'src/components/quotation-api';
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

// Phase-1: IRR operational currency only — compact card, accounting code edit.
export const QuotationCurrencySettingsSection = ({
  alwaysOpen = false,
}: QuotationCurrencySettingsSectionProps) => {
  const [opened, setOpened] = useState(alwaysOpen);
  const [rows, setRows] = useState<CurrencyRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftCodes, setDraftCodes] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const applyPayload = useCallback((data: Record<string, unknown>) => {
    const next = readRows(data);
    setRows(next);
    setDraftCodes(
      Object.fromEntries(
        next.map((row) => [row.recordId, row.accountingCode]),
      ),
    );
    setFieldErrors({});
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
        if (body.action !== 'list') {
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

  useEffect(() => {
    if (!opened) {
      return;
    }

    void runAction({ action: 'list' }, 'فهرست ارز خوانده شد');
  }, [opened, runAction]);

  const onSaveCode = async (row: CurrencyRow) => {
    const nextCode = draftCodes[row.recordId] ?? '';
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[row.recordId];

      return next;
    });

    const failure = await runAction(
      {
        action: 'save',
        recordId: row.recordId,
        name: row.name,
        accountingCodeText: nextCode,
        isActive: row.isActive,
        isDefault: row.isDefault,
      },
      'کد حسابداری ذخیره شد',
    );

    if (failure !== null) {
      setFieldErrors((current) => ({
        ...current,
        [row.recordId]: failure,
      }));
    }
  };

  return (
    <section
      className="currency-section"
      aria-labelledby="quotation-currency-heading"
      style={
        alwaysOpen
          ? { marginTop: 0, paddingTop: 0 }
          : {
              marginTop: 28,
              paddingTop: 20,
              borderTop: '1px solid var(--t-color-gray4)',
            }
      }
      dir="rtl"
    >
      <style>{CURRENCY_CSS}</style>
      <header className="currency-head">
        <h2 id="quotation-currency-heading" className="currency-title">
          ارزهای فضای کاری
        </h2>
        {opened ? (
          <button
            type="button"
            className="tax-btn"
            disabled={busy}
            onClick={() =>
              void runAction({ action: 'bootstrap' }, 'ارز پایه آماده شد')
            }
          >
            راه‌اندازی ریال
          </button>
        ) : alwaysOpen ? null : (
          <button
            type="button"
            className="tax-btn"
            onClick={() => setOpened(true)}
          >
            مدیریت ارزها
          </button>
        )}
      </header>

      {opened || alwaysOpen ? null : (
        <p className="currency-hint">برای ویرایش کد حسابداری ریال باز کنید.</p>
      )}

      {opened ? (
        <>
          {loadError === null ? null : (
            <p role="alert" className="currency-error">
              {loadError}
            </p>
          )}

          {rows.length === 0 ? (
            <p className="currency-empty">
              هنوز ارزی ثبت نشده. «راه‌اندازی ریال» را بزنید.
            </p>
          ) : (
            <ul className="currency-list">
              {rows.map((row) => (
                <li key={row.recordId} className="currency-card">
                  <div className="currency-card-main">
                    <strong dir="ltr">{row.code}</strong>
                    <span>{row.name}</span>
                    <span className="currency-badge">
                      {row.isDefault ? 'پیش‌فرض' : ''}
                      {row.isActive ? '' : 'غیرفعال'}
                    </span>
                  </div>
                  <label className="currency-field">
                    کد حسابداری
                    <input
                      aria-label={`کد حسابداری ${row.code}`}
                      value={draftCodes[row.recordId] ?? ''}
                      dir="ltr"
                      maxLength={64}
                      placeholder="اختیاری"
                      disabled={busy}
                      onChange={(event) =>
                        setDraftCodes((current) => ({
                          ...current,
                          [row.recordId]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  {fieldErrors[row.recordId] ? (
                    <p role="alert" className="currency-field-error">
                      {fieldErrors[row.recordId]}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="tax-btn tax-btn-primary"
                    disabled={busy}
                    onClick={() => void onSaveCode(row)}
                  >
                    ذخیره
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
};

const CURRENCY_CSS = `
.currency-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.currency-title { margin: 0; font-size: 16px; font-weight: 700; }
.currency-hint, .currency-empty {
  margin: 0;
  font-size: 13px;
  color: var(--t-color-gray10);
}
.currency-error, .currency-field-error {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--t-color-red11);
}
.currency-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  max-width: 520px;
}
.currency-card {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--t-color-gray4);
  border-radius: 10px;
  background: var(--t-color-gray1);
}
.currency-card-main {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
}
.currency-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--t-color-blue11);
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
  .currency-head { flex-direction: column; align-items: stretch; }
  .currency-field input { height: 44px; }
  .currency-card .tax-btn { min-height: 44px; }
}
`;
