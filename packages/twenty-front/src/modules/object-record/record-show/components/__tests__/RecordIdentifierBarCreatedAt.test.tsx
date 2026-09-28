import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
import { enUS, faIR } from 'date-fns/locale';
import { Provider as JotaiProvider } from 'jotai';
import { CalendarStartDay } from 'twenty-shared/constants';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { workspaceMemberFormatPreferencesState } from '@/localization/states/workspaceMemberFormatPreferencesState';
import { RecordIdentifierBarCreatedAt } from '@/object-record/record-show/components/RecordIdentifierBarCreatedAt';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { dateLocaleState } from '~/localization/states/dateLocaleState';
import { messages as enMessages } from '~/locales/generated/en';

// 1404/12/29 23:45 in Tehran, i.e. still 20 March 2026 in GMT.
const mockRecordCreatedAt = '2026-03-20T20:15:00.000Z';

jest.mock(
  '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorValue',
  () => ({
    useAtomFamilySelectorValue: () => mockRecordCreatedAt,
  }),
);

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

i18n.load(SOURCE_LOCALE, enMessages);
i18n.activate(SOURCE_LOCALE);

const setLocale = (locale: 'fa-IR' | 'en') => {
  jotaiStore.set(currentWorkspaceMemberState.atom, {
    locale,
  } as CurrentWorkspaceMember);
  jotaiStore.set(workspaceMemberFormatPreferencesState.atom, {
    timeZone: 'Asia/Tehran',
    dateFormat: DateFormat.DAY_FIRST,
    timeFormat: TimeFormat.HOUR_24,
    numberFormat: '1,000.00' as any,
    calendarStartDay: CalendarStartDay.MONDAY,
  });
  jotaiStore.set(dateLocaleState.atom, {
    locale,
    localeCatalog: locale === 'fa-IR' ? faIR : enUS,
  });
};

const renderCreatedAt = () =>
  render(
    <JotaiProvider store={jotaiStore}>
      <I18nProvider i18n={i18n}>
        <RecordIdentifierBarCreatedAt objectRecordId="record-id" />
      </I18nProvider>
    </JotaiProvider>,
  );

describe('RecordIdentifierBarCreatedAt', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-21T08:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('shows persian relative text and a jalali tooltip in the user timezone for fa-IR', () => {
    setLocale('fa-IR');

    renderCreatedAt();

    expect(screen.getByText('Created ۱۲ ساعت پیش')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
      '۲۹ اسفند ۱۴۰۴، ۲۳:۴۵',
    );
  });

  it('keeps the existing english relative text and gregorian tooltip for en', () => {
    setLocale('en');

    renderCreatedAt();

    expect(screen.getByText('Created about 12 hours ago')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
      'Mar 20, 2026 · 20:15',
    );
  });
});
