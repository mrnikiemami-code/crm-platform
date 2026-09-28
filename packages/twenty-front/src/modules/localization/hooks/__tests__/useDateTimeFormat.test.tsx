import { renderHook } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';

import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { workspaceMemberFormatPreferencesState } from '@/localization/states/workspaceMemberFormatPreferencesState';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { CalendarStartDay } from 'twenty-shared/constants';

const mockPreferences = {
  timeZone: 'America/New_York',
  dateFormat: DateFormat.MONTH_FIRST,
  timeFormat: TimeFormat.HOUR_24,
  numberFormat: '1,000.00' as any,
  calendarStartDay: CalendarStartDay.MONDAY,
};

const setCurrentWorkspaceMemberLocale = (locale: string) =>
  jotaiStore.set(currentWorkspaceMemberState.atom, {
    locale,
  } as CurrentWorkspaceMember);

const Wrapper = ({ children }: { children: ReactNode }) => (
  <JotaiProvider store={jotaiStore}>{children}</JotaiProvider>
);

describe('useDateTimeFormat', () => {
  beforeEach(() => {
    jotaiStore.set(workspaceMemberFormatPreferencesState.atom, mockPreferences);
    jotaiStore.set(currentWorkspaceMemberState.atom, null);
  });

  it('should be a function', () => {
    expect(typeof useDateTimeFormat).toBe('function');
  });

  it('should return date and time format preferences', () => {
    const { result } = renderHook(() => useDateTimeFormat(), {
      wrapper: Wrapper,
    });

    expect(result.current).toEqual({
      timeZone: 'America/New_York',
      dateFormat: DateFormat.MONTH_FIRST,
      timeFormat: TimeFormat.HOUR_24,
      calendarStartDay: CalendarStartDay.MONDAY,
      calendar: 'gregory',
    });
  });

  it('should return updated values when preferences change', () => {
    jotaiStore.set(workspaceMemberFormatPreferencesState.atom, {
      ...mockPreferences,
      timeZone: 'Europe/London',
      dateFormat: DateFormat.DAY_FIRST,
    });

    const { result } = renderHook(() => useDateTimeFormat(), {
      wrapper: Wrapper,
    });

    expect(result.current.timeZone).toBe('Europe/London');
    expect(result.current.dateFormat).toBe(DateFormat.DAY_FIRST);
    expect(result.current.timeFormat).toBe(TimeFormat.HOUR_24);
    expect(result.current.calendarStartDay).toBe(CalendarStartDay.MONDAY);
  });

  it('should resolve the persian calendar for a fa-IR workspace member', () => {
    setCurrentWorkspaceMemberLocale('fa-IR');

    const { result } = renderHook(() => useDateTimeFormat(), {
      wrapper: Wrapper,
    });

    expect(result.current.calendar).toBe('persian');
  });

  it('should keep the gregorian calendar for an en workspace member', () => {
    setCurrentWorkspaceMemberLocale('en');

    const { result } = renderHook(() => useDateTimeFormat(), {
      wrapper: Wrapper,
    });

    expect(result.current.calendar).toBe('gregory');
  });

  it('should not let the locale change timezone or format preferences', () => {
    setCurrentWorkspaceMemberLocale('fa-IR');

    const { result } = renderHook(() => useDateTimeFormat(), {
      wrapper: Wrapper,
    });

    expect(result.current.timeZone).toBe('America/New_York');
    expect(result.current.dateFormat).toBe(DateFormat.MONTH_FIRST);
    expect(result.current.timeFormat).toBe(TimeFormat.HOUR_24);
    expect(result.current.calendarStartDay).toBe(CalendarStartDay.MONDAY);
  });

  it('should have stable return object structure', () => {
    const { result } = renderHook(() => useDateTimeFormat(), {
      wrapper: Wrapper,
    });

    const keys = Object.keys(result.current);
    expect(keys).toEqual([
      'timeZone',
      'dateFormat',
      'timeFormat',
      'calendarStartDay',
      'calendar',
    ]);
  });
});
