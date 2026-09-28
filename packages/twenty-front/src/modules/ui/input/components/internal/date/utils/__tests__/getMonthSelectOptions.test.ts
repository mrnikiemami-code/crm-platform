import { getMonthSelectOptions } from '@/ui/input/components/internal/date/utils/getMonthSelectOptions';
import { APP_LOCALES } from 'twenty-shared/translations';

// Unsupported tags such as pseudo-en fall back to the host default locale, so
// their previous output is host-dependent and cannot serve as a baseline.
const NON_FA_INTL_SUPPORTED_LOCALES = Object.keys(APP_LOCALES).filter(
  (locale) =>
    locale !== 'fa-IR' &&
    Intl.DateTimeFormat.supportedLocalesOf(locale).length > 0,
);

const getPreviousMonthLabels = (locale: string) =>
  Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(
      new Date(0, index, 1),
    ),
  );

describe('getMonthSelectOptions', () => {
  it('should label Gregorian months with Gregorian names in fa-IR', () => {
    const options = getMonthSelectOptions('fa-IR');

    expect(options[0]).toEqual({ label: 'ژانویه', value: 1 });
    expect(options[1]).toEqual({ label: 'فوریه', value: 2 });
    expect(options[11]).toEqual({ label: 'دسامبر', value: 12 });
    expect(options.map(({ label }) => label)).not.toContain('دی');
    expect(options.map(({ label }) => label)).not.toContain('فروردین');
  });

  it('should keep English month names for en', () => {
    const options = getMonthSelectOptions('en');

    expect(options[0]).toEqual({ label: 'January', value: 1 });
    expect(options[11]).toEqual({ label: 'December', value: 12 });
  });

  it('should default to en-US when no locale is provided', () => {
    expect(getMonthSelectOptions()[0]).toEqual({
      label: 'January',
      value: 1,
    });
  });

  it.each(NON_FA_INTL_SUPPORTED_LOCALES)(
    'should produce the same labels as before for %s',
    (locale) => {
      expect(getMonthSelectOptions(locale).map(({ label }) => label)).toEqual(
        getPreviousMonthLabels(locale),
      );
    },
  );
});
