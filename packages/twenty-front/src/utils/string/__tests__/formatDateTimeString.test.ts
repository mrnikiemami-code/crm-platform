import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { FieldDateDisplayFormat } from '@/object-record/record-field/ui/types/FieldMetadata';
import { subDays } from 'date-fns';
import { de, enUS, faIR } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { formatDateTimeString } from '~/utils/string/formatDateTimeString';

describe('formatDateTimeString', () => {
  const defaultParams = {
    timeZone: 'UTC',
    dateFormat: DateFormat.DAY_FIRST,
    timeFormat: TimeFormat.HOUR_24,
  };

  it('should return empty string for null value', () => {
    const result = formatDateTimeString({
      ...defaultParams,
      value: null,
      localeCatalog: enUS,
    });

    expect(result).toBe('');
  });

  it('should return empty string for undefined value', () => {
    const result = formatDateTimeString({
      ...defaultParams,
      value: undefined,
      localeCatalog: enUS,
    });

    expect(result).toBe('');
  });

  it('should format date as relative when displayFormat is RELATIVE', () => {
    const mockDate = subDays(new Date(), 2).toISOString();
    const mockRelativeDate = '2 days ago';

    const result = formatDateTimeString({
      ...defaultParams,
      value: mockDate,
      dateFieldSettings: {
        displayFormat: FieldDateDisplayFormat.RELATIVE,
      },
      localeCatalog: enUS,
    });

    expect(result).toBe(mockRelativeDate);
  });

  it('should format date as datetime when displayFormat is USER_SETTINGS', () => {
    const mockDate = '2023-01-01T12:00:00Z';
    const mockFormattedDate = '1 Jan, 2023 12:00';

    jest.mock('@/localization/utils/formatDateISOStringToDateTime', () => ({
      formatDateISOStringToDateTime: jest
        .fn()
        .mockReturnValue(mockFormattedDate),
    }));

    const result = formatDateTimeString({
      ...defaultParams,
      value: mockDate,
      dateFieldSettings: {
        displayFormat: FieldDateDisplayFormat.USER_SETTINGS,
      },
      localeCatalog: enUS,
    });

    expect(result).toBe(mockFormattedDate);
  });

  it('should format date as datetime when displayFormat is set to CUSTOM', () => {
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

    const result = formatDateTimeString({
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
    const mockFormattedDate = '1 Jan, 2023 12:00';

    jest.mock('@/localization/utils/formatDateISOStringToDateTime', () => ({
      formatDateISOStringToDateTime: jest
        .fn()
        .mockReturnValue(mockFormattedDate),
    }));

    const result = formatDateTimeString({
      ...defaultParams,
      value: mockDate,
      localeCatalog: enUS,
    });

    expect(result).toBe(mockFormattedDate);
  });

  describe('fa-IR catalog (persian calendar)', () => {
    const persianParams = {
      ...defaultParams,
      timeZone: 'Asia/Tehran',
      localeCatalog: faIR,
    };

    it('should display the date-time in the user timezone with 24-hour time', () => {
      expect(
        formatDateTimeString({
          ...persianParams,
          value: '2026-09-28T10:00:00Z',
        }),
      ).toBe('۶ مهر ۱۴۰۵، ۱۳:۳۰');
    });

    it('should display 12-hour time with persian digits', () => {
      const result = formatDateTimeString({
        ...persianParams,
        value: '2026-09-28T10:00:00Z',
        timeFormat: TimeFormat.HOUR_12,
      });

      expect(result).toBe('۶ مهر ۱۴۰۵، ۱:۳۰ ب.ظ.');
      expect(result).not.toMatch(/[0-9]/);
    });

    it('should display Nowruz in the persian calendar', () => {
      expect(
        formatDateTimeString({
          ...persianParams,
          value: '2026-03-21T08:30:00Z',
        }),
      ).toBe('۱ فروردین ۱۴۰۵، ۱۲:۰۰');
    });

    it('should fall back to the user date-time format for custom unicode formats', () => {
      const result = formatDateTimeString({
        ...persianParams,
        value: '2026-09-28T10:00:00Z',
        dateFieldSettings: {
          displayFormat: FieldDateDisplayFormat.CUSTOM,
          customUnicodeDateFormat: 'yyyy-MM-dd HH:mm',
        },
      });

      expect(result).toBe('۶ مهر ۱۴۰۵، ۱۳:۳۰');
      expect(result).not.toMatch(/[0-9]/);
    });

    describe('relative display', () => {
      beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-09-28T12:00:00Z'));
      });

      afterAll(() => {
        jest.useRealTimers();
      });

      it('should return 3 hours ago in persian', () => {
        expect(
          formatDateTimeString({
            ...persianParams,
            value: '2026-09-28T09:00:00Z',
            dateFieldSettings: {
              displayFormat: FieldDateDisplayFormat.RELATIVE,
            },
          }),
        ).toBe('۳ ساعت پیش');
      });
    });
  });

  describe('non fa-IR locales (gregorian calendar unchanged)', () => {
    it('should keep the en output', () => {
      expect(
        formatDateTimeString({
          ...defaultParams,
          value: '2026-09-28T10:00:00Z',
          timeZone: 'Asia/Tehran',
          localeCatalog: enUS,
        }),
      ).toBe('28 Sep, 2026 13:30');
      expect(
        formatDateTimeString({
          ...defaultParams,
          value: '2026-09-28T10:00:00Z',
          timeZone: 'Asia/Tehran',
          dateFormat: DateFormat.MONTH_FIRST,
          timeFormat: TimeFormat.HOUR_12,
          localeCatalog: enUS,
        }),
      ).toBe('Sep 28, 2026 1:30 PM');
    });

    it('should keep the custom unicode format for en', () => {
      expect(
        formatDateTimeString({
          ...defaultParams,
          value: '2026-09-28T10:00:00Z',
          localeCatalog: enUS,
          dateFieldSettings: {
            displayFormat: FieldDateDisplayFormat.CUSTOM,
            customUnicodeDateFormat: 'yyyy-MM-dd HH:mm',
          },
        }),
      ).toBe('2026-09-28 10:00');
    });

    it('should keep the de output', () => {
      expect(
        formatDateTimeString({
          ...defaultParams,
          value: '2026-09-28T10:00:00Z',
          timeZone: 'Asia/Tehran',
          localeCatalog: de,
        }),
      ).toBe(
        formatInTimeZone(
          new Date('2026-09-28T10:00:00Z'),
          'Asia/Tehran',
          `${DateFormat.DAY_FIRST} ${TimeFormat.HOUR_24}`,
          { locale: de },
        ),
      );
    });
  });
});
