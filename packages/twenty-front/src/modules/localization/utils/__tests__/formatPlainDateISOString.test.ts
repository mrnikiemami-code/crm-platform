import { DateFormat } from '@/localization/constants/DateFormat';
import { formatPlainDateISOString } from '@/localization/utils/formatPlainDateISOString';
import { format } from 'date-fns';
import { enUS, faIR } from 'date-fns/locale';

describe('formatPlainDateISOString', () => {
  describe('gregory calendar', () => {
    it('should format with the date-fns pattern by default', () => {
      expect(
        formatPlainDateISOString({
          date: '2026-09-28',
          dateFormat: DateFormat.MONTH_FIRST,
          localeCatalog: enUS,
        }),
      ).toBe('Sep 28, 2026');
    });

    it('should keep the gregorian output for the faIR catalog when the calendar is gregory', () => {
      expect(
        formatPlainDateISOString({
          date: '2026-09-28',
          dateFormat: DateFormat.DAY_FIRST,
          localeCatalog: faIR,
          calendar: 'gregory',
        }),
      ).toBe(
        format(new Date(2026, 8, 28), DateFormat.DAY_FIRST, { locale: faIR }),
      );
    });
  });

  describe('persian calendar', () => {
    it('should format Nowruz as the first day of the persian year', () => {
      expect(
        formatPlainDateISOString({
          date: '2026-03-21',
          dateFormat: DateFormat.DAY_FIRST,
          calendar: 'persian',
        }),
      ).toBe('۱ فروردین ۱۴۰۵');
    });

    it('should format a plain date in the persian calendar', () => {
      expect(
        formatPlainDateISOString({
          date: '2026-09-28',
          dateFormat: DateFormat.DAY_FIRST,
          calendar: 'persian',
        }),
      ).toBe('۶ مهر ۱۴۰۵');
    });

    it('should format the last day of the persian year', () => {
      expect(
        formatPlainDateISOString({
          date: '2026-03-20',
          dateFormat: DateFormat.DAY_FIRST,
          calendar: 'persian',
        }),
      ).toBe('۲۹ اسفند ۱۴۰۴');
    });
  });
});
