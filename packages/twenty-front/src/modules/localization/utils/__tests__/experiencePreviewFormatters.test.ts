import { DateFormat } from '@/localization/constants/DateFormat';
import { DATE_TIME_SETTINGS_PREVIEW_DATE } from '@/localization/constants/DateTimeSettingsPreviewDate';
import { NumberFormat } from '@/localization/constants/NumberFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { formatDateISOStringToDate } from '@/localization/utils/formatDateISOStringToDate';
import { formatLocalizedTimeZoneLabel } from '@/localization/utils/formatLocalizedTimeZoneLabel';
import { formatNumberPreview } from '@/localization/utils/formatNumberPreview';
import { formatTimePreview } from '@/localization/utils/formatTimePreview';
import { formatTimeZoneLabel } from '@/localization/utils/formatTimeZoneLabel';

const LATIN_DIGIT_REGEX = /[0-9]/;
const PERSIAN_DIGIT_REGEX = /[\u06F0-\u06F9]/;
const TIME_ZONE = 'Asia/Tehran';

describe('Experience settings preview formatters', () => {
  describe('date format preview', () => {
    it.each([
      DateFormat.DAY_FIRST,
      DateFormat.MONTH_FIRST,
      DateFormat.YEAR_FIRST,
    ])('renders the Jalali year with Persian digits for %s', (dateFormat) => {
      const preview = formatDateISOStringToDate({
        date: DATE_TIME_SETTINGS_PREVIEW_DATE.toISOString(),
        timeZone: TIME_ZONE,
        dateFormat,
        calendar: 'persian',
      });

      expect(preview).toContain('\u06F1\u06F4\u06F0\u06F2');
      expect(preview).not.toMatch(LATIN_DIGIT_REGEX);
      expect(preview).not.toContain('Mar');
    });

    it('keeps the gregorian preview unchanged', () => {
      expect(
        formatDateISOStringToDate({
          date: DATE_TIME_SETTINGS_PREVIEW_DATE.toISOString(),
          timeZone: 'UTC',
          dateFormat: DateFormat.MONTH_FIRST,
        }),
      ).toBe('Mar 12, 2024');
    });
  });

  describe('formatTimePreview', () => {
    it('renders 24h with Persian digits', () => {
      expect(
        formatTimePreview({
          date: DATE_TIME_SETTINGS_PREVIEW_DATE,
          timeZone: TIME_ZONE,
          timeFormat: TimeFormat.HOUR_24,
          calendar: 'persian',
        }),
      ).toBe('\u06F1\u06F3:\u06F0\u06F0');
    });

    it('renders 12h with a localized day period and no AM/PM', () => {
      const preview = formatTimePreview({
        date: DATE_TIME_SETTINGS_PREVIEW_DATE,
        timeZone: TIME_ZONE,
        timeFormat: TimeFormat.HOUR_12,
        calendar: 'persian',
      });

      expect(preview).toMatch(PERSIAN_DIGIT_REGEX);
      expect(preview).not.toMatch(LATIN_DIGIT_REGEX);
      expect(preview).not.toMatch(/AM|PM/i);
    });

    it('keeps the gregorian output unchanged', () => {
      expect(
        formatTimePreview({
          date: DATE_TIME_SETTINGS_PREVIEW_DATE,
          timeZone: 'UTC',
          timeFormat: TimeFormat.HOUR_12,
          calendar: 'gregory',
        }),
      ).toBe('9:30 AM');
    });
  });

  describe('formatNumberPreview', () => {
    it('uses Persian digits and separators for commas and dot', () => {
      expect(
        formatNumberPreview({
          value: 1234.56,
          numberFormat: NumberFormat.COMMAS_AND_DOT,
          decimals: 2,
          calendar: 'persian',
        }),
      ).toBe('\u06F1\u066C\u06F2\u06F3\u06F4\u066B\u06F5\u06F6');
    });

    it('keeps the distinct separators of other formats with Persian digits', () => {
      expect(
        formatNumberPreview({
          value: 1234.56,
          numberFormat: NumberFormat.DOTS_AND_COMMA,
          decimals: 2,
          calendar: 'persian',
        }),
      ).toBe('\u06F1.\u06F2\u06F3\u06F4,\u06F5\u06F6');
    });

    it('keeps the gregorian output unchanged', () => {
      expect(
        formatNumberPreview({
          value: 1234.56,
          numberFormat: NumberFormat.COMMAS_AND_DOT,
          decimals: 2,
          calendar: 'gregory',
        }),
      ).toBe('1,234.56');
    });
  });

  describe('formatLocalizedTimeZoneLabel', () => {
    it('localizes the visible label without changing the IANA id', () => {
      const label = formatLocalizedTimeZoneLabel(TIME_ZONE, 'persian');

      expect(label).toContain('(UTC+\u06F0\u06F3:\u06F3\u06F0)');
      expect(label).toContain('Tehran');
      expect(label).not.toMatch(/GMT/);
    });

    it('keeps the gregorian label unchanged', () => {
      expect(formatLocalizedTimeZoneLabel('Europe/Paris', 'gregory')).toBe(
        formatTimeZoneLabel('Europe/Paris'),
      );
    });
  });
});
