import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useRecordCalendarDaysRange } from '@/object-record/record-calendar/hooks/useRecordCalendarDaysRange';
import { renderHook } from '@testing-library/react';
import { enUS, fr, type Locale } from 'date-fns/locale';
import { Temporal } from 'temporal-polyfill';
import { ViewCalendarLayout } from '~/generated-metadata/graphql';

let mockCalendar = 'gregory';
let mockCalendarStartDay = 0;
let mockLocaleCatalog: Locale = enUS;

jest.mock('@/localization/hooks/useDateTimeFormat', () => ({
  useDateTimeFormat: () => ({ calendar: mockCalendar }),
}));
jest.mock('@/ui/utilities/state/jotai/hooks/useAtomStateValue', () => ({
  useAtomStateValue: (state: unknown) =>
    state === currentWorkspaceMemberState
      ? { calendarStartDay: mockCalendarStartDay }
      : { localeCatalog: mockLocaleCatalog },
}));

const renderRange = (
  selectedDate: string,
  calendarLayout: ViewCalendarLayout,
) =>
  renderHook(() =>
    useRecordCalendarDaysRange(
      Temporal.PlainDate.from(selectedDate),
      calendarLayout,
    ),
  ).result.current;

describe('useRecordCalendarDaysRange', () => {
  beforeEach(() => {
    mockCalendar = 'gregory';
    mockCalendarStartDay = 0;
    mockLocaleCatalog = enUS;
  });

  it('builds the Persian month grid with Saturday-first Persian weekday labels', () => {
    mockCalendar = 'persian';
    mockCalendarStartDay = 6;

    const range = renderRange('2026-04-01', ViewCalendarLayout.MONTH);

    expect(range.calendar).toBe('persian');
    expect(range.firstDay.toString()).toBe('2026-03-21');
    expect(range.lastDay.toString()).toBe('2026-04-24');
    expect(range.weekDayLabels).toEqual([
      'شنبه',
      'یکشنبه',
      'دوشنبه',
      'سه‌شنبه',
      'چهارشنبه',
      'پنجشنبه',
      'جمعه',
    ]);
  });

  it('keeps English month grid and labels unchanged', () => {
    const range = renderRange('2026-04-01', ViewCalendarLayout.MONTH);

    expect(range.firstDay.toString()).toBe('2026-03-29');
    expect(range.lastDay.toString()).toBe('2026-05-02');
    expect(range.weekDayLabels).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ]);
  });

  it('keeps French month grid and labels unchanged', () => {
    mockCalendarStartDay = 1;
    mockLocaleCatalog = fr;

    const range = renderRange('2026-04-01', ViewCalendarLayout.MONTH);

    expect(range.firstDay.toString()).toBe('2026-03-30');
    expect(range.lastDay.toString()).toBe('2026-05-03');
    expect(range.weekDayLabels).toEqual([
      'lun.',
      'mar.',
      'mer.',
      'jeu.',
      'ven.',
      'sam.',
      'dim.',
    ]);
  });
});
