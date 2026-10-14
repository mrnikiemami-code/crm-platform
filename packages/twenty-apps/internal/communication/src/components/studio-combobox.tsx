import { useId, useState, type KeyboardEvent } from 'react';

import { composerStyles as styles } from 'src/components/composer-shared';
import {
  collectFocusCycle,
  FOCUSABLE_SELECTOR,
  focusElementSafely,
} from 'src/components/studio-dom';
import { templateStudioStyles as studioStyles } from 'src/components/template-studio-styles';
import {
  activeComboboxValue,
  filterComboboxOptions,
  nextComboboxActiveIndex,
  type ComboboxOption,
} from 'src/studio/template-studio-logic';

// One accessible, searchable Combobox/Listbox, reused by the sample-Person
// picker and by the target-entity control so both behave identically.
//
// ARIA: the text input is the `combobox` (owns the list, reports the active
// option through `aria-activedescendant`); the popup is a `listbox` whose items
// are `option`s. There is deliberately NO default selection — an empty value
// means nothing is chosen, and a clear action is available once something is.
//
// The popup has its own bounded height and scrolls internally, so a long result
// list can never push the surrounding modal out of the viewport.
export type StudioComboboxProps = {
  options: readonly ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Accessible name AND the visible field label. */
  label: string;
  placeholder: string;
  /** Shown when the (possibly filtered) list is empty. */
  emptyLabel: string;
  clearLabel: string;
  disabled?: boolean;
  /** True while the options are still being fetched. */
  isLoading?: boolean;
  loadingLabel?: string;
};

export const StudioCombobox = ({
  options,
  value,
  onChange,
  label,
  placeholder,
  emptyLabel,
  clearLabel,
  disabled = false,
  isLoading = false,
  loadingLabel = 'Loading…',
}: StudioComboboxProps) => {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedOption =
    options.find((option) => option.value === value) ?? null;
  const visibleOptions = filterComboboxOptions(options, query);

  // While open the input holds what the user is typing; while closed it shows
  // the current selection, so the selected entity is always visible.
  const inputValue = isOpen ? query : (selectedOption?.label ?? '');

  const close = () => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(-1);
  };

  const select = (nextValue: string) => {
    onChange(nextValue);
    close();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // The list is a popup INSIDE the editor, so its own keys must never reach
    // the modal's Escape handler.
    if (event.key === 'Escape') {
      if (!isOpen) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (isLoading) {
        return;
      }

      event.preventDefault();

      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(-1);
        return;
      }

      setActiveIndex((current) =>
        nextComboboxActiveIndex({
          activeIndex: current,
          optionCount: visibleOptions.length,
          delta: event.key === 'ArrowDown' ? 1 : -1,
        }),
      );

      return;
    }

    if (event.key === 'Enter') {
      if (!isOpen) {
        return;
      }

      event.preventDefault();

      const activeValue = activeComboboxValue(visibleOptions, activeIndex);

      if (activeValue !== null) {
        select(activeValue);
      }

      return;
    }

    if (event.key === 'Tab' || event.key === 'Home' || event.key === 'End') {
      close();
    }
  };

  const renderListBody = () => {
    if (isLoading) {
      return (
        <li style={styles.muted} role="presentation">
          {loadingLabel}
        </li>
      );
    }

    if (visibleOptions.length === 0) {
      return (
        <li style={styles.muted} role="presentation">
          {emptyLabel}
        </li>
      );
    }

    return visibleOptions.map((option, index) => (
      <li
        key={option.value}
        id={`${listId}-option-${index}`}
        role="option"
        aria-selected={index === activeIndex}
        data-active={index === activeIndex}
        // Preventing the default keeps focus on the input, so the click handler
        // still runs before any blur could close the list.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => select(option.value)}
        style={
          index === activeIndex
            ? studioStyles.comboboxOptionActive
            : studioStyles.comboboxOption
        }
      >
        {option.label}
      </li>
    ));
  };

  return (
    <div style={styles.field}>
      <span style={styles.label}>{label}</span>
      <div style={studioStyles.combobox}>
        <input
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            isOpen && activeIndex >= 0
              ? `${listId}-option-${activeIndex}`
              : undefined
          }
          autoComplete="off"
          disabled={disabled}
          value={inputValue}
          placeholder={placeholder}
          onFocus={() => {
            setIsOpen(true);
            setQuery('');
            setActiveIndex(-1);
          }}
          onChange={(event) => {
            setIsOpen(true);
            setQuery(event.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // A click on an option prevents this default, so a selection is not
            // lost before it is applied.
            close();
          }}
          style={{
            ...styles.control,
            ...studioStyles.comboboxInput,
            ...(disabled ? styles.controlDisabled : {}),
          }}
        />

        {value !== null && (
          <button
            type="button"
            aria-label={clearLabel}
            // Keep focus so clearing does not blur-then-reopen the list.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange(null);
              close();
            }}
            style={studioStyles.comboboxClear}
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        // `role="listbox"` with an explicit bounded height: the results scroll
        // here rather than expanding the modal.
        <ul id={listId} role="listbox" style={studioStyles.comboboxList}>
          {renderListBody()}
        </ul>
      )}
    </div>
  );
};

// Re-exported so a caller building its own focus trap shares the same guarded
// primitives instead of re-implementing an unsafe `focus()` call.
export { collectFocusCycle, FOCUSABLE_SELECTOR, focusElementSafely };
