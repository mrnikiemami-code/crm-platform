import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
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
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { WorkflowRunStepLogsEntries } from '@/workflow/workflow-steps/workflow-actions/components/WorkflowRunStepLogsEntries';
import { messages as enMessages } from '~/locales/generated/en';

i18n.load(SOURCE_LOCALE, enMessages);
i18n.activate(SOURCE_LOCALE);

const setLocale = (locale: string) => {
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
};

const renderEntries = () =>
  render(
    <JotaiProvider store={jotaiStore}>
      <I18nProvider i18n={i18n}>
        <WorkflowRunStepLogsEntries
          entries={[
            {
              timestamp: '2026-10-02T20:45:00.000Z',
              level: 'info',
              message: 'Step started',
            },
            { timestamp: 'not-a-date', level: 'warn', message: 'Raw' },
          ]}
        />
      </I18nProvider>
    </JotaiProvider>,
  );

describe('WorkflowRunStepLogsEntries', () => {
  it('shows entry times with persian digits in the user timezone for fa-IR', () => {
    setLocale('fa-IR');

    renderEntries();

    expect(screen.getByText('۰:۱۵:۰۰')).toBeInTheDocument();
    expect(screen.getByText('not-a-date')).toBeInTheDocument();
  });

  it('shows entry times in the en app locale and user timezone', () => {
    setLocale('en');

    renderEntries();

    expect(screen.getByText(/^12:15:00\sAM$/)).toBeInTheDocument();
  });
});
