import { useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import {
  QUOTATION_CURRENCIES_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

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

// Minimal phase-1 currency catalog UI: bootstrap IRR, edit optional accounting
// code. No quotation draft fields here (C3).
export const QuotationCurrencySettingsSection = () => {
  const [opened, setOpened] = useState(false);
  const [rows, setRows] = useState<CurrencyRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftCodes, setDraftCodes] = useState<Record<string, string>>({});

  const applyPayload = useCallback((data: Record<string, unknown>) => {
    const next = readRows(data);
    setRows(next);
    setDraftCodes(
      Object.fromEntries(
        next.map((row) => [row.recordId, row.accountingCode]),
      ),
    );
  }, []);

  const runAction = useCallback(
    async (body: Record<string, unknown>, successMessage: string) => {
      setBusy(true);
      setLoadError(null);

      try {
        const response = await callAppRoute(QUOTATION_CURRENCIES_ROUTE, body);
        const data = response.data;

        if (data.success !== true) {
          const message = toPersianUiMessage(
            data.message,
            'عملیات ارز ناموفق بود',
          );
          setLoadError(message);
          enqueueSnackbar(message, { variant: 'error' });

          return;
        }

        applyPayload(data);
        if (body.action !== 'list') {
          enqueueSnackbar(successMessage, { variant: 'success' });
        }
      } catch {
        const message = 'ارتباط با سرور برقرار نشد';
        setLoadError(message);
        enqueueSnackbar(message, { variant: 'error' });
      } finally {
        setBusy(false);
      }
    },
    [applyPayload],
  );

  // Open on demand so the tax-panel test surface stays isolated from currency
  // fetches (same page, separate concern until WS7 redesign).
  useEffect(() => {
    if (!opened) {
      return;
    }

    void runAction({ action: 'list' }, 'فهرست ارز خوانده شد');
  }, [opened, runAction]);

  return (
    <section
      aria-labelledby="quotation-currency-heading"
      style={{
        marginTop: 28,
        paddingTop: 20,
        borderTop: '1px solid var(--t-color-gray4)',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <div>
          <h2
            id="quotation-currency-heading"
            style={{ margin: 0, fontSize: 16, fontWeight: 700 }}
          >
            ارزهای فضای کاری
          </h2>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 13,
              color: 'var(--t-color-gray10)',
            }}
          >
            فاز اول فقط ریال برای مبالغ عملیاتی. کد حسابداری اختیاری است و در
            فرم پیش‌فاکتور تایپ نمی‌شود.
          </p>
        </div>
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
        ) : (
          <button
            type="button"
            className="tax-btn"
            onClick={() => setOpened(true)}
          >
            مدیریت ارزها
          </button>
        )}
      </header>

      {opened ? null : (
        <p style={{ fontSize: 13, color: 'var(--t-color-gray10)', margin: 0 }}>
          برای راه‌اندازی ریال و ویرایش کد حسابداری ارز، «مدیریت ارزها» را باز
          کنید.
        </p>
      )}

      {opened ? (
        <>

      {loadError === null ? null : (
        <p role="alert" style={{ color: 'var(--t-color-red11)', fontSize: 13 }}>
          {loadError}
        </p>
      )}

      {rows.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--t-color-gray11)' }}>
          هنوز ارزی ثبت نشده. «راه‌اندازی ریال» را بزنید.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: 10,
          }}
        >
          {rows.map((row) => (
            <li
              key={row.recordId}
              style={{
                display: 'grid',
                gridTemplateColumns: '88px 1fr 180px auto',
                gap: 10,
                alignItems: 'center',
                padding: '10px 12px',
                border: '1px solid var(--t-color-gray4)',
                borderRadius: 8,
              }}
            >
              <strong dir="ltr">{row.code}</strong>
              <span>
                {row.name}
                {row.isDefault ? ' · پیش‌فرض' : ''}
                {row.isActive ? '' : ' · غیرفعال'}
              </span>
              <input
                aria-label={`کد حسابداری ${row.code}`}
                value={draftCodes[row.recordId] ?? ''}
                dir="ltr"
                maxLength={64}
                placeholder="کد حسابداری"
                disabled={busy}
                onChange={(event) =>
                  setDraftCodes((current) => ({
                    ...current,
                    [row.recordId]: event.target.value,
                  }))
                }
              />
              <button
                type="button"
                className="tax-btn tax-btn-primary"
                disabled={busy}
                onClick={() =>
                  void runAction(
                    {
                      action: 'save',
                      recordId: row.recordId,
                      name: row.name,
                      accountingCodeText: draftCodes[row.recordId] ?? '',
                      isActive: row.isActive,
                      isDefault: row.isDefault,
                    },
                    'ارز ذخیره شد',
                  )
                }
              >
                ذخیره کد
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
