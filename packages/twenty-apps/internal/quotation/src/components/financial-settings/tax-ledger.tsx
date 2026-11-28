import { useState } from 'react';

import { RowMenu } from 'src/components/financial-settings/row-menu';

export type TaxPolicyView = {
  id: string;
  code: string;
  name: string;
  ratePercent: string;
  dutyRatePercent: string;
  accountingCode: string;
  isActive: boolean;
  isDefault: boolean;
  quotationCount: number;
};

export type TaxLedgerProps = {
  rows: TaxPolicyView[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCreate?: () => void;
  onEdit: (id: string) => void;
  onMakeDefault: (id: string) => void;
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
  emptyTitle?: string;
  emptyBody?: string;
};

const CSS = `
.tl-register { border: 1px solid var(--t-color-gray5); border-radius: 8px; background: var(--t-color-gray1); }
.tl-head { display: grid; grid-template-columns: minmax(180px, 1.5fr) minmax(230px, 1.6fr) minmax(150px, 1fr) auto; gap: 12px; padding: 9px 18px; border-bottom: 1px solid var(--t-color-gray4); background: var(--t-color-gray2); border-radius: 7px 7px 0 0; font-size: 11.5px; font-weight: 600; color: var(--t-color-gray11); }
.tl-row { position: relative; display: grid; grid-template-columns: minmax(180px, 1.5fr) minmax(230px, 1.6fr) minmax(150px, 1fr) auto; gap: 12px; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--t-color-gray4); transition: background 0.15s ease; }
.tl-row:last-child { border-bottom: 0; }
.tl-row:hover { background: var(--t-color-gray2); }
.tl-row.is-def::before { content: ''; position: absolute; inset-block: 0; inset-inline-start: 0; width: 3px; background: var(--t-color-turquoise9); border-radius: 0 3px 3px 0; }
.tl-row.is-off .tl-name { color: var(--t-color-gray11); }
.tl-ident { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.tl-name { font-size: 16px; font-weight: 500; color: var(--t-color-gray12); margin: 0; line-height: 1.4; }
.tl-badges { display: flex; flex-wrap: wrap; gap: 5px; }
.tl-badge { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; font-size: 11.5px; font-weight: 600; padding: 2px 9px; line-height: 1.6; white-space: nowrap; }
.tl-badge-def { background: var(--t-color-turquoise3); color: var(--t-color-turquoise12); }
.tl-badge-on { background: var(--t-color-gray4); color: var(--t-color-gray11); }
.tl-badge-on::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--t-color-turquoise9); }
.tl-badge-off { background: var(--t-color-gray4); color: var(--t-color-gray11); }
.tl-badge-exempt { background: var(--t-color-orange3); color: var(--t-color-orange12); }
.tl-code { font-size: 12px; color: var(--t-color-gray11); direction: ltr; unicode-bidi: isolate; font-family: var(--t-code-font-family, ui-monospace, monospace); }
.tl-trio { display: grid; grid-template-columns: 1fr 1fr 1fr; }
.tl-st { padding-inline: 12px; border-inline-start: 1px solid var(--t-color-gray4); min-width: 0; }
.tl-st:first-child { border-inline-start: 0; padding-inline-start: 0; }
.tl-st-cap { display: block; font-size: 11.5px; color: var(--t-color-gray11); margin-bottom: 1px; }
.tl-st-num { font-size: 23px; font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; color: var(--t-color-gray11); }
.tl-st.total .tl-st-num { color: var(--t-color-gray12); }
.tl-exempt { display: flex; flex-direction: column; gap: 2px; }
.tl-exempt-big { font-size: 21px; font-weight: 600; color: var(--t-color-orange11); }
.tl-exempt-sub { font-size: 12px; color: var(--t-color-gray11); }
.tl-acct { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.tl-acct-chip { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; background: var(--t-color-gray3); border: 1px solid var(--t-color-gray4); border-radius: 4px; padding: 3px 8px; font-size: 13px; color: var(--t-color-gray12); direction: ltr; unicode-bidi: isolate; font-family: var(--t-code-font-family, ui-monospace, monospace); }
.tl-lock { width: 13px; height: 13px; stroke: var(--t-color-orange11); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.tl-used { font-size: 12.5px; color: var(--t-color-gray11); }
.tl-actions { display: inline-flex; align-items: center; gap: 8px; justify-self: end; }
.tl-menu-dismiss { position: fixed; inset: 0; z-index: 35; background: transparent; }
.tl-empty { border: 1px solid var(--t-color-gray5); border-radius: 8px; background: var(--t-color-gray1); padding: 52px 28px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.tl-empty-ic { width: 46px; height: 46px; border-radius: 12px; background: var(--t-color-gray4); display: flex; align-items: center; justify-content: center; color: var(--t-color-gray11); margin-bottom: 4px; }
.tl-empty-ic svg { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.tl-empty h3 { margin: 0; font-size: 17px; font-weight: 600; color: var(--t-color-gray12); }
.tl-empty p { margin: 0; font-size: 14px; color: var(--t-color-gray11); max-width: 420px; line-height: 1.7; }
.tl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 6px; border: 1px solid transparent; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 10px; transition: background 0.15s ease, transform 0.1s ease; }
.tl-btn:active { transform: scale(0.98); }
.tl-btn:focus-visible { outline: 2px solid var(--t-color-blue9); outline-offset: 2px; }
.tl-btn-primary { background: var(--t-color-blue9); color: var(--t-color-gray1); }
.tl-btn-primary:hover { background: var(--t-color-blue10); }
.tl-btn-ghost { background: var(--t-color-gray1); border-color: var(--t-color-gray6); color: var(--t-color-gray12); margin-top: 0; }
.tl-btn-ghost:hover { background: var(--t-color-gray4); }
.tl-err { display: flex; align-items: flex-start; gap: 10px; padding: 13px 16px; margin-bottom: 16px; background: var(--t-background-danger); border: 1px solid var(--t-color-red5); border-radius: 8px; font-size: 14px; color: var(--t-color-red12); line-height: 1.6; }
.tl-err svg { width: 16px; height: 16px; stroke: var(--t-color-red11); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; margin-top: 3px; flex: none; }
.tl-err-body { flex: 1; min-width: 0; }
.tl-err .tl-btn { height: 30px; font-size: 13px; margin-top: 2px; }
.tl-skel-note { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--t-color-gray11); margin-bottom: 14px; }
.tl-skel-note svg { width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; animation: tl-spin 1s linear infinite; }
@keyframes tl-spin { to { transform: rotate(360deg); } }
.tl-skel-row { display: grid; grid-template-columns: 1.5fr 1.6fr 1fr 44px; gap: 16px; align-items: center; padding: 18px; border-bottom: 1px solid var(--t-color-gray4); }
.tl-skel-row:last-child { border-bottom: 0; }
.tl-skel { background: var(--t-color-gray4); border-radius: 6px; animation: tl-pulse 1.2s ease-in-out infinite alternate; }
@keyframes tl-pulse { from { opacity: 1; } to { opacity: 0.45; } }
.tl-skel-col { display: flex; flex-direction: column; gap: 8px; }
.tl-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 720px) {
  .tl-head { display: none; }
  .tl-row { grid-template-columns: 1fr auto; gap: 8px 10px; padding: 14px 16px; align-items: start; }
  .tl-ident { grid-column: 1; grid-row: 1; }
  .tl-actions { grid-column: 2; grid-row: 1; justify-self: end; flex-direction: column; align-items: stretch; }
  .tl-trio, .tl-exempt { grid-column: 1 / -1; grid-row: 2; background: var(--t-color-gray2); border: 1px solid var(--t-color-gray4); border-radius: 8px; padding: 10px 12px; }
  .tl-st { padding-inline: 8px; }
  .tl-st-num { font-size: 20px; }
  .tl-acct { grid-column: 1 / -1; grid-row: 3; flex-direction: row; align-items: center; gap: 10px; flex-wrap: wrap; }
  .tl-skel-row { grid-template-columns: 1fr; gap: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .tl-skel, .tl-skel-note svg, .tl-menu-anim { animation: none !important; }
}
`;

const faDigits = (value: string | number): string =>
  String(value).replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

const percentText = (value: string): string => {
  const number = Number(value);
  if (Number.isNaN(number)) return faDigits(value);
  const text = Number.isInteger(number) ? String(number) : String(number);
  return faDigits(text);
};

const sumPercent = (tax: string, duty: string): string => {
  const total = (parseFloat(tax) || 0) + (parseFloat(duty) || 0);
  const rounded = Math.round(total * 100) / 100;
  return String(Number.isInteger(rounded) ? rounded : rounded.toFixed(2));
};

const isExemptRow = (row: TaxPolicyView): boolean =>
  parseFloat(row.ratePercent || '0') === 0 &&
  parseFloat(row.dutyRatePercent || '0') === 0;

const InboxIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
    <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const LockIcon = () => (
  <svg className="tl-lock" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const PlusIcon = () => (
  <svg className="tl-lock" viewBox="0 0 24 24" aria-hidden="true" style={{ stroke: 'currentColor' }}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const TaxLedger = ({
  rows,
  loading = false,
  error = null,
  onRetry,
  onCreate,
  onEdit,
  onMakeDefault,
  onToggleActive,
  onDelete,
  emptyTitle = 'هنوز سیاست مالیاتی ثبت نشده',
  emptyBody = 'هر سیاست می‌تواند نرخ مالیات و عوارض مستقل، کد حسابداری و وضعیت فعال داشته باشد.',
}: TaxLedgerProps) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const menuFor = (row: TaxPolicyView) => {
    const guard = row.isDefault
      ? 'این سیاست پیش‌فرض است و نمی‌توان آن را حذف کرد.'
      : row.quotationCount > 0
        ? 'این کد قبلاً در پیش‌فاکتور استفاده شده و قابل حذف نیست.'
        : undefined;
    return (
      <RowMenu
        label={`عملیات ${row.name}`}
        open={openMenuId === row.id}
        onOpenChange={(next) => setOpenMenuId(current => next ? row.id : current === row.id ? null : current)}
        items={[
          { id: 'edit', label: 'ویرایش', onSelect: () => onEdit(row.id) },
          ...(row.isDefault
            ? []
            : [
                {
                  id: 'default',
                  label: 'پیش‌فرض',
                  onSelect: () => onMakeDefault(row.id),
                },
              ]),
          {
            id: 'toggle',
            label: row.isActive ? 'غیرفعال' : 'فعال',
            disabled: row.isActive && row.isDefault,
            disabledReason:
              row.isActive && row.isDefault
                ? 'سیاست پیش‌فرض را نمی‌توان غیرفعال کرد.'
                : undefined,
            onSelect: () => onToggleActive(row.id),
          },
          {
            id: 'delete',
            label: 'حذف',
            danger: true,
            disabled: Boolean(guard),
            disabledReason: guard,
            title: guard,
            onSelect: () => onDelete(row.id),
          },
        ]}
      />
    );
  };

  return (
    <div
      className="tl-root"
      dir="rtl"
      onPointerDown={() => {
        if (openMenuId !== null) {
          setOpenMenuId(null);
        }
      }}
    >
      <style>{CSS}</style>
      {openMenuId !== null ? (
        <div className="tl-menu-dismiss" aria-hidden="true" />
      ) : null}

      {loading && (
        <>
          <div className="tl-skel-note">
            <RefreshIcon />
            در حال بارگذاری سیاست‌ها…
          </div>
          <div className="tl-register" aria-busy="true">
            <span className="tl-sr">در حال بارگذاری</span>
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="tl-skel-row">
                <div className="tl-skel-col">
                  <div className="tl-skel" style={{ height: 16, width: '72%' }} />
                  <div className="tl-skel" style={{ height: 12, width: '45%' }} />
                </div>
                <div className="tl-skel" style={{ height: 30, width: '92%' }} />
                <div className="tl-skel-col">
                  <div className="tl-skel" style={{ height: 14, width: '60%' }} />
                  <div className="tl-skel" style={{ height: 12, width: '40%' }} />
                </div>
                <div className="tl-skel" style={{ height: 26, width: 26, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && error && (
        <div className="tl-err" role="alert">
          <AlertIcon />
          <div className="tl-err-body">{error}</div>
          {onRetry && (
            <button type="button" className="tl-btn tl-btn-ghost" onClick={onRetry}>
              تلاش مجدد
            </button>
          )}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="tl-empty">
          <div className="tl-empty-ic">
            <InboxIcon />
          </div>
          <h3>{emptyTitle}</h3>
          <p>{emptyBody}</p>
          {onCreate && (
            <button type="button" className="tl-btn tl-btn-primary" onClick={onCreate}>
              <PlusIcon />
              سیاست جدید
            </button>
          )}
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="tl-register">
          <div className="tl-head" aria-hidden="true">
            <span>سیاست</span>
            <span>نرخ‌ها</span>
            <span>حسابداری</span>
            <span />
          </div>
          {rows.map((row) => {
            const exempt = isExemptRow(row);
            return (
              <div
                key={row.id}
                className={[
                  'tl-row',
                  row.isDefault ? 'is-def' : '',
                  row.isActive ? '' : 'is-off',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-record-id={row.id}
              >
                <div className="tl-ident">
                  <p className="tl-name">{row.name}</p>
                  <div className="tl-badges">
                    {row.isDefault && <span className="tl-badge tl-badge-def">پیش‌فرض</span>}
                    {exempt && <span className="tl-badge tl-badge-exempt">معاف</span>}
                    <span className={row.isActive ? 'tl-badge tl-badge-on' : 'tl-badge tl-badge-off'}>
                      {row.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>
                  <span className="tl-code">{row.code}</span>
                </div>

                {exempt ? (
                  <div className="tl-exempt">
                    <span className="tl-exempt-big">معاف</span>
                    <span className="tl-exempt-sub">مالیات و عوارض صفر است</span>
                  </div>
                ) : (
                  <div className="tl-trio">
                    <div className="tl-st">
                      <span className="tl-st-cap">مالیات</span>
                      <span className="tl-st-num">{percentText(row.ratePercent)}٪</span>
                    </div>
                    <div className="tl-st">
                      <span className="tl-st-cap">عوارض</span>
                      <span className="tl-st-num">{percentText(row.dutyRatePercent)}٪</span>
                    </div>
                    <div className="tl-st total">
                      <span className="tl-st-cap">مجموع</span>
                      <span className="tl-st-num">
                        {percentText(sumPercent(row.ratePercent, row.dutyRatePercent))}٪
                      </span>
                    </div>
                  </div>
                )}

                <div className="tl-acct">
                  <span className="tl-acct-chip">
                    {row.quotationCount > 0 && <LockIcon />}
                    {row.accountingCode}
                  </span>
                  <span className="tl-used">
                    {row.quotationCount > 0
                      ? `در ${faDigits(row.quotationCount)} سند استفاده شده`
                      : 'بدون سند'}
                  </span>
                </div>

                <div className="tl-actions">{menuFor(row)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
