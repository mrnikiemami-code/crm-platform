import { isNonLatinScriptLocale } from '@/settings/data-model/utils/isNonLatinScriptLocale';

describe('isNonLatinScriptLocale', () => {
  it.each([
    ['fa-IR', true],
    ['ar-SA', true],
    ['he-IL', true],
    ['ru-RU', true],
    ['sr-Cyrl', true],
    ['en', false],
    ['fr-FR', false],
    ['sr-Latn', false],
    ['pseudo-en', false],
    ['', false],
    [undefined, false],
    [null, false],
  ])('returns the expected result for %p', (locale, expected) => {
    expect(isNonLatinScriptLocale(locale)).toBe(expected);
  });
});
