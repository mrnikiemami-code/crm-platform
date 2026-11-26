export type CurrencyHeroProps = {
  recordId: string;
  code: string;
  name: string;
  accountingCode: string;
  isDefault: boolean;
  isActive: boolean;
  phaseLabel?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onEditCode: (recordId: string) => void;
};

const CSS = `
.ch-root { direction: rtl; }
.ch-dossier { border: 1px solid var(--t-color-gray5, #ebebeb); border-radius: 8px; background: var(--t-color-gray1, #ffffff); overflow: hidden; }
.ch-top { padding: 26px 28px 22px; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px; justify-content: space-between; }
.ch-id { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.ch-name { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin: 0; line-height: 1.25; color: var(--t-color-gray12, #333333); }
.ch-badges { display: flex; flex-wrap: wrap; gap: 6px; }
.ch-badge { display: inline-flex; align-items: center; border-radius: 999px; font-size: 11.5px; font-weight: 600; padding: 2px 9px; line-height: 1.6; white-space: nowrap; }
.ch-badge-def { background: var(--t-color-turquoise3, #e5f7f3); color: var(--t-color-turquoise12, #1c3c38); }
.ch-badge-phase { background: var(--t-color-blue3, #eef2fd); color: var(--t-color-blue12, #222c59); }
.ch-badge-on { background: var(--t-color-gray4, #f1f1f1); color: var(--t-color-gray11, #666666); }
.ch-badge-on::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--t-color-turquoise9, #4ca394); }
.ch-badge-off { background: var(--t-color-gray4, #f1f1f1); color: var(--t-color-gray11, #666666); }
.ch-badge-code { background: transparent; border: 1px solid var(--t-color-gray5, #ebebeb); color: var(--t-color-gray11, #666666); direction: ltr; unicode-bidi: isolate; font-family: var(--t-code-font-family, ui-monospace, monospace); }
.ch-mark { width: 56px; height: 56px; border-radius: 12px; background: var(--t-color-gray12, #333333); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; letter-spacing: 0.04em; flex: none; direction: ltr; }
.ch-grid { display: grid; grid-template-columns: 1.3fr 1fr 1fr; border-top: 1px solid var(--t-color-gray4, #f1f1f1); }
.ch-cell { padding: 18px 28px; border-inline-start: 1px solid var(--t-color-gray4, #f1f1f1); display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ch-cell:first-child { border-inline-start: 0; }
.ch-cap { font-size: 11.5px; font-weight: 600; color: var(--t-color-gray11, #666666); }
.ch-acct { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ch-acct-val { font-size: 26px; font-weight: 600; font-family: var(--t-code-font-family, ui-monospace, monospace); letter-spacing: 0.02em; color: var(--t-color-gray12, #333333); direction: ltr; unicode-bidi: isolate; }
.ch-val { font-size: 17px; font-weight: 600; color: var(--t-color-gray12, #333333); }
.ch-sub { font-size: 13px; color: var(--t-color-gray11, #666666); line-height: 1.6; }
.ch-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 6px; border: 1px solid transparent; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease; }
.ch-btn:active { transform: scale(0.98); }
.ch-btn:focus-visible { outline: 2px solid var(--t-color-blue9, #4762d5); outline-offset: 2px; }
.ch-btn-ghost { background: var(--t-color-gray1, #ffffff); border-color: var(--t-color-gray6, #d6d6d6); color: var(--t-color-gray12, #333333); }
.ch-btn-ghost:hover { background: var(--t-color-gray4, #f1f1f1); }
.ch-note { display: flex; gap: 10px; align-items: flex-start; padding: 14px 28px; background: var(--t-color-blue2, #f8f9fe); border-top: 1px solid var(--t-color-gray4, #f1f1f1); font-size: 13.5px; line-height: 1.6; color: var(--t-color-blue12, #222c59); }
.ch-note svg { width: 16px; height: 16px; stroke: var(--t-color-blue11, #415ac0); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; margin-top: 3px; flex: none; }
.ch-future { padding: 16px 28px; border-top: 1px solid var(--t-color-gray4, #f1f1f1); display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--t-color-gray11, #666666); }
.ch-ghost-row { flex: 1; border: 1px dashed var(--t-color-gray6, #d6d6d6); border-radius: 6px; padding: 8px 12px; font-size: 12.5px; color: var(--t-color-gray9, #999999); text-align: center; }
.ch-err { display: flex; align-items: flex-start; gap: 10px; padding: 13px 16px; margin-bottom: 16px; background: var(--t-background-danger, #fcecec); border: 1px solid var(--t-color-red5, #fbcfcf); border-radius: 8px; font-size: 14px; color: var(--t-color-red12, #5c1d24); line-height: 1.6; }
.ch-err svg { width: 16px; height: 16px; stroke: var(--t-color-red11, #be3b39); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; margin-top: 3px; flex: none; }
.ch-err .ch-btn { height: 30px; font-size: 13px; }
.ch-skel-note { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--t-color-gray11, #666666); margin-bottom: 14px; }
.ch-skel-note svg { width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; animation: ch-spin 1s linear infinite; }
@keyframes ch-spin { to { transform: rotate(360deg); } }
.ch-skel-block { border: 1px solid var(--t-color-gray5, #ebebeb); border-radius: 8px; background: var(--t-color-gray1, #ffffff); padding: 26px; }
.ch-skel { background: var(--t-color-gray4, #f1f1f1); border-radius: 6px; animation: ch-pulse 1.2s ease-in-out infinite alternate; }
@keyframes ch-pulse { from { opacity: 1; } to { opacity: 0.45; } }
.ch-pencil { width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
@media (max-width: 720px) {
  .ch-top { padding: 20px 18px 16px; }
  .ch-name { font-size: 23px; }
  .ch-grid { grid-template-columns: 1fr; }
  .ch-cell { padding: 14px 18px; border-inline-start: 0; border-top: 1px solid var(--t-color-gray4, #f1f1f1); }
  .ch-cell:first-child { border-top: 0; }
  .ch-note, .ch-future { padding: 14px 18px; }
  .ch-future { flex-direction: column; align-items: stretch; }
}
@media (prefers-reduced-motion: reduce) {
  .ch-skel, .ch-skel-note svg { animation: none !important; }
}
`;

const PencilIcon = () => (
  <svg className="ch-pencil" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
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

export const CurrencyHero = ({
  recordId,
  code,
  name,
  accountingCode,
  isDefault,
  isActive,
  phaseLabel = 'فاز ۱',
  loading = false,
  error = null,
  onRetry,
  onEditCode,
}: CurrencyHeroProps) => (
  <div className="ch-root" dir="rtl">
    <style>{CSS}</style>

    {loading && (
      <>
        <div className="ch-skel-note">
          <RefreshIcon />
          در حال بررسی ارز پایه…
        </div>
        <div className="ch-skel-block" aria-busy="true">
          <div className="ch-skel" style={{ height: 28, width: '46%', marginBottom: 12 }} />
          <div className="ch-skel" style={{ height: 16, width: '30%', marginBottom: 24 }} />
          <div className="ch-skel" style={{ height: 64, width: '100%' }} />
        </div>
      </>
    )}

    {!loading && error && (
      <div className="ch-err" role="alert">
        <AlertIcon />
        <div style={{ flex: 1, minWidth: 0 }}>{error}</div>
        {onRetry && (
          <button type="button" className="ch-btn ch-btn-ghost" onClick={onRetry}>
            تلاش مجدد
          </button>
        )}
      </div>
    )}

    {!loading && !error && (
      <div className="ch-dossier">
        <div className="ch-top">
          <div className="ch-id">
            <h2 className="ch-name">{name}</h2>
            <div className="ch-badges">
              {isDefault && <span className="ch-badge ch-badge-def">پیش‌فرض</span>}
              <span className="ch-badge ch-badge-phase">{phaseLabel}</span>
              <span className={isActive ? 'ch-badge ch-badge-on' : 'ch-badge ch-badge-off'}>
                {isActive ? 'فعال' : 'غیرفعال'}
              </span>
              <span className="ch-badge ch-badge-code">{code}</span>
            </div>
          </div>
          <div className="ch-mark" aria-hidden="true">{code}</div>
        </div>

        <div className="ch-grid">
          <div className="ch-cell">
            <span className="ch-cap">کد حسابداری</span>
            <div className="ch-acct">
              <span className="ch-acct-val">{accountingCode}</span>
              <button
                type="button"
                className="ch-btn ch-btn-ghost"
                onClick={() => onEditCode(recordId)}
              >
                <PencilIcon />
                ویرایش
              </button>
            </div>
            <span className="ch-sub">در اسناد مالی با این کد ثبت می‌شود</span>
          </div>
          <div className="ch-cell">
            <span className="ch-cap">دامنه عملیاتی</span>
            <span className="ch-val">فقط {name}</span>
            <span className="ch-sub">ارزهای دیگر به فازهای بعدی منتقل می‌شوند</span>
          </div>
          <div className="ch-cell">
            <span className="ch-cap">وضعیت پیش‌فرض</span>
            <span className="ch-val">ارز پیش‌فرض صورتحساب</span>
            <span className="ch-sub">تغییر پیش‌فرض توسط سرور مدیریت می‌شود</span>
          </div>
        </div>

        <div className="ch-note">
          <InfoIcon />
          <span>
            راه‌اندازی ارز پایه به‌صورت خودکار و بدون دکمه جداگانه انجام می‌شود؛
            پس از اولین بارگذاری، این ارز آماده استفاده است.
          </span>
        </div>

        <div className="ch-future">
          <span>ارز بعدی:</span>
          <span className="ch-ghost-row">در فاز ۱ اضافه نمی‌شود — منتظر پشتیبانی چندارزی</span>
        </div>
      </div>
    )}
  </div>
);
