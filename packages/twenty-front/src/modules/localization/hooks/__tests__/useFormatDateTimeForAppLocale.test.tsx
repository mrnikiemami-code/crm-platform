import { renderHook } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';

import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { DateFormat } from '@/localization/constants/DateFormat';
import { NUMERIC_DATE_FORMAT_OPTIONS } from '@/localization/constants/NumericDateFormatOptions';
import { NUMERIC_DATE_TIME_FORMAT_OPTIONS } from '@/localization/constants/NumericDateTimeFormatOptions';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { useFormatDateTimeForAppLocale } from '@/localization/hooks/useFormatDateTimeForAppLocale';
import { workspaceMemberFormatPreferencesState } from '@/localization/states/workspaceMemberFormatPreferencesState';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { CalendarStartDay } from 'twenty-shared/constants';

const USER_TIME_ZONE = 'Asia/Tehran';

// 20:45 UTC is already 00:15 on the next day in Tehran.
const CROSS_MIDNIGHT_DATE = '2026-10-02T20:45:00Z';

const setWorkspaceMemberLocale = (locale: string) => {
  jotaiStore.set(workspaceMemberFormatPreferencesState.atom, {
    timeZone: USER_TIME_ZONE,
    dateFormat: DateFormat.MONTH_FIRST,
    timeFormat: TimeFormat.HOUR_24,
    numberFormat: '1,000.00' as any,
    calendarStartDay: CalendarStartDay.MONDAY,
  });
  jotaiStore.set(currentWorkspaceMemberState.atom, {
    locale,
  } as CurrentWorkspaceMember);
};

const Wrapper = ({ children }: { children: ReactNode }) => (
  <JotaiProvider store={jotaiStore}>{children}</JotaiProvider>
);

const renderFormatDateTimeForAppLocale = () =>
  renderHook(() => useFormatDateTimeForAppLocale(), { wrapper: Wrapper }).result
    .current;

describe('useFormatDateTimeForAppLocale', () => {
  it('should match the previous toLocale* output for en in the user timezone', () => {
    setWorkspaceMemberLocale('en');
    const formatDateTime = renderFormatDateTimeForAppLocale();
    const date = new Date(CROSS_MIDNIGHT_DATE);

    expect(formatDateTime(date, NUMERIC_DATE_FORMAT_OPTIONS)).toBe(
      date.toLocaleDateString('en', { timeZone: USER_TIME_ZONE }),
    );
    expect(formatDateTime(date, NUMERIC_DATE_TIME_FORMAT_OPTIONS)).toBe(
      date.toLocaleString('en', { timeZone: USER_TIME_ZONE }),
    );
    expect(formatDateTime(date, NUMERIC_DATE_FORMAT_OPTIONS)).toBe('10/3/2026');
  });

  it('should format with the persian calendar and digits for fa-IR', () => {
    setWorkspaceMemberLocale('fa-IR');
    const formatDateTime = renderFormatDateTimeForAppLocale();

    expect(
      formatDateTime(CROSS_MIDNIGHT_DATE, NUMERIC_DATE_FORMAT_OPTIONS),
    ).toBe('۱۴۰۵/۷/۱۱');
  });

  it('should return an empty string for invalid dates', () => {
    setWorkspaceMemberLocale('fa-IR');
    const formatDateTime = renderFormatDateTimeForAppLocale();

    expect(formatDateTime('not-a-date', NUMERIC_DATE_FORMAT_OPTIONS)).toBe('');
  });
});
