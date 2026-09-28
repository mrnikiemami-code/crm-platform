import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';

import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { DatePicker } from '@/ui/input/components/internal/date/components/DatePicker';
import { DATE_PICKER_NAVIGATION_BUTTON_CLASS_NAME } from '@/ui/input/components/internal/date/styles/DatePickerNavigationButtonClassName';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { CalendarStartDay } from 'twenty-shared/constants';

const renderDatePicker = ({
  locale,
  plainDateString,
  calendarStartDay = CalendarStartDay.SATURDAY,
}: {
  locale: string;
  plainDateString: string;
  calendarStartDay?: CalendarStartDay;
}) => {
  jotaiStore.set(currentWorkspaceMemberState.atom, {
    locale,
    calendarStartDay,
  } as CurrentWorkspaceMember);

  const onChange = jest.fn();
  const onClose = jest.fn();

  render(
    <JotaiProvider store={jotaiStore}>
      <DatePicker
        instanceId="date-picker-test"
        plainDateString={plainDateString}
        onChange={onChange}
        onClose={onClose}
        hideHeaderInput
      />
    </JotaiProvider>,
  );

  return { onChange, onClose };
};

const findReactDatePickerDay = (dayOfMonth: number) =>
  waitFor(() => {
    const day = document.querySelector<HTMLElement>(
      `.react-datepicker__day--${String(dayOfMonth).padStart(3, '0')}:not(.react-datepicker__day--outside-month)`,
    );

    expect(day).not.toBeNull();

    return day as HTMLElement;
  });

describe('DatePicker', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('dir');
  });

  describe('fa-IR', () => {
    it('should render the Jalali month of the value with it selected', () => {
      renderDatePicker({ locale: 'fa-IR', plainDateString: '2026-09-28' });

      const grid = screen.getByRole('grid');
      const selectedDay = within(grid).getByRole('gridcell', {
        selected: true,
      });

      expect(selectedDay).toHaveAccessibleName('۶ مهر ۱۴۰۵');
      expect(selectedDay).toHaveTextContent('۶');
      expect(
        within(grid)
          .getAllByRole('gridcell')
          .filter((cell) => cell.getAttribute('aria-label')?.includes('مهر')),
      ).toHaveLength(30);
      expect(document.querySelector('.react-datepicker')).toBeNull();
    });

    it('should emit the canonical ISO date of the clicked Jalali day', () => {
      const { onChange, onClose } = renderDatePicker({
        locale: 'fa-IR',
        plainDateString: '2026-09-28',
      });

      fireEvent.click(screen.getByRole('gridcell', { name: '۱۰ مهر ۱۴۰۵' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('2026-10-02');
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith('2026-10-02');
    });

    it('should give back the same ISO date after a round trip through the grid', () => {
      const { onChange, onClose } = renderDatePicker({
        locale: 'fa-IR',
        plainDateString: '2026-09-28',
      });

      fireEvent.click(screen.getByRole('gridcell', { selected: true }));

      expect(onChange).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith('2026-09-28');
    });

    it('should navigate from Esfand to Farvardin of the next year', () => {
      // 1404/12/14 -> 1405/01/14.
      const { onChange } = renderDatePicker({
        locale: 'fa-IR',
        plainDateString: '2026-03-05',
      });

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(onChange).toHaveBeenCalledWith('2026-04-03');
    });

    it('should navigate from Farvardin back to Esfand of the previous year', () => {
      // 1405/01/01 -> 1404/12/01.
      const { onChange } = renderDatePicker({
        locale: 'fa-IR',
        plainDateString: '2026-03-21',
      });

      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

      expect(onChange).toHaveBeenCalledWith('2026-02-20');
    });

    it('should never emit a value annotated with the persian calendar', () => {
      const { onChange, onClose } = renderDatePicker({
        locale: 'fa-IR',
        plainDateString: '2026-03-05',
      });

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('gridcell', { name: '۲۰ اسفند ۱۴۰۴' }));

      [...onChange.mock.calls, ...onClose.mock.calls].forEach(([value]) => {
        expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should start the grid on the user calendar start day', () => {
      renderDatePicker({
        locale: 'fa-IR',
        plainDateString: '2026-09-28',
        calendarStartDay: CalendarStartDay.MONDAY,
      });

      expect(screen.getAllByRole('columnheader')[0]).toHaveAccessibleName(
        'دوشنبه',
      );
    });

    it('should mirror the navigation chevrons in RTL and keep their inline order', () => {
      document.documentElement.setAttribute('dir', 'rtl');
      renderDatePicker({ locale: 'fa-IR', plainDateString: '2026-09-28' });

      const previousButton = screen.getByRole('button', { name: 'Previous' });
      const nextButton = screen.getByRole('button', { name: 'Next' });

      expect(previousButton).toHaveClass(
        DATE_PICKER_NAVIGATION_BUTTON_CLASS_NAME,
      );
      expect(nextButton).toHaveClass(DATE_PICKER_NAVIGATION_BUTTON_CLASS_NAME);
      expect(
        previousButton.compareDocumentPosition(nextButton) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(screen.getAllByRole('columnheader')[0]).toHaveAccessibleName(
        'شنبه',
      );
    });
  });

  describe('en', () => {
    it('should keep the react-datepicker calendar', async () => {
      const { onChange, onClose } = renderDatePicker({
        locale: 'en',
        plainDateString: '2026-09-28',
        calendarStartDay: CalendarStartDay.SUNDAY,
      });

      const day = await findReactDatePickerDay(30);

      expect(screen.getByRole('dialog', { name: 'Choose Date' })).toHaveClass(
        'react-datepicker',
      );
      expect(screen.queryByRole('grid')).toBeNull();
      expect(screen.queryByLabelText('۶ مهر ۱۴۰۵')).toBeNull();

      fireEvent.click(day);

      expect(onChange).toHaveBeenCalledWith('2026-09-30');
      expect(onClose).toHaveBeenCalledWith('2026-09-30');
    });

    it('should keep Gregorian month navigation', async () => {
      const { onChange } = renderDatePicker({
        locale: 'en',
        plainDateString: '2026-01-31',
        calendarStartDay: CalendarStartDay.SUNDAY,
      });

      await findReactDatePickerDay(31);
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(onChange).toHaveBeenCalledWith('2026-02-28');
    });
  });
});
