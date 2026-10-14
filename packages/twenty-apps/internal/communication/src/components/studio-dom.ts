// Safe DOM primitives for the studio.
//
// The front-component renderer does NOT always hand back real DOM nodes: a value
// obtained from a ref, `document.activeElement` or a `querySelectorAll` result can
// be a renderer proxy that has no `focus` (or no `setSelectionRange`). Calling
// through blindly is what produced the live
// `Uncaught TypeError: …focus is not a function` crash, so every DOM call the
// studio makes goes through these guards.

/** True when the value is a real focus-capable element. */
export const isFocusCapable = (
  value: unknown,
): value is { focus: () => void } =>
  value !== null &&
  value !== undefined &&
  (typeof value === 'object' || typeof value === 'function') &&
  typeof (value as { focus?: unknown }).focus === 'function';

/**
 * Focuses a candidate when it is genuinely focusable. Returns whether focus was
 * ATTEMPTED successfully; a failure is swallowed, because losing focus is a
 * cosmetic problem while throwing takes the whole component down.
 */
export const focusElementSafely = (value: unknown): boolean => {
  if (!isFocusCapable(value)) {
    return false;
  }

  try {
    value.focus();

    return true;
  } catch {
    return false;
  }
};

/** True when the value exposes the textarea selection API the studio uses. */
export const isTextSelectionCapable = (
  value: unknown,
): value is {
  setSelectionRange: (start: number, end: number) => void;
  selectionStart: number | null;
  selectionEnd: number | null;
} =>
  value !== null &&
  value !== undefined &&
  typeof value === 'object' &&
  typeof (value as { setSelectionRange?: unknown }).setSelectionRange ===
    'function';

/** Places the caret, tolerating a renderer value that cannot. */
export const setSelectionRangeSafely = (
  value: unknown,
  start: number,
  end: number,
): boolean => {
  if (!isTextSelectionCapable(value)) {
    return false;
  }

  try {
    value.setSelectionRange(start, end);

    return true;
  } catch {
    return false;
  }
};

/**
 * Collects the focus-cycling candidates inside a container, keeping only values
 * that are actually focusable. Non-element proxies are dropped rather than cast,
 * so the focus trap can never call `focus` on something that lacks it.
 */
export const collectFocusCycle = (container: unknown): unknown[] => {
  if (
    container === null ||
    container === undefined ||
    typeof (container as { querySelectorAll?: unknown }).querySelectorAll !==
      'function'
  ) {
    return [];
  }

  let found: unknown;

  try {
    found = (
      container as { querySelectorAll: (selector: string) => unknown }
    ).querySelectorAll(FOCUSABLE_SELECTOR);
  } catch {
    return [];
  }

  if (
    found === null ||
    found === undefined ||
    typeof (found as { length?: unknown }).length !== 'number'
  ) {
    return [];
  }

  const candidates: unknown[] = [];

  for (let index = 0; index < (found as { length: number }).length; index += 1) {
    candidates.push((found as { [key: number]: unknown })[index]);
  }

  return candidates.filter((candidate) => {
    if (!isFocusCapable(candidate)) {
      return false;
    }

    // A disabled control is not part of the tab cycle.
    return (candidate as { disabled?: unknown }).disabled !== true;
  });
};

/** The focusable selector shared by the focus trap. */
export const FOCUSABLE_SELECTOR =
  'input, textarea, select, button, [role="combobox"], [tabindex]:not([tabindex="-1"])';

/** The element that currently owns focus, or `null` when it cannot be read. */
export const readActiveElement = (): unknown => {
  try {
    return document.activeElement ?? null;
  } catch {
    return null;
  }
};

/**
 * True when `target` is inside `container`. Used by the backdrop so a click that
 * LANDED on the dialog (or anything inside it) can never be mistaken for a
 * backdrop click, whatever the renderer reports as `event.target`.
 */
export const isInsideContainer = (
  container: unknown,
  target: unknown,
): boolean => {
  if (container === null || container === undefined || target === null || target === undefined) {
    return false;
  }

  const contains = (container as { contains?: unknown }).contains;

  if (typeof contains !== 'function') {
    return false;
  }

  try {
    return (contains as (node: unknown) => boolean).call(container, target);
  } catch {
    return false;
  }
};
