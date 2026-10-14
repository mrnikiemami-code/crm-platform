import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { composerStyles as styles } from 'src/components/composer-shared';
import { templateStudioStyles as studioStyles } from 'src/components/template-studio-styles';
import {
  activeComboboxValue,
  filterComboboxOptions,
  nextComboboxActiveIndex,
  shouldLoadMorePeople,
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
// The popup is rendered IN FLOW, directly under the input, with its own bounded
// height and scrolling.
//
// It is deliberately NOT portaled to `<body>`: the host renders this front
// component with the host's React, so content moved outside the host's React
// root would keep painting but stop receiving its events — it would look
// correct and be completely inert. Staying inside the host's tree is what keeps
// every control interactive.
//
// The list itself is PAGED by the caller: `hasMore` + `onLoadMore` let a
// workspace with ~100k People append one page at a time as the user scrolls,
// instead of loading the whole table.
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
  /** True while the FIRST page is still being fetched. */
  isLoading?: boolean;
  loadingLabel?: string;
  /** True when the server holds a further page. */
  hasMore?: boolean;
  /** True while the NEXT page is being fetched. */
  isLoadingMore?: boolean;
  loadingMoreLabel?: string;
  onLoadMore?: () => void;
  /**
   * When provided, typing is also sent to the server, so a match outside the
   * already-loaded pages is still found (name or phone). The caller then owns
   * the filtering and the loaded page is listed as-is.
   */
  onSearchChange?: (query: string) => void;
  /** Rendered under the input to explain a failed load. */
  errorLabel?: string | null;
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
  hasMore = false,
  isLoadingMore = false,
  loadingMoreLabel = 'Loading more…',
  onLoadMore,
  onSearchChange,
  errorLabel = null,
}: StudioComboboxProps) => {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedOption =
    options.find((option) => option.value === value) ?? null;

  // When the caller owns the search (server-side), the loaded page is shown
  // as-is; otherwise the loaded options are filtered locally.
  const visibleOptions =
    onSearchChange === undefined
      ? filterComboboxOptions(options, query)
      : [...options];

  // While open the input holds what the user is typing; while closed it shows
  // the current selection, so the selected entity is always visible.
  const inputValue = isOpen ? query : (selectedOption?.label ?? '');

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(-1);
  }, []);

  const select = (nextValue: string) => {
    onChange(nextValue);
    close();
  };

  /**
   * Loads the next page when the list is scrolled close to its end.
   *
   * The 10% threshold is shared with the People loader so the rule lives in one
   * place.
   */
  const handleListScroll = () => {
    const list = listRef.current;

    if (
      list === null ||
      hasMore !== true ||
      isLoadingMore ||
      onLoadMore === undefined
    ) {
      return;
    }

    if (
      shouldLoadMorePeople({
        scrollTop: list.scrollTop,
        clientHeight: list.clientHeight,
        scrollHeight: list.scrollHeight,
      })
    ) {
      onLoadMore();
    }
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
        <li style={studioStyles.comboboxStatus} role="presentation">
          {loadingLabel}
        </li>
      );
    }

    if (visibleOptions.length === 0) {
      return (
        <li style={studioStyles.comboboxStatus} role="presentation">
          {emptyLabel}
        </li>
      );
    }

    return (
      <>
        {visibleOptions.map((option, index) => (
          <li
            key={option.value}
            id={`${listId}-option-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            data-studio-option={option.value}
            // Selecting on pointer DOWN (and preventing the default) keeps the
            // input focused for the whole gesture, so the list cannot be torn
            // down between press and release and the selection cannot be lost
            // to a re-render or a layout shift.
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              select(option.value);
            }}
            style={
              index === activeIndex
                ? studioStyles.comboboxOptionActive
                : studioStyles.comboboxOption
            }
          >
            {option.label}
          </li>
        ))}

        {isLoadingMore && (
          <li style={studioStyles.comboboxStatus} role="presentation">
            {loadingMoreLabel}
          </li>
        )}
      </>
    );
  };

  return (
    <div style={styles.field}>
      <span style={styles.label}>{label}</span>
      <div style={studioStyles.combobox}>
        <input
          ref={inputRef}
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
            if (!isOpen) {
              setIsOpen(true);
            }

            setQuery(event.target.value);
            setActiveIndex(-1);
            onSearchChange?.(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // A pointer-down on an option stops this from running, so a
            // selection is never lost; anything else closes the list.
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

      {errorLabel !== null && <p style={styles.warning}>{errorLabel}</p>}

      {isOpen && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          onScroll={handleListScroll}
          style={studioStyles.comboboxList}
        >
          {renderListBody()}
        </ul>
      )}
    </div>
  );
};
