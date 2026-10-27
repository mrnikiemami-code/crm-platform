import { DateFormat } from '@/localization/constants/DateFormat';
import { formatDashboardSharedDateDisplay } from '@/page-layout/utils/formatDashboardSharedDateDisplay';
import {
  isValidCanonicalIsoPlainDate,
  parseDashboardSharedDateInput,
} from '@/page-layout/utils/parseDashboardSharedDateInput';

describe('parseDashboardSharedDateInput', () => {
  it('parses Persian digits Jalali input to ISO without treating 1405 as Gregorian', () => {
    const iso = parseDashboardSharedDateInput({
      value: '۱۴۰۵/۰۷/۰۱',
      calendar: 'persian',
      dateFormat: DateFormat.YEAR_FIRST,
    });

    expect(iso).toBe('2026-09-23');
    expect(iso).not.toBe('1405-07-01');
  });

  it('parses ASCII Jalali and rejects impossible Jalali days', () => {
    expect(
      parseDashboardSharedDateInput({
        value: '1405/07/01',
        calendar: 'persian',
        dateFormat: DateFormat.YEAR_FIRST,
      }),
    ).toBe('2026-09-23');

    expect(
      parseDashboardSharedDateInput({
        value: '1405/12/31',
        calendar: 'persian',
        dateFormat: DateFormat.YEAR_FIRST,
      }),
    ).toBeNull();
  });

  it('parses EN Gregorian ISO and slash forms', () => {
    expect(
      parseDashboardSharedDateInput({
        value: '2026-10-01',
        calendar: 'gregory',
        dateFormat: DateFormat.MONTH_FIRST,
      }),
    ).toBe('2026-10-01');

    expect(
      parseDashboardSharedDateInput({
        value: '10/01/2026',
        calendar: 'gregory',
        dateFormat: DateFormat.MONTH_FIRST,
      }),
    ).toBe('2026-10-01');
  });

  it('does not accept incomplete or invalid entries', () => {
    expect(
      parseDashboardSharedDateInput({
        value: '1405/07',
        calendar: 'persian',
        dateFormat: DateFormat.YEAR_FIRST,
      }),
    ).toBeNull();

    expect(
      parseDashboardSharedDateInput({
        value: '',
        calendar: 'persian',
        dateFormat: DateFormat.YEAR_FIRST,
      }),
    ).toBeNull();

    // 1405-07-01 is a valid Gregorian ISO string; Jalali protection is in
    // calendar:'persian' parsing, which must never emit year-1405 ISO.
    expect(isValidCanonicalIsoPlainDate('2026-09-23')).toBe(true);
    expect(isValidCanonicalIsoPlainDate('not-a-date')).toBe(false);
  });

  it('round-trips Jalali YEAR_FIRST Persian digits for a picked ISO date', () => {
    const iso = '2026-09-23';
    const display = formatDashboardSharedDateDisplay({
      isoPlainDate: iso,
      calendar: 'persian',
      dateFormat: DateFormat.MONTH_FIRST,
    });

    expect(display).toBe('۱۴۰۵/۰۷/۰۱');
    expect(
      parseDashboardSharedDateInput({
        value: display,
        calendar: 'persian',
        dateFormat: DateFormat.YEAR_FIRST,
      }),
    ).toBe(iso);
  });

  it('formats Farvardin 1 as ۱۴۰۵/۰۱/۰۱', () => {
    // 1405-01-01 Jalali = 2026-03-21 Gregorian
    expect(
      formatDashboardSharedDateDisplay({
        isoPlainDate: '2026-03-21',
        calendar: 'persian',
        dateFormat: DateFormat.DAY_FIRST,
      }),
    ).toBe('۱۴۰۵/۰۱/۰۱');
  });
});

