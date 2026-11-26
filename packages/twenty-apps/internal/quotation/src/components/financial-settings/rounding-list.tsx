import { useState } from 'react';

import { RowMenu } from 'src/components/financial-settings/row-menu';

export type RoundingRuleView = {
  id: string;
  stepAmount: string;
  isDefault: boolean;
  isActive: boolean;
  quotationCount: number;
};

export type RoundingListProps = {
  rows: RoundingRuleView[];
  defaultStep: string;
  currencyNote?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCreate?: () => void;
  onEdit: (id: string) => void;
  onMakeDefault: (id: string) => void;
  onDelete: (id: string) => void;
};

const CSS = `
.rl-root { direction: rtl; display: flex; flex-direction: column; gap: 18px; }
.rl-ladder { display: flex; flex-direction: column; gap: 0; counter-reset: rl-step; }
.rl-step { position: relative; display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; gap: 14px; align-items: start; padding: 16px 18px 16px 18px; background: var(--t-color-gray1); border: 1px solid var(--t-color-gray5); border-top: 0; transition: background 0.15s ease; }
.rl-step:first-child { border-top: 1px solid var(--t-color-gray5); border-radius: 8px 8px 0 0; }
.rl-step:last-child { border-radius: 0 0 8px 8px; }
.rl-step:only-child { border-radius: 8px; border-top: 1px solid var(--t-color-gray5); }
.rl-step:hover { background: var(--t-color-gray2); }
.rl-step.is-def { background: var(--t-color-turquoise2); border-color: var(--t-color-turquoise6); }
.rl-step.is-def:hover { background: var(--t-color-turquoise3); }
.rl-step.is-off .rl-step-num { color: var(--t-color-gray9); }
.rl-marker { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--t-color-gray6); background: var(--t-color-gray1); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--t-color-gray11); font-variant-numeric: tabular-nums; margin-top: 2px; }
.rl-step.is-def .rl-marker { border-color: var(--t-color-turquoise9); background: var(--t-color-turquoise9); color: var(--t-color-gray1); }
.rl-step-body { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.rl-step-num { font-size: 22px; font-weight: 650; color: var(--t-color-gray12); font-variant-numeric: tabular-nums; line-height: 1.3; }
.rl-step.is-def .rl-step-num { color: var(--t-color-turquoise12); }
.rl-badges { display: flex; flex-wrap: wrap; gap: 5px; }
.rl-badge { display: inline-flex; align-items: center; border-radius: 999px; font-size: 11.5px; font-weight: 600; padding: 2px 9px; line-height: 1.6; white-space: nowrap; }
.rl-badge-def { background: var(--t-color-turquoise3); color: var(--t-color-turquoise12); }
.rl-badge-on { background: var(--t-color-gray4); color: var(--t-color-gray11); }
.rl-badge-on::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--t-color-turquoise9); }
.rl-badge-off { background: var(--t-color-gray4); color: var(--t-color-gray11); }
.rl-used { font-size: 12.5px; color: var(--t-color-gray11); }
.rl-step-tail { display: flex; align-items: center; gap: 8px; padding-top: 2px; }
.rl-edit { height: 32px; min-height: 32px; padding: 0 12px; font-size: 13px; margin-top: 0; }
.rl-empty { border: 1px solid var(--t-color-gray5); border-radius: 8px; background: var(--t-color-gray1); padding: 48px 28px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.rl-empty h3 { margin: 0; font-size: 17px; font-weight: 600; color: var(--t-color-gray12); }
.rl-empty p { margin: 0; font-size: 14px; color: var(--t-color-gray11); max-width: 440px; line-height: 1.7; }
.rl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 6px; border: 1px solid transparent; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s ease, transform 0.1s ease; }
.rl-btn:active { transform: scale(0.98); }
.rl-btn:focus-visible { outline: 2px solid var(--t-color-blue9); outline-offset: 2px; }
.rl-btn-primary { background: var(--t-color-blue9); color: var(--t-color-gray1); }
.rl-btn-primary:hover { background: var(--t-color-blue10); }
.rl-btn-ghost { background: var(--t-color-gray1); border-color: var(--t-color-gray6); color: var(--t-color-gray12); }
.rl-btn-ghost:hover { background: var(--t-color-gray4); }
.rl-err { display: flex; align-items: flex-start; gap: 10px; padding: 13px 16px; background: var(--t-background-danger); border: 1px solid var(--t-color-red5); border-radius: 8px; font-size: 14px; color: var(--t-color-red12); line-height: 1.6; }
.rl-err svg { width: 16px; height: 16px; stroke: var(--t-color-red11); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; margin-top: 3px; flex: none; }
.rl-skel-note { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--t-color-gray11); }
.rl-skel-note svg { width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; animation: rl-spin 1s linear infinite; }
@keyframes rl-spin { to { transform: rotate(360deg); } }
.rl-skel-row { display: grid; grid-template-columns: 36px 1fr; gap: 14px; padding: 18px; border-bottom: 1px solid var(--t-color-gray4); }
.rl-skel-row:last-child { border-bottom: 0; }
.rl-skel { background: var(--t-color-gray4); border-radius: 6px; animation: rl-pulse 1.2s ease-in-out infinite alternate; }
@keyframes rl-pulse { from { opacity: 1; } to { opacity: 0.45; } }
.rl-banner { display: flex; gap: 10px; align-items: flex-start; padding: 13px 16px; background: var(--t-color-gray2); border: 1px solid var(--t-color-gray4); border-radius: 8px; font-size: 13.5px; line-height: 1.6; color: var(--t-color-gray11); }
.rl-banner svg { width: 16px; height: 16px; stroke: var(--t-color-orange11); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; margin-top: 3px; flex: none; }
@media (max-width: 720px) {
  .rl-step { grid-template-columns: 30px minmax(0, 1fr); padding: 14px 16px; }
  .rl-step-tail { grid-column: 2; padding-top: 0; flex-wrap: wrap; }
  .rl-edit { min-height: 36px; height: 36px; }
  .rl-marker { width: 26px; height: 26px; font-size: 12px; }
  .rl-step-num { font-size: 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .rl-skel, .rl-skel-note svg { animation: none !important; }
}
`;

const faDigits = (value: string | number): string =>
  String(value).replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

const refreshIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
    <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const alertIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const infoIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

const plusIcon = (
  <svg className="rl-marker" viewBox="0 0 24 24" aria-hidden="true" style={{ border: 0, background: 'transparent', width: 18, height: 18, stroke: 'currentColor', fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round' }}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const RoundingList = ({
  rows,
  defaultStep,
  currencyNote = 'مبالغ پیش‌فاکتور به نزدیک‌ترین مضرب این قاعده رُند می‌شوند.',
  loading = false,
  error = null,
  onRetry,
  onCreate,
  onEdit,
  onMakeDefault,
  onDelete,
}: RoundingListProps) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <div className="rl-root" dir="rtl">
      <style>{CSS}</style>

      <div className="rl-banner">
        {infoIcon}
        <span>
          قاعده پیش‌فرض فعلی: <strong>{faDigits(defaultStep)} ریال</strong>. {currencyNote}
        </span>
      </div>

      {loading && (
        <>
          <div className="rl-skel-note">
            {refreshIcon}
            در حال بارگذاری قواعد رُند…
          </div>
          <div className="rl-ladder" aria-busy="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="rl-skel-row">
                <div className="rl-skel" style={{ height: 30, borderRadius: '50%' }} />
                <div className="rl-skel-col" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="rl-skel" style={{ height: 18, width: '34%' }} />
                  <div className="rl-skel" style={{ height: 13, width: '52%' }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && error && (
        <div className="rl-err" role="alert">
          {alertIcon}
          <div style={{ flex: 1, minWidth: 0 }}>{error}</div>
          {onRetry && (
            <button type="button" className="rl-btn rl-btn-ghost" onClick={onRetry}>
              تلاش مجدد
            </button>
          )}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="rl-empty">
          <h3>هنوز قاعده رُندی ثبت نشده</h3>
          <p>
            یک قاعده پیش‌فرض بسازید تا مبالغ اسناد مالی به نزدیک‌ترین مضرب آن رُند شوند.
          </p>
          {onCreate && (
            <button type="button" className="rl-btn rl-btn-primary" onClick={onCreate}>
              ساخت اولین قاعده
            </button>
          )}
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="rl-ladder">
          {rows.map((row, index) => {
            const guard = row.isDefault
              ? 'این قاعده پیش‌فرض است و نمی‌توان آن را حذف کرد.'
              : row.quotationCount > 0
                ? 'این قاعده در پیش‌فاکتور استفاده شده و حذف نمی‌شود.'
                : undefined;
            return (
              <div
                key={row.id}
                className={[
                  'rl-step',
                  row.isDefault ? 'is-def' : '',
                  row.isActive ? '' : 'is-off',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-record-id={row.id}
              >
                <span className="rl-marker" aria-hidden="true">{faDigits(index + 1)}</span>
                <div className="rl-step-body">
                  <span className="rl-step-num">{faDigits(row.stepAmount)} ریال</span>
                  <div className="rl-badges">
                    {row.isDefault && <span className="rl-badge rl-badge-def">پیش‌فرض</span>}
                    <span className={row.isActive ? 'rl-badge rl-badge-on' : 'rl-badge rl-badge-off'}>
                      {row.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>
                  <span className="rl-used">
                    {row.quotationCount > 0
                      ? `در ${faDigits(row.quotationCount)} سند استفاده شده`
                      : 'بدون سند'}
                  </span>
                </div>
                <div className="rl-step-tail">
                  <button
                    type="button"
                    className="rl-btn rl-btn-ghost rl-edit"
                    aria-label={`ویرایش — ${row.stepAmount} ریال`}
                    onClick={() => onEdit(row.id)}
                  >
                    ویرایش
                  </button>
                  <RowMenu
                    label={`عملیات قاعده ${row.stepAmount}`}
                    open={openMenuId === row.id}
                    onOpenChange={(next) => setOpenMenuId(next ? row.id : null)}
                    items={[
                      { id: 'edit', label: 'ویرایش', onSelect: () => onEdit(row.id) },
                      {
                        id: 'default',
                        label: 'پیش‌فرض',
                        disabled: row.isDefault,
                        disabledReason: row.isDefault
                          ? 'این قاعده هم‌اکنون پیش‌فرض است.'
                          : undefined,
                        onSelect: () => onMakeDefault(row.id),
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
