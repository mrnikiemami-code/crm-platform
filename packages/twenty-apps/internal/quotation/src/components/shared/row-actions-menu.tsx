import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type RowActionsMenuItem = {
  id: string;
  label: string;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
  onSelect: () => void;
};

type RowActionsMenuProps = {
  label: string;
  items: RowActionsMenuItem[];
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type MenuPosition = {
  top: number;
  left: number;
  minWidth: number;
};

// Portal menu so last-row actions are not clipped by overflow:hidden panels.
export const RowActionsMenu = ({
  label,
  items,
  disabled = false,
  open,
  onOpenChange,
}: RowActionsMenuProps) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!open || triggerRef.current === null) {
      setPosition(null);

      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = Math.max(160, rect.width);
    const estimatedHeight = 8 + items.length * 40;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedHeight + 12;
    const top = openUpward
      ? Math.max(8, rect.top - estimatedHeight - 4)
      : rect.bottom + 4;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );

    setPosition({ top, left, minWidth: menuWidth });
  }, [items.length, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      onOpenChange(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onOpenChange, open]);

  return (
    <div className="fs-row-more">
      <style>{MENU_CSS}</style>
      <button
        ref={triggerRef}
        type="button"
        className="tax-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
      >
        بیشتر
      </button>
      {open && position !== null && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className="fs-row-more-menu"
              role="menu"
              style={{
                top: position.top,
                left: position.left,
                minWidth: position.minWidth,
              }}
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={
                    item.danger
                      ? 'fs-row-more-item fs-row-more-item-danger'
                      : 'fs-row-more-item'
                  }
                  disabled={item.disabled === true}
                  title={item.title}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (item.disabled === true) {
                      return;
                    }

                    onOpenChange(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export type RowActionsMenuShellProps = {
  children?: ReactNode;
};

const MENU_CSS = `
.fs-row-more { position: relative; display: inline-flex; }
.fs-row-more-menu {
  position: fixed;
  z-index: 10050;
  padding: 4px;
  border: 1px solid var(--t-color-gray6);
  border-radius: 8px;
  background: var(--t-color-gray1);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
  display: grid;
  gap: 2px;
}
.fs-row-more-item {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--t-color-gray12);
  font: inherit;
  font-size: 13px;
  text-align: right;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  min-height: 40px;
}
.fs-row-more-item:hover:not(:disabled) { background: var(--t-color-gray3); }
.fs-row-more-item:disabled {
  color: var(--t-color-gray9);
  cursor: not-allowed;
}
.fs-row-more-item-danger { color: var(--t-color-red11); }
.fs-row-more-item-danger:hover:not(:disabled) { background: var(--t-color-red2); }
`;
