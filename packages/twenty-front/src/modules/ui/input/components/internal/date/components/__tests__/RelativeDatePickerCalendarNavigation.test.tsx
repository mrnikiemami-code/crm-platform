import { render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';

import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { RelativeDatePickerCalendarNavigation } from '@/ui/input/components/internal/date/components/RelativeDatePickerCalendarNavigation';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { APP_LOCALES } from 'twenty-shared/translations';

const JANUARY_2026 = new Date(2026, 0, 1);

// Unsupported tags such as pseudo-en fall back to the host default locale, so
// their previous output is host-dependent and cannot serve as a baseline.
const NON_FA_INTL_SUPPORTED_LOCALES = Object.keys(APP_LOCALES).filter(
  (locale) =>
    locale !== 'fa-IR' &&
    Intl.DateTimeFormat.supportedLocalesOf(locale).length > 0,
);

const renderNavigation = (locale: string | null) => {
  jotaiStore.set(
    currentWorkspaceMemberState.atom,
    locale === null ? null : ({ locale } as CurrentWorkspaceMember),
  );

  render(
    <JotaiProvider store={jotaiStore}>
      <RelativeDatePickerCalendarNavigation
        monthLabelDate={JANUARY_2026}
        onPreviousMonth={jest.fn()}
        onNextMonth={jest.fn()}
        prevMonthButtonDisabled={false}
        nextMonthButtonDisabled={false}
      />
    </JotaiProvider>,
  );
};

describe('RelativeDatePickerCalendarNavigation', () => {
  it('should label the month in the persian calendar shown by the fa-IR grid', () => {
    renderNavigation('fa-IR');

    const label = screen.getByText(/دی/);

    expect(label.textContent).toContain('۱۴۰۴');
    expect(label.textContent).not.toContain('ژانویه');
    expect(label.textContent).not.toContain('۲۰۲۶');
  });

  it('should keep the English label for en', () => {
    renderNavigation('en');

    expect(screen.getByText('January 2026')).toBeInTheDocument();
  });

  it('should fall back to the source locale without a workspace member', () => {
    renderNavigation(null);

    expect(screen.getByText('January 2026')).toBeInTheDocument();
  });

  it.each(NON_FA_INTL_SUPPORTED_LOCALES)(
    'should produce the same label as before for %s',
    (locale) => {
      renderNavigation(locale);

      const previousLabel = new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
      }).format(JANUARY_2026);

      expect(screen.getByText(previousLabel)).toBeInTheDocument();
    },
  );
});
