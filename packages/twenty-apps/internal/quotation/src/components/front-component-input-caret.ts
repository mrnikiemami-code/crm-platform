// Front-component host polyfill does not implement selectionStart /
// setSelectionRange on remote <input> elements (same constraint as Communication
// template-editor). Calling setSelectionRange throws "is not a function" and
// tears down the draft form. Caret restore is best-effort when the host allows it.

export const readInputCaretIndex = (element: {
  selectionStart?: number | null;
  value: string;
}): number =>
  typeof element.selectionStart === 'number'
    ? element.selectionStart
    : element.value.length;

export const restoreInputCaret = (
  element: {
    setSelectionRange?: (start: number, end: number) => void;
  } | null,
  caret: number,
): void => {
  if (element === null || typeof element.setSelectionRange !== 'function') {
    return;
  }

  try {
    element.setSelectionRange(caret, caret);
  } catch {
    // Host rejected selection; formatted value still applied.
  }
};
