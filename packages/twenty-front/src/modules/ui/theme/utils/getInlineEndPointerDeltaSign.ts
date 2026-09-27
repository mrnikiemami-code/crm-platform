// Resize handles sit on the inline-end edge, which is the physical left in
// RTL, so a leftward pointer move must grow the column there.
export const getInlineEndPointerDeltaSign = (
  element?: Element | null,
): 1 | -1 => {
  if (typeof document === 'undefined') {
    return 1;
  }

  const direction = getComputedStyle(
    element ?? document.documentElement,
  ).direction;

  return direction === 'rtl' ? -1 : 1;
};
