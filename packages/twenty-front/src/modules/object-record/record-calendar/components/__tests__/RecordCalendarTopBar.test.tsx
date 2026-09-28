import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enUS, fr, type Locale } from 'date-fns/locale';
import { Temporal } from 'temporal-polyfill';
import { type ButtonProps } from 'twenty-ui/primitives/input';

import { DateFormat } from '@/localization/constants/DateFormat';
import { RecordCalendarTopBar } from '@/object-record/record-calendar/components/RecordCalendarTopBar';
import { recordCalendarSelectedDateComponentState } from '@/object-record/record-calendar/states/recordCalendarSelectedDateComponentState';
import { recordIndexCalendarLayoutComponentState } from '@/object-record/record-index/states/recordIndexCalendarLayoutComponentState';
import { ViewCalendarLayout } from '~/generated-metadata/graphql';

const mockSetRecordCalendarSelectedDate = jest.fn();
const mockSetRecordIndexCalendarLayout = jest.fn();
const mockUpdateCurrentView = jest.fn();
const mockUseAtomComponentState = jest.fn();
const mockUseAtomStateValue = jest.fn();
const mockUseRecordCalendarDaysRange = jest.fn();
const mockUseDateTimeFormat = jest.fn();

jest.mock('@/localization/hooks/useDateTimeFormat', () => ({
  useDateTimeFormat: () => mockUseDateTimeFormat(),
}));
jest.mock(
  '@/object-record/record-calendar/hooks/useRecordCalendarDaysRange',
  () => ({
    useRecordCalendarDaysRange: (...args: unknown[]) =>
      mockUseRecordCalendarDaysRange(...args),
  }),
);
jest.mock(
  '@/ui/input/components/internal/date/components/DatePickerWithoutCalendar',
  () => ({ DatePickerWithoutCalendar: () => null }),
);
jest.mock(
  '@/ui/input/components/internal/date/components/TimeZoneAbbreviation',
  () => ({
    TimeZoneAbbreviation: () => <span data-testid="time-zone" />,
  }),
);
jest.mock('@/ui/input/components/Select', () => ({
  Select: ({
    options,
    value,
    onChange,
  }: {
    options: { label: string; value: ViewCalendarLayout }[];
    value: ViewCalendarLayout;
    onChange: (value: ViewCalendarLayout) => void;
  }) => (
    <select
      data-testid="layout-select"
      value={value}
      onChange={(event) => onChange(event.target.value as ViewCalendarLayout)}
    >
      {options.map(({ label, value }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  ),
}));
jest.mock('@/ui/input/components/SelectControl', () => ({
  SelectControl: ({
    selectedOption,
  }: {
    selectedOption: { label: string };
  }) => <span data-testid="selected-date">{selectedOption.label}</span>,
}));
jest.mock('@/ui/layout/dropdown/components/Dropdown', () => ({
  Dropdown: ({ clickableComponent }: { clickableComponent: React.ReactNode }) =>
    clickableComponent,
}));
jest.mock('@/ui/layout/dropdown/hooks/useCloseDropdown', () => ({
  useCloseDropdown: jest.fn(() => ({ closeDropdown: jest.fn() })),
}));
jest.mock(
  '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow',
  () => ({
    useAvailableComponentInstanceIdOrThrow: jest.fn(() => 'calendar-id'),
  }),
);
jest.mock('@/ui/utilities/state/jotai/hooks/useAtomComponentState', () => ({
  useAtomComponentState: (...args: unknown[]) =>
    mockUseAtomComponentState(...args),
}));
jest.mock('@/ui/utilities/state/jotai/hooks/useAtomStateValue', () => ({
  useAtomStateValue: (...args: unknown[]) => mockUseAtomStateValue(...args),
}));
jest.mock('@/views/hooks/useUpdateCurrentView', () => ({
  useUpdateCurrentView: jest.fn(() => ({
    updateCurrentView: mockUpdateCurrentView,
  })),
}));
jest.mock('twenty-ui/primitives/input', () => ({
  Button: ({
    'aria-label': ariaLabel,
    children,
    onClick,
  }: Pick<ButtonProps, 'aria-label' | 'children' | 'onClick'>) => (
    <button aria-label={ariaLabel} onClick={onClick}>
      {children}
    </button>
  ),
}));

const setupTopBar = ({
  calendarLayout = ViewCalendarLayout.DAY,
  selectedDate = '2026-07-15',
  firstDay = '2026-07-13',
  lastDay = '2026-07-19',
  calendar = 'gregory',
  timeZone = 'UTC',
  locale = 'en-US',
  localeCatalog = enUS,
}: {
  calendarLayout?: ViewCalendarLayout;
  selectedDate?: string;
  firstDay?: string;
  lastDay?: string;
  calendar?: 'gregory' | 'persian';
  timeZone?: string;
  locale?: string;
  localeCatalog?: Locale;
} = {}) => {
  mockUseAtomComponentState.mockImplementation((state: unknown) => {
    if (state === recordIndexCalendarLayoutComponentState) {
      return [calendarLayout, mockSetRecordIndexCalendarLayout];
    }

    if (state === recordCalendarSelectedDateComponentState) {
      return [
        Temporal.PlainDate.from(selectedDate),
        mockSetRecordCalendarSelectedDate,
      ];
    }

    return [undefined, jest.fn()];
  });
  mockUseAtomStateValue.mockReturnValue({ locale, localeCatalog });
  mockUseDateTimeFormat.mockReturnValue({
    timeZone,
    calendar,
    dateFormat: DateFormat.SYSTEM,
  });
  mockUseRecordCalendarDaysRange.mockReturnValue({
    firstDay: Temporal.PlainDate.from(firstDay),
    lastDay: Temporal.PlainDate.from(lastDay),
  });
};

describe('RecordCalendarTopBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupTopBar();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows Day, Week, and Month with the selected full date', () => {
    render(<RecordCalendarTopBar />);

    expect(screen.getByTestId('selected-date')).toHaveTextContent(
      'Wednesday, July 15, 2026',
    );
    expect(
      Array.from(
        screen.getByTestId('layout-select').querySelectorAll('option'),
      ).map((option) => option.textContent),
    ).toEqual(['Day', 'Week', 'Month']);
    expect(screen.getByTestId('time-zone')).toBeInTheDocument();
  });

  it('navigates the Day layout one day at a time', () => {
    render(<RecordCalendarTopBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next period' }));

    expect(mockSetRecordCalendarSelectedDate).toHaveBeenNthCalledWith(
      1,
      Temporal.PlainDate.from('2026-07-14'),
    );
    expect(mockSetRecordCalendarSelectedDate).toHaveBeenNthCalledWith(
      2,
      Temporal.PlainDate.from('2026-07-16'),
    );
  });

  it('persists a week selection from the top bar', async () => {
    const user = userEvent.setup();
    render(<RecordCalendarTopBar />);

    await user.selectOptions(screen.getByRole('combobox'), 'WEEK');

    expect(mockSetRecordIndexCalendarLayout).toHaveBeenCalledWith(
      ViewCalendarLayout.WEEK,
    );
    expect(mockUpdateCurrentView).toHaveBeenCalledWith({
      calendarLayout: ViewCalendarLayout.WEEK,
    });
  });

  it('keeps English week and month titles and gregorian month navigation', () => {
    setupTopBar({ calendarLayout: ViewCalendarLayout.WEEK });
    const { unmount } = render(<RecordCalendarTopBar />);

    expect(screen.getByTestId('selected-date')).toHaveTextContent(
      'Jul 13 – 19, 2026',
    );
    unmount();

    setupTopBar({ calendarLayout: ViewCalendarLayout.MONTH });
    render(<RecordCalendarTopBar />);

    expect(screen.getByTestId('selected-date')).toHaveTextContent('July 2026');

    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next period' }));

    expect(mockSetRecordCalendarSelectedDate).toHaveBeenNthCalledWith(
      1,
      Temporal.PlainDate.from('2026-06-15'),
    );
    expect(mockSetRecordCalendarSelectedDate).toHaveBeenNthCalledWith(
      2,
      Temporal.PlainDate.from('2026-08-15'),
    );
  });

  it('keeps French day and month titles unchanged', () => {
    setupTopBar({ locale: 'fr-FR', localeCatalog: fr });
    const { unmount } = render(<RecordCalendarTopBar />);

    expect(screen.getByTestId('selected-date')).toHaveTextContent(
      'mercredi 15 juillet 2026',
    );
    unmount();

    setupTopBar({
      calendarLayout: ViewCalendarLayout.MONTH,
      locale: 'fr-FR',
      localeCatalog: fr,
    });
    render(<RecordCalendarTopBar />);

    expect(screen.getByTestId('selected-date')).toHaveTextContent(
      'juillet 2026',
    );
  });

  it('shows Persian titles that match the Persian grid', () => {
    setupTopBar({
      calendar: 'persian',
      calendarLayout: ViewCalendarLayout.MONTH,
      selectedDate: '2026-04-01',
    });
    const { unmount: unmountMonth } = render(<RecordCalendarTopBar />);

    expect(screen.getByTestId('selected-date')).toHaveTextContent(
      'فروردین ۱۴۰۵',
    );
    unmountMonth();

    setupTopBar({
      calendar: 'persian',
      calendarLayout: ViewCalendarLayout.WEEK,
      selectedDate: '2026-03-18',
      firstDay: '2026-03-15',
      lastDay: '2026-03-21',
    });
    const { unmount: unmountWeek } = render(<RecordCalendarTopBar />);

    expect(screen.getByTestId('selected-date')).toHaveTextContent(
      '۲۴ اسفند ۱۴۰۴ تا ۱ فروردین ۱۴۰۵',
    );
    unmountWeek();

    setupTopBar({ calendar: 'persian', selectedDate: '2026-03-21' });
    render(<RecordCalendarTopBar />);

    expect(screen.getByTestId('selected-date')).toHaveTextContent(
      'شنبه، ۱ فروردین ۱۴۰۵',
    );
  });

  it('navigates Persian months across Nowruz', () => {
    setupTopBar({
      calendar: 'persian',
      calendarLayout: ViewCalendarLayout.MONTH,
      selectedDate: '2026-03-10',
    });
    render(<RecordCalendarTopBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Next period' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));

    expect(mockSetRecordCalendarSelectedDate).toHaveBeenNthCalledWith(
      1,
      Temporal.PlainDate.from('2026-04-08'),
    );
    expect(mockSetRecordCalendarSelectedDate).toHaveBeenNthCalledWith(
      2,
      Temporal.PlainDate.from('2026-02-08'),
    );
  });

  it('navigates Persian days across Nowruz', () => {
    setupTopBar({ calendar: 'persian', selectedDate: '2026-03-20' });
    render(<RecordCalendarTopBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Next period' }));

    expect(mockSetRecordCalendarSelectedDate).toHaveBeenCalledWith(
      Temporal.PlainDate.from('2026-03-21'),
    );
  });

  it('maps Today to the Tehran date right after Nowruz midnight', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-20T20:30:00Z'));
    setupTopBar({ calendar: 'persian', timeZone: 'Asia/Tehran' });
    render(<RecordCalendarTopBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    expect(mockSetRecordCalendarSelectedDate).toHaveBeenCalledWith(
      Temporal.PlainDate.from('2026-03-21'),
    );
  });
});
