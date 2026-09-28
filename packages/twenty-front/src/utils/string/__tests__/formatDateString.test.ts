import { DateFormat } from '@/localization/constants/DateFormat';
import { FieldDateDisplayFormat } from '@/object-record/record-field/ui/types/FieldMetadata';
import { getDateFnsLocale } from '@/ui/field/display/utils/getDateFnsLocale';
import { format, subDays } from 'date-fns';
import { enUS, faIR, fr } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { APP_LOCALES } from 'twenty-shared/translations';
import { formatDateString } from '~/utils/string/formatDateString';

describe('formatDateString', () => {
  const defaultParams = {
    timeZone: 'UTC',
    dateFormat: DateFormat.DAY_FIRST,
  };

  it('should return empty string for null value', () => {
    const result = formatDateString({
      ...defaultParams,
      value: null,
      localeCatalog: enUS,
    });

    expect(result).toBe('');
  });

  it('should return empty string for undefined value', () => {
    const result = formatDateString({
      ...defaultParams,
      value: undefined,
      localeCatalog: enUS,
    });

    expect(result).toBe('');
  });

  it('should format date as relative when displayFormat is set to RELATIVE', () => {
    const mockDate = subDays(new Date(), 2).toISOString();
    const mockRelativeDate = '2 days ago';

    const result = formatDateString({
      ...defaultParams,
      value: mockDate,
      dateFieldSettings: {
        displayFormat: FieldDateDisplayFormat.RELATIVE,
      },
      localeCatalog: enUS,
    });

    expect(result).toBe(mockRelativeDate);
  });

  it('should format date as datetime when displayFormat is set to USER_SETTINGS', () => {
    const mockDate = '2023-01-01T12:00:00Z';
    const mockFormattedDate = '1 Jan, 2023';

    jest.mock('@/localization/utils/formatDateISOStringToDateTime', () => ({
      formatDateISOStringToDateTime: jest
        .fn()
        .mockReturnValue(mockFormattedDate),
    }));

    const result = formatDateString({
      ...defaultParams,
      value: mockDate,
      dateFieldSettings: {
        displayFormat: FieldDateDisplayFormat.USER_SETTINGS,
      },
      localeCatalog: enUS,
    });

    expect(result).toBe(mockFormattedDate);
  });

  it('should format date with custom format when displayFormat is set to CUSTOM', () => {
    const mockDate = '2023-01-01T12:00:00Z';
    const mockFormattedDate = '2023';

    jest.mock(
      '@/localization/utils/formatDateISOStringToCustomUnicodeFormat',
      () => ({
        formatDateISOStringToCustomUnicodeFormat: jest
          .fn()
          .mockReturnValue(mockFormattedDate),
      }),
    );

    const result = formatDateString({
      ...defaultParams,
      value: mockDate,
      dateFieldSettings: {
        displayFormat: FieldDateDisplayFormat.CUSTOM,
        customUnicodeDateFormat: 'yyyy',
      },
      localeCatalog: enUS,
    });

    expect(result).toBe(mockFormattedDate);
  });

  it('should format date as datetime by default when displayFormat is not provided', () => {
    const mockDate = '2023-01-01T12:00:00Z';
    const mockFormattedDate = '1 Jan, 2023';

    jest.mock('@/localization/utils/formatDateISOStringToDateTime', () => ({
      formatDateISOStringToDateTime: jest
        .fn()
        .mockReturnValue(mockFormattedDate),
    }));

    const result = formatDateString({
      ...defaultParams,
      value: mockDate,
      localeCatalog: enUS,
    });

    expect(result).toBe(mockFormattedDate);
  });

  describe('date-only values across user timezones', () => {
    it('should render the same calendar date for a UTC user', () => {
      const result = formatDateString({
        ...defaultParams,
        value: '2022-01-01',
        timeZone: 'UTC',
        localeCatalog: enUS,
      });

      expect(result).toBe('1 Jan, 2022');
    });

    it('should render the same calendar date for a negative-offset user', () => {
      const result = formatDateString({
        ...defaultParams,
        value: '2022-01-01',
        timeZone: 'America/Los_Angeles',
        localeCatalog: enUS,
      });

      expect(result).toBe('1 Jan, 2022');
    });

    it('should render the same calendar date for a positive-offset user', () => {
      const result = formatDateString({
        ...defaultParams,
        value: '2022-01-01',
        timeZone: 'Asia/Tokyo',
        localeCatalog: enUS,
      });

      expect(result).toBe('1 Jan, 2022');
    });

    it('should render a date-only value with CUSTOM displayFormat without timezone shift', () => {
      const result = formatDateString({
        ...defaultParams,
        value: '2022-01-01',
        timeZone: 'America/Los_Angeles',
        dateFieldSettings: {
          displayFormat: FieldDateDisplayFormat.CUSTOM,
          customUnicodeDateFormat: 'yyyy-MM-dd',
        },
        localeCatalog: enUS,
      });

      expect(result).toBe('2022-01-01');
    });
  });

  describe('date-only values with RELATIVE displayFormat across timezones', () => {
    beforeAll(() => {
      jest.useFakeTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('should return "Tomorrow" when the target value is the next calendar day in the user timezone', () => {
      // 2026-05-18 13:00 UTC: today in UTC is May 18, so "2026-05-19" is tomorrow.
      jest.setSystemTime(new Date('2026-05-18T13:00:00Z'));

      const result = formatDateString({
        ...defaultParams,
        value: '2026-05-19',
        timeZone: 'UTC',
        dateFieldSettings: {
          displayFormat: FieldDateDisplayFormat.RELATIVE,
        },
        localeCatalog: enUS,
      });

      expect(result).toBe('Tomorrow');
    });

    it('should return "Today" for the same value when the user timezone has already rolled over', () => {
      // 2026-05-18 21:00 UTC = 2026-05-19 06:00 in Asia/Tokyo, so "2026-05-19" is today there.
      jest.setSystemTime(new Date('2026-05-18T21:00:00Z'));

      const result = formatDateString({
        ...defaultParams,
        value: '2026-05-19',
        timeZone: 'Asia/Tokyo',
        dateFieldSettings: {
          displayFormat: FieldDateDisplayFormat.RELATIVE,
        },
        localeCatalog: enUS,
      });

      expect(result).toBe('Today');
    });
  });

  describe('fa-IR catalog (persian calendar)', () => {
    const persianParams = {
      ...defaultParams,
      localeCatalog: faIR,
    };

    it('should display Nowruz as the first day of the persian year', () => {
      expect(formatDateString({ ...persianParams, value: '2026-03-21' })).toBe(
        '۱ فروردین ۱۴۰۵',
      );
    });

    it('should display a date-only value in the persian calendar', () => {
      expect(formatDateString({ ...persianParams, value: '2026-09-28' })).toBe(
        '۶ مهر ۱۴۰۵',
      );
    });

    it('should map the user date format ordering', () => {
      expect(
        formatDateString({
          ...persianParams,
          value: '2026-09-28',
          dateFormat: DateFormat.MONTH_FIRST,
        }),
      ).toBe('مهر ۶، ۱۴۰۵');
      expect(
        formatDateString({
          ...persianParams,
          value: '2026-09-28',
          dateFormat: DateFormat.YEAR_FIRST,
        }),
      ).toBe('۱۴۰۵ مهر ۶');
    });

    it('should not shift date-only values in timezones ahead of or behind UTC', () => {
      const timeZones = ['UTC', 'Asia/Tokyo', 'America/Los_Angeles'];

      for (const timeZone of timeZones) {
        expect(
          formatDateString({
            ...persianParams,
            value: '2026-03-21',
            timeZone,
          }),
        ).toBe('۱ فروردین ۱۴۰۵');
      }
    });

    it('should keep UTC midnight values on the same day with the UTC display timezone', () => {
      expect(
        formatDateString({
          ...persianParams,
          value: '2026-03-21T00:00:00.000Z',
          timeZone: 'UTC',
        }),
      ).toBe('۱ فروردین ۱۴۰۵');
    });

    it('should fall back to the user date format for custom unicode formats', () => {
      const result = formatDateString({
        ...persianParams,
        value: '2026-09-28',
        dateFormat: DateFormat.MONTH_FIRST,
        dateFieldSettings: {
          displayFormat: FieldDateDisplayFormat.CUSTOM,
          customUnicodeDateFormat: 'yyyy-MM-dd',
        },
      });

      expect(result).toBe('مهر ۶، ۱۴۰۵');
      expect(result).not.toMatch(/[0-9]/);
    });

    it('should honor an explicit gregory calendar override', () => {
      expect(
        formatDateString({
          ...persianParams,
          value: '2026-09-28',
          calendar: 'gregory',
        }),
      ).toBe(
        format(new Date(2026, 8, 28), DateFormat.DAY_FIRST, { locale: faIR }),
      );
    });

    describe('relative display', () => {
      beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-09-28T12:00:00Z'));
      });

      afterAll(() => {
        jest.useRealTimers();
      });

      it('should return today and yesterday in persian', () => {
        expect(
          formatDateString({
            ...persianParams,
            value: '2026-09-28',
            dateFieldSettings: {
              displayFormat: FieldDateDisplayFormat.RELATIVE,
            },
          }),
        ).toBe('امروز');
        expect(
          formatDateString({
            ...persianParams,
            value: '2026-09-27',
            dateFieldSettings: {
              displayFormat: FieldDateDisplayFormat.RELATIVE,
            },
          }),
        ).toBe('دیروز');
      });
    });
  });

  describe('non fa-IR locales (gregorian calendar unchanged)', () => {
    it('should keep the en output', () => {
      expect(
        formatDateString({
          ...defaultParams,
          value: '2026-09-28',
          dateFormat: DateFormat.MONTH_FIRST,
          localeCatalog: enUS,
        }),
      ).toBe('Sep 28, 2026');
      expect(
        formatDateString({
          ...defaultParams,
          value: '2026-03-21',
          localeCatalog: enUS,
        }),
      ).toBe('21 Mar, 2026');
    });

    it('should keep the fr output', () => {
      expect(
        formatDateString({
          ...defaultParams,
          value: '2026-09-28',
          dateFormat: DateFormat.MONTH_FIRST,
          localeCatalog: fr,
        }),
      ).toBe('sept. 28, 2026');
    });

    it('should match the plain date-fns output for every other app locale', async () => {
      const nonPersianLocales = Object.values(APP_LOCALES).filter(
        (locale) => locale !== APP_LOCALES['fa-IR'],
      );

      for (const locale of nonPersianLocales) {
        const localeCatalog = (await getDateFnsLocale(locale)) ?? enUS;

        expect(
          formatDateString({
            ...defaultParams,
            value: '2026-09-28T10:00:00Z',
            timeZone: 'Asia/Tehran',
            localeCatalog,
          }),
        ).toBe(
          formatInTimeZone(
            new Date('2026-09-28T10:00:00Z'),
            'Asia/Tehran',
            DateFormat.DAY_FIRST,
            { locale: localeCatalog },
          ),
        );
      }
    });
  });
});
