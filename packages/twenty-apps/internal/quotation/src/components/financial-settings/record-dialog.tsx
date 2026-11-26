import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

export type RecordFieldType = 'text' | 'number' | 'switch';

export type RecordField = {
  id: string;
  label: string;
  type: RecordFieldType;
  value: string | boolean;
  onInput: (value: string | boolean) => void;
  onBlur?: () => void;
  error?: string;
  hint?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  inputMode?: 'decimal' | 'numeric';
  placeholder?: string;
};

export type RecordDialogProps = {
  title: string;
  subtitle?: string;
  fields: RecordField[];
  summary?: ReactNode;
  footerNote?: ReactNode;
  busy?: boolean;
  dirty?: boolean;
  saveLabel?: string;
  onClose: () => void;
  onSave: () => void;
};

const CSS = `
.rd-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.32); display: flex; align-items: flex-start; justify-content: center; padding: 7vh 16px 24px; overflow-y: auto; animation: rd-fade 0.16s ease-out; }
@keyframes rd-fade { from { opacity: 0; } to { opacity: 1; } }
.rd-panel { width: 100%; max-width: 520px; background: var(--t-color-gray1); border: 1px solid var(--t-color-gray5); border-radius: 10px; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18); animation: rd-rise 0.18s cubic-bezier(0.2, 0.9, 0.3, 1); }
@keyframes rd-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.rd-head { padding: 20px 22px 14px; border-bottom: 1px solid var(--t-color-gray4); }
.rd-title { margin: 0; font-size: 17px; font-weight: 600; color: var(--t-color-gray12); }
.rd-sub { margin: 4px 0 0; font-size: 13px; color: var(--t-color-gray11); line-height: 1.6; }
.rd-body { padding: 18px 22px 6px; display: flex; flex-direction: column; gap: 16px; }
.rd-field { display: flex; flex-direction: column; gap: 6px; }
.rd-label { font-size: 13px; font-weight: 600; color: var(--t-color-gray12); }
.rd-req { color: var(--t-color-red11); margin-inline-start: 2px; }
.rd-input { height: 38px; padding: 0 12px; border: 1px solid var(--t-color-gray6); border-radius: 6px; background: var(--t-color-gray1); font: inherit; font-size: 15px; color: var(--t-color-gray12); transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.rd-input::placeholder { color: var(--t-color-gray9); }
.rd-input:hover:not(:disabled) { border-color: var(--t-color-gray8); }
.rd-input:focus { outline: none; border-color: var(--t-color-blue9); box-shadow: 0 0 0 3px var(--t-color-blue3); }
.rd-input:disabled { background: var(--t-color-gray4); color: var(--t-color-gray11); cursor: not-allowed; }
.rd-input.has-error { border-color: var(--t-color-red11); }
.rd-input.has-error:focus { box-shadow: 0 0 0 3px var(--t-color-red3); }
.rd-input.num { direction: ltr; text-align: left; font-variant-numeric: tabular-nums; }
.rd-hint { font-size: 12.5px; color: var(--t-color-gray11); line-height: 1.6; }
.rd-error { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--t-color-red11); font-weight: 500; }
.rd-error svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.rd-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; background: var(--t-color-gray2); border: 1px solid var(--t-color-gray4); border-radius: 8px; padding: 12px 14px; }
.rd-switch-text { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.rd-switch { position: relative; width: 36px; height: 20px; flex: none; border: 0; border-radius: 999px; background: var(--t-color-gray7); cursor: pointer; transition: background 0.15s ease; padding: 0; }
.rd-switch::after { content: ''; position: absolute; top: 2px; inset-inline-start: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--t-color-gray1); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); transition: transform 0.15s ease; }
.rd-switch[aria-checked='true'] { background: var(--t-color-blue9); }
.rd-switch[aria-checked='true']::after { transform: translateX(-16px); }
.rd-switch:focus-visible { outline: 2px solid var(--t-color-blue9); outline-offset: 2px; }
.rd-switch:disabled { opacity: 0.55; cursor: not-allowed; }
.rd-summary { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; background: var(--t-color-gray2); border: 1px solid var(--t-color-gray4); border-radius: 8px; padding: 12px 14px; font-size: 13px; color: var(--t-color-gray11); }
.rd-summary-val { font-size: 20px; font-weight: 650; color: var(--t-color-gray12); font-variant-numeric: tabular-nums; }
.rd-note { font-size: 12.5px; color: var(--t-color-gray11); line-height: 1.6; padding: 0 22px 4px; margin: 0; }
.rd-foot { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 16px 22px 20px; border-top: 1px solid var(--t-color-gray4); margin-top: 14px; }
.rd-btn { height: 38px; padding: 0 16px; border-radius: 6px; border: 1px solid transparent; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s ease, transform 0.1s ease; white-space: nowrap; }
.rd-btn:active:not(:disabled) { transform: scale(0.98); }
.rd-btn:focus-visible { outline: 2px solid var(--t-color-blue9); outline-offset: 2px; }
.rd-btn-ghost { background: var(--t-color-gray1); border-color: var(--t-color-gray6); color: var(--t-color-gray12); }
.rd-btn-ghost:hover { background: var(--t-color-gray4); }
.rd-btn-primary { background: var(--t-color-blue9); color: var(--t-color-gray1); }
.rd-btn-primary:hover { background: var(--t-color-blue10); }
.rd-btn-danger { background: var(--t-color-red11); color: var(--t-color-gray1); }
.rd-btn-danger:hover { background: var(--t-color-red12); }
.rd-btn:disabled { background: var(--t-color-gray5); color: var(--t-color-gray11); border-color: transparent; cursor: not-allowed; transform: none; }
.rd-discard { display: flex; gap: 10px; align-items: flex-start; padding: 13px 22px; background: var(--t-color-orange3); border-top: 1px solid var(--t-color-orange5); font-size: 13.5px; line-height: 1.6; color: var(--t-color-orange12); }
.rd-discard svg { width: 16px; height: 16px; stroke: var(--t-color-orange11); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; margin-top: 3px; flex: none; }
.rd-discard-body { flex: 1; min-width: 0; }
.rd-discard-actions { display: flex; gap: 8px; margin-top: 8px; }
.rd-discard-actions .rd-btn { height: 30px; font-size: 13px; padding: 0 12px; }
.rd-lock { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--t-color-orange11); font-weight: 600; }
.rd-lock svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
@media (max-width: 720px) {
  .rd-overlay { padding: 0; align-items: flex-end; }
  .rd-panel { max-width: none; border-radius: 14px 14px 0 0; border-bottom: 0; max-height: 92vh; overflow-y: auto; animation: rd-sheet 0.2s cubic-bezier(0.2, 0.9, 0.3, 1); }
  @keyframes rd-sheet { from { transform: translateY(24px); opacity: 0.6; } to { transform: none; opacity: 1; } }
  .rd-head { padding: 18px 18px 12px; }
  .rd-body { padding: 16px 18px 4px; }
  .rd-note { padding: 0 18px 4px; }
  .rd-foot { padding: 14px 18px calc(16px + env(safe-area-inset-bottom)); position: sticky; bottom: 0; background: var(--t-color-gray1); }
  .rd-foot .rd-btn { flex: 1; }
  .rd-discard { padding: 13px 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .rd-overlay, .rd-panel { animation: none !important; }
}
`;

const ErrorIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

const WarnIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const RecordDialog = ({
  title,
  subtitle,
  fields,
  summary,
  footerNote,
  busy = false,
  dirty = false,
  saveLabel = 'ذخیره',
  onClose,
  onSave,
}: RecordDialogProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const [pendingClose, setPendingClose] = useState(false);

  const requestClose = () => {
    if (busy) return;
    if (dirty) {
      setPendingClose(true);
      return;
    }
    onClose();
  };

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  useEffect(() => {
    if (pendingClose) {
      panelRef.current
        ?.querySelector<HTMLButtonElement>('[data-discard-focus]')
        ?.focus();
    }
  }, [pendingClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (pendingClose) {
          setPendingClose(false);
          return;
        }
        requestClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) return;
      const first = focusables[0] as HTMLElement;
      const last = focusables[focusables.length - 1] as HTMLElement;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [busy, dirty, pendingClose]);

  return (
    <div
      className="rd-overlay"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <style>{CSS}</style>
      <div
        ref={panelRef}
        className="rd-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="rd-head">
          <h2 className="rd-title" id={titleId}>
            {title}
          </h2>
          {subtitle && <p className="rd-sub">{subtitle}</p>}
        </div>

        <div className="rd-body">
          {fields.map((field) => {
            if (field.type === 'switch') {
              const checked = field.value === true;
              return (
                <div key={field.id} className="rd-field">
                  <div className="rd-switch-row">
                    <div className="rd-switch-text">
                      <span className="rd-label">
                        {field.label}
                        {field.required && <span className="rd-req">*</span>}
                      </span>
                      {field.hint && <span className="rd-hint">{field.hint}</span>}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      className="rd-switch"
                      aria-checked={checked}
                      aria-label={field.label}
                      disabled={field.disabled || busy}
                      onClick={() => field.onInput(!checked)}
                    />
                  </div>
                  {field.error && (
                    <span className="rd-error">
                      <ErrorIcon />
                      {field.error}
                    </span>
                  )}
                </div>
              );
            }

            const hasError = Boolean(field.error);
            const isLockedHint = field.disabled && field.hint;

            return (
              <div key={field.id} className="rd-field">
                <label className="rd-label" htmlFor={`rd-${field.id}`}>
                  {field.label}
                  {field.required && <span className="rd-req">*</span>}
                </label>
                <input
                  id={`rd-${field.id}`}
                  className={[
                    'rd-input',
                    field.type === 'number' ? 'num' : '',
                    hasError ? 'has-error' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  type="text"
                  inputMode={field.inputMode}
                  placeholder={field.placeholder}
                  value={typeof field.value === 'string' ? field.value : ''}
                  disabled={field.disabled || busy}
                  aria-invalid={hasError || undefined}
                  aria-describedby={`rd-hint-${field.id}`}
                  data-autofocus={field === fields[0] ? '' : undefined}
                  onChange={(event) => field.onInput(event.target.value)}
                  onBlur={field.onBlur}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !busy) {
                      event.preventDefault();
                      onSave();
                    }
                  }}
                />
                <span id={`rd-hint-${field.id}`}>
                  {isLockedHint ? (
                    <span className="rd-lock">
                      <LockIcon />
                      {field.hint}
                    </span>
                  ) : (
                    field.hint && <span className="rd-hint">{field.hint}</span>
                  )}
                  {hasError && (
                    <span className="rd-error">
                      <ErrorIcon />
                      {field.error}
                    </span>
                  )}
                </span>
              </div>
            );
          })}

          {summary && <div className="rd-summary">{summary}</div>}
        </div>

        {footerNote && <p className="rd-note">{footerNote}</p>}

        {pendingClose && (
          <div className="rd-discard" role="alert">
            <WarnIcon />
            <div className="rd-discard-body">
              تغییرات ذخیره‌نشده از بین می‌رود. مطمئن هستید؟
              <div className="rd-discard-actions">
                <button
                  type="button"
                  className="rd-btn rd-btn-ghost"
                  data-discard-focus=""
                  onClick={() => setPendingClose(false)}
                >
                  ادامه ویرایش
                </button>
                <button
                  type="button"
                  className="rd-btn rd-btn-danger"
                  onClick={onClose}
                >
                  رها کردن
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rd-foot">
          <button
            type="button"
            className="rd-btn rd-btn-ghost"
            disabled={busy}
            onClick={requestClose}
          >
            انصراف
          </button>
          <button
            type="button"
            className="rd-btn rd-btn-primary"
            disabled={busy}
            onClick={onSave}
          >
            {busy ? 'در حال ذخیره…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
