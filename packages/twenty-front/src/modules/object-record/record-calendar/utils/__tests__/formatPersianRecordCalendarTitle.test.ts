import { DateFormat } from '@/localization/constants/DateFormat';
import { formatPersianRecordCalendarDayNumber } from '@/object-record/record-calendar/utils/formatPersianRecordCalendarDayNumber';
import { formatPersianRecordCalendarTitle } from '@/object-record/record-calendar/utils/formatPersianRecordCalendarTitle';
import { formatPersianRecordCalendarWeekDay } from '@/object-record/record-calendar/utils/formatPersianRecordCalendarWeekDay';
import { Temporal } from 'temporal-polyfill';
import { ViewCalendarLayout } from '~/generated-metadata/graphql';

const formatTitle = (
  calendarLayout: ViewCalendarLayout,
  selectedDate: string,
  firstDay = selectedDate,
  lastDay = selectedDate,
) =>
  formatPersianRecordCalendarTitle({
    selectedDate: Temporal.PlainDate.from(selectedDate),
    calendarLayout,
    firstDay: Temporal.PlainDate.from(firstDay),
    lastDay: Temporal.PlainDate.from(lastDay),
    dateFormat: DateFormat.SYSTEM,
  });

describe('formatPersianRecordCalendarTitle', () => {
  it('formats Persian month titles matching the Persian grid', () => {
    expect(formatTitle(ViewCalendarLayout.MONTH, '2026-03-21')).toBe(
      'فروردین ۱۴۰۵',
    );
    expect(formatTitle(ViewCalendarLayout.MONTH, '2026-04-20')).toBe(
      'فروردین ۱۴۰۵',
    );
    expect(formatTitle(ViewCalendarLayout.MONTH, '2026-03-20')).toBe(
      'اسفند ۱۴۰۴',
    );
  });

  it('formats the Nowruz day title with the Persian weekday', () => {
    expect(formatTitle(ViewCalendarLayout.DAY, '2026-03-21')).toBe(
      'شنبه، ۱ فروردین ۱۴۰۵',
    );
    expect(formatTitle(ViewCalendarLayout.DAY, '2026-03-20')).toBe(
      'جمعه، ۲۹ اسفند ۱۴۰۴',
    );
  });

  it('formats week ranges within and across the Persian year boundary', () => {
    expect(
      formatTitle(
        ViewCalendarLayout.WEEK,
        '2026-03-21',
        '2026-03-21',
        '2026-03-27',
      ),
    ).toBe('۱ تا ۷ فروردین ۱۴۰۵');
    expect(
      formatTitle(
        ViewCalendarLayout.WEEK,
        '2026-03-18',
        '2026-03-15',
        '2026-03-21',
      ),
    ).toBe('۲۴ اسفند ۱۴۰۴ تا ۱ فروردین ۱۴۰۵');
  });
});

describe('formatPersianRecordCalendarWeekDay', () => {
  it('uses Persian weekday names in Saturday-first order', () => {
    const saturday = Temporal.PlainDate.from('2026-03-21');

    expect(
      Array.from({ length: 7 }, (_, index) =>
        formatPersianRecordCalendarWeekDay(saturday.add({ days: index })),
      ),
    ).toEqual([
      'شنبه',
      'یکشنبه',
      'دوشنبه',
      'سه‌شنبه',
      'چهارشنبه',
      'پنجشنبه',
      'جمعه',
    ]);
  });
});

describe('formatPersianRecordCalendarDayNumber', () => {
  it('shows the Persian day of month with Persian digits', () => {
    expect(
      formatPersianRecordCalendarDayNumber(
        Temporal.PlainDate.from('2026-03-21'),
      ),
    ).toBe('۱');
    expect(
      formatPersianRecordCalendarDayNumber(
        Temporal.PlainDate.from('2026-04-20'),
      ),
    ).toBe('۳۱');
    expect(
      formatPersianRecordCalendarDayNumber(
        Temporal.PlainDate.from('2026-03-20'),
      ),
    ).toBe('۲۹');
  });
});
