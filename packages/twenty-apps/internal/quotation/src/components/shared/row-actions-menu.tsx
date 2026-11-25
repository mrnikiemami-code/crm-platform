import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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

// Anchor-relative absolute menu. Host Front Components often apply CSS
// transforms; position:fixed + getBoundingClientRect viewport coords then
// land at the wrong place (top-left). Same containing block as the trigger.
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
  const [openUpward, setOpenUpward] = useState(false);

  useEffect(() => {
    if (!open || triggerRef.current === null) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const estimatedHeight = 8 + items.length * 40;
    setOpenUpward(window.innerHeight - rect.bottom < estimatedHeight + 12);
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

        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }

      const itemsInMenu = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]:not([disabled])',
        ) ?? [],
      );

      if (itemsInMenu.length === 0) {
        return;
      }

      event.preventDefault();
      const activeIndex = itemsInMenu.findIndex(
        (item) => item === document.activeElement,
      );
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex =
        activeIndex < 0
          ? 0
          : (activeIndex + delta + itemsInMenu.length) % itemsInMenu.length;
      itemsInMenu[nextIndex]?.focus();
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
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          className={
            openUpward
              ? 'fs-row-more-menu fs-row-more-menu-up'
              : 'fs-row-more-menu'
          }
          role="menu"
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
        </div>
      ) : null}
    </div>
  );
};

export type RowActionsMenuShellProps = {
  children?: ReactNode;
};

const MENU_CSS = `
.fs-row-more {
  position: relative;
  display: inline-flex;
  vertical-align: middle;
}
.fs-row-more-menu {
  position: absolute;
  top: calc(100% + 4px);
  inset-inline-end: 0;
  z-index: 40;
  min-width: 168px;
  padding: 4px;
  border: 1px solid var(--t-color-gray6);
  border-radius: 8px;
  background: var(--t-color-gray1);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
  display: grid;
  gap: 2px;
}
.fs-row-more-menu-up {
  top: auto;
  bottom: calc(100% + 4px);
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
.fs-row-more-item:hover:not(:disabled),
.fs-row-more-item:focus-visible {
  background: var(--t-color-gray3);
  outline: none;
}
.fs-row-more-item:disabled {
  color: var(--t-color-gray9);
  cursor: not-allowed;
}
.fs-row-more-item-danger { color: var(--t-color-red11); }
.fs-row-more-item-danger:hover:not(:disabled),
.fs-row-more-item-danger:focus-visible { background: var(--t-color-red2); }
`;
