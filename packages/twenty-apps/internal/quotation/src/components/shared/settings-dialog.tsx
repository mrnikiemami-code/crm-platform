import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';

type SettingsDialogProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  size?: 'md' | 'lg';
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Modal shell for create/edit on financial settings. Host has no general Dialog
// export for Front Components — ConfirmationDialog is reserved for destructive
// confirms. Fixed overlay stays in the React tree (createPortal is unreliable
// across the Front Component / host React boundary).
export const SettingsDialog = ({
  title,
  onClose,
  children,
  footer,
  busy = false,
  size = 'md',
}: SettingsDialogProps) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onCloseRef.current();

        return;
      }

      if (event.key !== 'Tab' || panel === null) {
        return;
      }

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((node) => !node.hasAttribute('disabled') && node.tabIndex !== -1);

      if (focusable.length === 0) {
        event.preventDefault();

        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last?.focus();
        }

        return;
      }

      if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [busy]);

  const requestClose = () => {
    if (!busy) {
      onCloseRef.current();
    }
  };

  return (
    <div
      className="fs-dialog-root"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <style>{DIALOG_CSS}</style>
      <button
        type="button"
        className="fs-dialog-backdrop"
        aria-label="بستن"
        disabled={busy}
        onMouseDown={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onClick={(event) => {
          event.preventDefault();
          requestClose();
        }}
      />
      <div
        ref={panelRef}
        className={
          size === 'lg' ? 'fs-dialog-panel fs-dialog-panel-lg' : 'fs-dialog-panel'
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={styles.panel}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="fs-dialog-head">
          <h3 id={titleId} className="fs-dialog-title">
            {title}
          </h3>
          <button
            type="button"
            className="fs-dialog-close"
            aria-label="بستن"
            disabled={busy}
            onClick={() => onCloseRef.current()}
          >
            ×
          </button>
        </header>
        <div className="fs-dialog-body">{children}</div>
        {footer === undefined ? null : (
          <footer className="fs-dialog-foot">{footer}</footer>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  panel: {
    background: 'var(--t-color-gray1)',
    color: 'var(--t-color-gray12)',
  },
};

const DIALOG_CSS = `
.fs-dialog-root {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: 16px;
  box-sizing: border-box;
}
.fs-dialog-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  margin: 0;
  background: rgba(15, 15, 15, 0.42);
  cursor: pointer;
}
.fs-dialog-panel {
  position: relative;
  z-index: 1;
  width: min(440px, 100%);
  max-height: min(88vh, 720px);
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 1px solid var(--t-color-gray6);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
  overflow: hidden;
}
.fs-dialog-panel-lg {
  width: min(520px, 100%);
}
.fs-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--t-color-gray5);
}
.fs-dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.fs-dialog-close {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--t-color-gray11);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.fs-dialog-close:hover:not(:disabled) { background: var(--t-color-gray3); }
.fs-dialog-close:focus-visible {
  outline: 2px solid var(--t-color-blue9);
  outline-offset: 1px;
}
.fs-dialog-body {
  padding: 16px;
  overflow: auto;
  display: grid;
  gap: 12px;
}
.fs-dialog-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-start;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--t-color-gray5);
}
@media (max-width: 430px) {
  .fs-dialog-root { padding: 0; align-items: end; }
  .fs-dialog-panel,
  .fs-dialog-panel-lg {
    width: 100%;
    max-height: 92vh;
    border-radius: 12px 12px 0 0;
  }
}
`;
