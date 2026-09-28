import { render, screen } from '@testing-library/react';
import { enUS, faIR } from 'date-fns/locale';
import { Provider as JotaiProvider } from 'jotai';
import { CalendarStartDay } from 'twenty-shared/constants';

import { EventRowDate } from '@/activities/timeline-activities/rows/components/EventRowDate';
import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { workspaceMemberFormatPreferencesState } from '@/localization/states/workspaceMemberFormatPreferencesState';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { dateLocaleState } from '~/localization/states/dateLocaleState';

jest.mock('twenty-ui/primitives/surfaces', () => {
  const { createElement } = jest.requireActual('react');

  return {
    ...jest.requireActual('twenty-ui/primitives/surfaces'),
    Tooltip: ({
      content,
      children,
    }: {
      content: string;
      children: React.ReactNode;
    }) =>
      createElement(
        'div',
        null,
        createElement('span', { 'data-testid': 'tooltip-content' }, content),
        children,
      ),
  };
});

const setLocale = (locale: 'fa-IR' | 'en') => {
  jotaiStore.set(currentWorkspaceMemberState.atom, {
    locale,
  } as CurrentWorkspaceMember);
  jotaiStore.set(workspaceMemberFormatPreferencesState.atom, {
    timeZone: 'Asia/Tehran',
    dateFormat: DateFormat.MONTH_FIRST,
    timeFormat: TimeFormat.HOUR_24,
    numberFormat: '1,000.00' as any,
    calendarStartDay: CalendarStartDay.MONDAY,
  });
  jotaiStore.set(dateLocaleState.atom, {
    locale,
    localeCatalog: locale === 'fa-IR' ? faIR : enUS,
  });
};

// 23:45 on 1404/12/29 in Tehran.
const happensAt = '2026-03-20T20:15:00.000Z';

const renderEventRowDate = () =>
  render(
    <JotaiProvider store={jotaiStore}>
      <EventRowDate happensAt={happensAt} />
    </JotaiProvider>,
  );

describe('EventRowDate', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-21T08:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('shows persian relative time and a jalali tooltip in the user timezone for fa-IR', () => {
    setLocale('fa-IR');

    renderEventRowDate();

    expect(screen.getByText('۱۲ ساعت پیش')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
      'اسفند ۲۹، ۱۴۰۴، ۲۳:۴۵',
    );
  });

  it('keeps english relative time and a gregorian tooltip for en', () => {
    setLocale('en');

    renderEventRowDate();

    expect(screen.getByText('about 12 hours ago')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
      'Mar 20, 2026 23:45',
    );
  });
});
