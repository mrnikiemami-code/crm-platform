import { hasNonLatinLetters } from '@/settings/data-model/utils/hasNonLatinLetters';

describe('hasNonLatinLetters', () => {
  it.each([
    ['همایش', true],
    ['همایش‌ها', true],
    ['CRM همایش', true],
    ['Событие', true],
    ['Academy event', false],
    ['Événement', false],
    ['Event 2026', false],
    ['', false],
    [undefined, false],
    [null, false],
  ])('returns the expected result for %p', (value, expected) => {
    expect(hasNonLatinLetters(value)).toBe(expected);
  });
});
