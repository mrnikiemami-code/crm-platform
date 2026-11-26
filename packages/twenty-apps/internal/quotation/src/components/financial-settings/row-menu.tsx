import { useEffect, useId, useRef, useState } from 'react';

export type RowMenuItem = {
  id: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  title?: string;
  danger?: boolean;
  onSelect: () => void;
};

export type RowMenuProps = {
  label: string;
  items: RowMenuItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CSS = `
.fs-menu-root { position: relative; display: flex; justify-content: flex-start; z-index: 0; }
.fs-menu-root.is-open { z-index: 40; }
.fs-menu-trigger { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 0; background: transparent; border-radius: 6px; color: var(--t-color-gray11); cursor: pointer; transition: background 0.15s ease, color 0.15s ease; }
.fs-menu-trigger:hover { background: var(--t-color-gray4); color: var(--t-color-gray12); }
.fs-menu-trigger:focus-visible { outline: 2px solid var(--t-color-blue9); outline-offset: 2px; }
.fs-menu { position: absolute; top: calc(100% + 6px); inset-inline-end: 0; z-index: 41; min-width: 210px; background: var(--t-color-gray1); border: 1px solid var(--t-color-gray5); border-radius: 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.05); padding: 5px; animation: fs-menu-in 0.15s ease-out; }
.fs-menu.flip { top: auto; bottom: calc(100% + 6px); }
@keyframes fs-menu-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }
.fs-menu-item { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; background: transparent; padding: 8px 10px; border-radius: 5px; font: inherit; font-size: 13.5px; font-weight: 500; color: var(--t-color-gray12); cursor: pointer; text-align: start; transition: background 0.15s ease; }
.fs-menu-item:hover:not(:disabled) { background: var(--t-color-gray4); }
.fs-menu-item:focus-visible { outline: 2px solid var(--t-color-blue9); outline-offset: -2px; }
.fs-menu-item:disabled { color: var(--t-color-gray9); cursor: not-allowed; }
.fs-menu-item.danger { color: var(--t-color-red11); }
.fs-menu-item.danger:hover:not(:disabled) { background: var(--t-color-red3); }
.fs-menu-sep { height: 1px; background: var(--t-color-gray4); margin: 5px 8px; }
.fs-menu-note { font-size: 11.5px; color: var(--t-color-gray11); padding: 4px 10px 6px; margin: 0; line-height: 1.5; }
.fs-menu-icon { width: 15px; height: 15px; flex: none; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
@media (max-width: 720px) {
  .fs-menu-trigger { width: 44px; height: 44px; }
}
`;

const DotsIcon = () => (
  <svg className="fs-menu-icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="5" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.7" fill="currentColor" stroke="none" />
  </svg>
);

// Anchor-relative absolute menu: position:fixed + viewport coordinates land at the
// wrong place under host transforms, so the menu shares its trigger's containing block.
// Outside-close is owned by parents via React onPointerDown; this root stops
// propagation so item/trigger presses do not dismiss.
export const RowMenu = ({ label, items, open, onOpenChange }: RowMenuProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  const menuId = useId();
  const [flip, setFlip] = useState(false);

  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open || triggerRef.current === null) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const estimatedHeight = 8 + items.length * 42;
    setFlip(window.innerHeight - rect.bottom < estimatedHeight + 12);
  }, [items.length, open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChangeRef.current(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      const menuItems = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]:not([disabled])',
        ) ?? [],
      );
      if (menuItems.length === 0) return;

      event.preventDefault();
      const activeIndex = menuItems.findIndex(
        (item) => item === document.activeElement,
      );
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex =
        activeIndex < 0
          ? 0
          : (activeIndex + delta + menuItems.length) % menuItems.length;
      menuItems[nextIndex]?.focus();
    };

    const onOutsidePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        onOpenChangeRef.current(false);
      }
    };
    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onOutsidePointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const disabledNote = items.find(
    (item) => item.disabled && item.disabledReason,
  )?.disabledReason;

  return (
    <div
      ref={rootRef}
      className={open ? 'fs-menu-root is-open' : 'fs-menu-root'}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <style>{CSS}</style>
      <button
        ref={triggerRef}
        type="button"
        className="fs-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <DotsIcon />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className={flip ? 'fs-menu flip' : 'fs-menu'}
        >
          {items.map((item, index) => (
            <div key={item.id}>
              {index > 0 && item.danger && <div className="fs-menu-sep" />}
              <button
                type="button"
                role="menuitem"
                className={item.danger ? 'fs-menu-item danger' : 'fs-menu-item'}
                disabled={item.disabled}
                title={item.title ?? item.disabledReason}
                onClick={() => {
                  onOpenChange(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </div>
          ))}
          {disabledNote && <p className="fs-menu-note">{disabledNote}</p>}
        </div>
      )}
    </div>
  );
};