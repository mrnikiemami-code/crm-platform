import { type ReactNode } from 'react';

export type ShellTab = {
  id: string;
  label: string;
  count: number;
};

export type ShellStat = {
  label: string;
  value: string;
};

export type ShellFilterOption = {
  id: string;
  label: string;
  count: number;
};

export type SettingsShellProps = {
  title: string;
  subtitle: string;
  tabs: ShellTab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  onBack?: () => void;
  railLabel: string;
  stats: ShellStat[];
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void; busy?: boolean };
  filters?: {
    options: ShellFilterOption[];
    value: string;
    onChange: (id: string) => void;
  };
  helpNote?: ReactNode;
  children: ReactNode;
};

const CSS = `
.fs-shell { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--t-color-gray2); color: var(--t-color-gray12); font-family: inherit; }
.fs-shell * { box-sizing: border-box; }
.fs-bar { background: var(--t-color-gray1); border-bottom: 1px solid var(--t-color-gray4); flex: none; }
.fs-bar-top { display: flex; align-items: center; gap: 10px; padding: 12px 20px 4px; }
.fs-back { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 0; background: transparent; border-radius: 6px; color: var(--t-color-gray11); cursor: pointer; }
.fs-back:hover { background: var(--t-color-gray4); color: var(--t-color-gray12); }
.fs-back:focus-visible { outline: 2px solid var(--t-color-blue9); outline-offset: 2px; }
.fs-titles { min-width: 0; }
.fs-title { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.4; }
.fs-sub { margin: 0; font-size: 12.5px; color: var(--t-color-gray11); line-height: 1.5; }
.fs-tabs { display: flex; gap: 4px; padding: 0 20px; overflow-x: auto; scrollbar-width: none; }
.fs-tabs::-webkit-scrollbar { display: none; }
.fs-tab { position: relative; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; border: 0; background: transparent; padding: 10px 6px 12px; margin-inline-start: 14px; font: inherit; font-size: 14px; font-weight: 500; color: var(--t-color-gray11); cursor: pointer; transition: color 0.15s ease; }
.fs-tab:first-child { margin-inline-start: 0; }
.fs-tab:hover { color: var(--t-color-gray12); }
.fs-tab[aria-selected='true'] { color: var(--t-color-gray12); font-weight: 600; }
.fs-tab[aria-selected='true']::after { content: ''; position: absolute; inset-inline: 0; bottom: 0; height: 2px; background: var(--t-color-blue9); border-radius: 2px 2px 0 0; }
.fs-tab:focus-visible { outline: 2px solid var(--t-color-blue9); outline-offset: -2px; border-radius: 4px; }
.fs-tab-count { font-size: 11px; font-weight: 600; background: var(--t-color-gray4); color: var(--t-color-gray11); border-radius: 999px; padding: 1px 7px; line-height: 1.5; font-variant-numeric: tabular-nums; }
.fs-tab[aria-selected='true'] .fs-tab-count { background: var(--t-color-blue3); color: var(--t-color-blue11); }
.fs-split { flex: 1; display: grid; grid-template-columns: 264px minmax(0, 1fr); min-height: 0; }
.fs-rail { background: var(--t-color-gray1); border-inline-end: 1px solid var(--t-color-gray4); padding: 20px 18px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
.fs-rail-label { font-size: 11.5px; font-weight: 600; color: var(--t-color-gray11); letter-spacing: 0.02em; margin: 0 0 8px; }
.fs-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.fs-stat { background: var(--t-color-gray2); border: 1px solid var(--t-color-gray4); border-radius: 8px; padding: 10px 12px; min-width: 0; }
.fs-stat-cap { display: block; font-size: 11.5px; color: var(--t-color-gray11); margin-bottom: 2px; }
.fs-stat-val { display: block; font-size: 22px; font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; color: var(--t-color-gray12); }
.fs-rail-actions { display: flex; flex-direction: column; gap: 8px; }
.fs-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 36px; padding: 0 14px; border-radius: 6px; border: 1px solid transparent; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease, color 0.15s ease; }
.fs-btn:active { transform: scale(0.98); }
.fs-btn:focus-visible { outline: 2px solid var(--t-color-blue9); outline-offset: 2px; }
.fs-btn-primary { background: var(--t-color-blue9); color: var(--t-color-gray1); }
.fs-btn-primary:hover { background: var(--t-color-blue10); }
.fs-btn-ghost { background: var(--t-color-gray1); border-color: var(--t-color-gray6); color: var(--t-color-gray12); }
.fs-btn-ghost:hover { background: var(--t-color-gray4); }
.fs-btn:disabled { background: var(--t-color-gray5); color: var(--t-color-gray11); border-color: transparent; cursor: not-allowed; transform: none; }
.fs-btn-block { width: 100%; }
.fs-filters { display: flex; flex-wrap: wrap; gap: 6px; }
.fs-chip { border: 1px solid var(--t-color-gray6); background: var(--t-color-gray1); color: var(--t-color-gray11); border-radius: 999px; padding: 4px 12px; font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
.fs-chip:hover { background: var(--t-color-gray4); color: var(--t-color-gray12); }
.fs-chip:focus-visible { outline: 2px solid var(--t-color-blue9); outline-offset: 2px; }
.fs-chip[aria-pressed='true'] { background: var(--t-color-gray12); border-color: var(--t-color-gray12); color: var(--t-color-gray1); }
.fs-chip-count { font-variant-numeric: tabular-nums; opacity: 0.75; margin-inline-start: 4px; }
.fs-help { font-size: 12.5px; line-height: 1.6; color: var(--t-color-gray11); background: var(--t-color-gray2); border: 1px solid var(--t-color-gray4); border-radius: 8px; padding: 10px 12px; margin-top: auto; }
.fs-help strong { color: var(--t-color-gray12); font-weight: 600; }
.fs-content { overflow-y: auto; overscroll-behavior: contain; padding: 20px 24px 36px; min-width: 0; }
.fs-content-inner { max-width: 960px; }
.fs-icon { width: 16px; height: 16px; flex: none; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
@media (max-width: 720px) {
  .fs-split { display: flex; flex-direction: column; }
  .fs-rail { border-inline-end: 0; border-bottom: 1px solid var(--t-color-gray4); padding: 14px 16px 16px; gap: 14px; overflow: visible; }
  .fs-stats { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
  .fs-stats::-webkit-scrollbar { display: none; }
  .fs-stat { min-width: 104px; flex: none; }
  .fs-rail-actions { flex-direction: row; }
  .fs-rail-actions .fs-btn { flex: 1; }
  .fs-filters { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
  .fs-filters::-webkit-scrollbar { display: none; }
  .fs-chip { white-space: nowrap; flex: none; }
  .fs-help { margin-top: 0; }
  .fs-content { padding: 16px 16px 28px; }
  .fs-bar-top { padding: 10px 16px 2px; }
  .fs-title { font-size: 16px; }
  .fs-tabs { padding: 0 16px; }
}
`;

const BackIcon = () => (
  <svg className="fs-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const PlusIcon = () => (
  <svg className="fs-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="fs-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
    <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export const SettingsShell = ({
  title,
  subtitle,
  tabs,
  activeTabId,
  onTabChange,
  onBack,
  railLabel,
  stats,
  primaryAction,
  secondaryAction,
  filters,
  helpNote,
  children,
}: SettingsShellProps) => (
  <div className="fs-shell" dir="rtl">
    <style>{CSS}</style>
    <header className="fs-bar">
      <div className="fs-bar-top">
        {onBack && (
          <button type="button" className="fs-back" aria-label="بازگشت" onClick={onBack}>
            <BackIcon />
          </button>
        )}
        <div className="fs-titles">
          <h1 className="fs-title">{title}</h1>
          <p className="fs-sub">{subtitle}</p>
        </div>
      </div>
      <div className="fs-tabs" role="tablist" aria-label="بخش‌های تنظیمات مالی">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="fs-tab"
            aria-selected={tab.id === activeTabId}
            tabIndex={tab.id === activeTabId ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const index = tabs.findIndex((item) => item.id === activeTabId);
              const delta = event.key === 'ArrowLeft' ? 1 : -1;
              const next = tabs[(index + delta + tabs.length) % tabs.length];
              onTabChange(next.id);
            }}
          >
            {tab.label}
            <span className="fs-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>
    </header>
    <div className="fs-split">
      <aside className="fs-rail">
        <div>
          <p className="fs-rail-label">{railLabel}</p>
          <div className="fs-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="fs-stat">
                <span className="fs-stat-cap">{stat.label}</span>
                <span className="fs-stat-val">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
        {(primaryAction || secondaryAction) && (
          <div className="fs-rail-actions">
            {primaryAction && (
              <button type="button" className="fs-btn fs-btn-primary fs-btn-block" onClick={primaryAction.onClick}>
                <PlusIcon />
                {primaryAction.label}
              </button>
            )}
            {secondaryAction && (
              <button
                type="button"
                className="fs-btn fs-btn-ghost fs-btn-block"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.busy}
              >
                <RefreshIcon />
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
        {filters && (
          <div>
            <p className="fs-rail-label">نمایش</p>
            <div className="fs-filters" role="group" aria-label="فیلتر">
              {filters.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="fs-chip"
                  aria-pressed={filters.value === option.id}
                  onClick={() => filters.onChange(option.id)}
                >
                  {option.label}
                  <span className="fs-chip-count">{option.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {helpNote && <p className="fs-help">{helpNote}</p>}
      </aside>
      <main className="fs-content" role="tabpanel" tabIndex={-1}>
        <div className="fs-content-inner">{children}</div>
      </main>
    </div>
  </div>
);
