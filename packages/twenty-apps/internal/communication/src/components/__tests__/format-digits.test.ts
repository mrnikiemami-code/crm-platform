import { describe, expect, it } from 'vitest';

import { formatDigitsForLocale } from 'src/components/composer-shared';

// Locks the W17 §D rule for the app's own front components: fa-IR renders
// Persian digits, every other locale is unchanged, and ONLY digit characters
// are touched.
describe('formatDigitsForLocale', () => {
  it('renders Persian digits for fa-IR', () => {
    expect(formatDigitsForLocale('09120000000', 'fa-IR')).toBe('۰۹۱۲۰۰۰۰۰۰۰');
    expect(formatDigitsForLocale('+98 912 000 0000', 'fa-IR')).toBe(
      '+۹۸ ۹۱۲ ۰۰۰ ۰۰۰۰',
    );
  });

  it('leaves en-US (and every other locale) unchanged', () => {
    expect(formatDigitsForLocale('09120000000', 'en')).toBe('09120000000');
    expect(formatDigitsForLocale('+98 912 000 0000', 'en-US')).toBe(
      '+98 912 000 0000',
    );
  });

  it('changes ONLY the digits, never the surrounding characters', () => {
    expect(formatDigitsForLocale('SMS-12', 'fa-IR')).toBe('SMS-۱۲');
  });

  it('is a no-op for a string with no digits', () => {
    expect(formatDigitsForLocale('SMS', 'fa-IR')).toBe('SMS');
  });
});
