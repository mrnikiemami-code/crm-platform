import { getNumberedPageWindow, parsePageJump } from '@/settings/utils/numberedPagination';

describe('numbered pagination', () => {
  it('uses at most five adjacent page numbers, including at either end', () => {
    expect(getNumberedPageWindow(0, 100)).toEqual([0, 1, 2, 3, 4]);
    expect(getNumberedPageWindow(49, 100)).toEqual([47, 48, 49, 50, 51]);
    expect(getNumberedPageWindow(99, 100)).toEqual([95, 96, 97, 98, 99]);
    expect(getNumberedPageWindow(1, 2)).toEqual([0, 1]);
    expect(getNumberedPageWindow(0, 0)).toEqual([]);
  });
  it('accepts Persian, Arabic and Latin page numbers and rejects out of range input', () => {
    expect(parsePageJump('۵۰', 100)).toBe(49);
    expect(parsePageJump('٥٠', 100)).toBe(49);
    expect(parsePageJump('50', 100)).toBe(49);
    for (const value of ['', '۰', '۱۰۱', '1.5', '1e2', '-1']) expect(parsePageJump(value, 100)).toBeNull();
    expect(parsePageJump('1', 0)).toBeNull();
  });
});
