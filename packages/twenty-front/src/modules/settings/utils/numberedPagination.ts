// Zero-based page indexes, a single sliding window, never more than five.
export const getNumberedPageWindow = (page: number, pageCount: number): number[] => {
  if (pageCount <= 0) return [];
  const count = Math.min(5, pageCount);
  const start = Math.max(0, Math.min(page - 2, pageCount - count));
  return Array.from({ length: count }, (_, index) => start + index);
};

export const normalizePageDigits = (value: string): string =>
  value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

export const parsePageJump = (value: string, pageCount: number): number | null => {
  const normalized = normalizePageDigits(value.trim());
  if (!/^\d+$/.test(normalized)) return null;
  const page = Number(normalized);
  return Number.isSafeInteger(page) && page >= 1 && page <= pageCount ? page - 1 : null;
};
