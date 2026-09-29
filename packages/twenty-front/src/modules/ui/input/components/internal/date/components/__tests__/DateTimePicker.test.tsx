import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as JotaiProvider } from 'jotai';
import { Temporal } from 'temporal-polyfill';

import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { workspaceMemberFormatPreferencesState } from '@/localization/states/workspaceMemberFormatPreferencesState';
import { DateTimePicker } from '@/ui/input/components/internal/date/components/DateTimePicker';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { CalendarStartDay } from 'twenty-shared/constants';

const renderDateTimePicker = ({
  locale,
  date,
  timeZone,
}: {
  locale: string;
  date: Temporal.ZonedDateTime;
  timeZone?: string;
}) => {
  jotaiStore.set(currentWorkspaceMemberState.atom, {
    locale,
    timeZone: 'Asia/Tehran',
    calendarStartDay: CalendarStartDay.SATURDAY,
  } as CurrentWorkspaceMember);
  jotaiStore.set(workspaceMemberFormatPreferencesState.atom, {
    ...jotaiStore.get(workspaceMemberFormatPreferencesState.atom),
    timeFormat: TimeFormat.HOUR_24,
  });

  const onChange = jest.fn();
  const onClose = jest.fn();

  render(
    <JotaiProvider store={jotaiStore}>
      <DateTimePicker
        instanceId="date-time-picker-test"
        date={date}
        onChange={onChange}
        onClose={onClose}
        timeZone={timeZone}
        hideHeaderInput
      />
    </JotaiProvider>,
  );

  return { onChange, onClose };
};

const TEHRAN_DATE_TIME = Temporal.ZonedDateTime.from(
  '2026-09-28T13:30:00+03:30[Asia/Tehran]',
);

describe('DateTimePicker', () => {
  describe('fa-IR', () => {
    it('should keep the time and timezone of the value when picking a Jalali day', () => {
      const { onChange, onClose } = renderDateTimePicker({
        locale: 'fa-IR',
        date: TEHRAN_DATE_TIME,
      });

      fireEvent.click(screen.getByRole('gridcell', { name: '۱۰ مهر ۱۴۰۵' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);

      const emitted: Temporal.ZonedDateTime = onClose.mock.calls[0][0];

      expect(emitted.toString()).toBe('2026-10-02T13:30:00+03:30[Asia/Tehran]');
      expect(emitted.calendarId).toBe('iso8601');
    });

    it('should select the day of the value in the user timezone and round trip it', () => {
      // 00:30 in Tehran is still the previous day in UTC (the Jest timezone).
      const date = Temporal.ZonedDateTime.from(
        '2026-09-28T00:30:00+03:30[Asia/Tehran]',
      );
      const { onChange, onClose } = renderDateTimePicker({
        locale: 'fa-IR',
        date,
      });

      const selectedDay = screen.getByRole('gridcell', { selected: true });

      expect(selectedDay).toHaveAccessibleName('۶ مهر ۱۴۰۵');

      fireEvent.click(selectedDay);

      expect(onChange).not.toHaveBeenCalled();
      expect(onClose.mock.calls[0][0].toString()).toBe(date.toString());
    });

    it('should let the explicit timezone take precedence over the user timezone', () => {
      const date = Temporal.ZonedDateTime.from(
        '2026-09-28T01:00:00+09:00[Asia/Tokyo]',
      );
      const { onClose } = renderDateTimePicker({
        locale: 'fa-IR',
        date,
        timeZone: 'Asia/Tokyo',
      });

      const selectedDay = screen.getByRole('gridcell', { selected: true });

      expect(selectedDay).toHaveAccessibleName('۶ مهر ۱۴۰۵');

      fireEvent.click(selectedDay);

      expect(onClose.mock.calls[0][0].toString()).toBe(date.toString());
    });

    it('should navigate months in the persian calendar without leaking it', () => {
      // 1404/12/14 13:30 -> 1405/01/14 13:30.
      const { onChange } = renderDateTimePicker({
        locale: 'fa-IR',
        date: Temporal.ZonedDateTime.from(
          '2026-03-05T13:30:00+03:30[Asia/Tehran]',
        ),
      });

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      const emitted: Temporal.ZonedDateTime = onChange.mock.calls[0][0];

      expect(emitted.toString()).toBe('2026-04-03T13:30:00+03:30[Asia/Tehran]');
      expect(emitted.calendarId).toBe('iso8601');
    });

    it('should navigate from Farvardin back to Esfand', () => {
      const { onChange } = renderDateTimePicker({
        locale: 'fa-IR',
        date: Temporal.ZonedDateTime.from(
          '2026-03-21T13:30:00+03:30[Asia/Tehran]',
        ),
      });

      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

      expect(onChange.mock.calls[0][0].toString()).toBe(
        '2026-02-20T13:30:00+03:30[Asia/Tehran]',
      );
    });

    it('should accept Persian digits in the time input', async () => {
      const { onChange } = renderDateTimePicker({
        locale: 'fa-IR',
        date: TEHRAN_DATE_TIME,
      });

      const timeInput = screen.getByPlaceholderText(
        'HH:mm',
      ) as HTMLInputElement;

      expect(timeInput.value).toBe('۱۳:۳۰');

      await userEvent.type(timeInput, '۰۹۱۵', {
        initialSelectionStart: 0,
        initialSelectionEnd: timeInput.value.length,
      });

      expect(timeInput.value).toBe('۰۹:۱۵');
      expect(onChange.mock.calls.at(-1)?.[0].toString()).toBe(
        '2026-09-28T09:15:00+03:30[Asia/Tehran]',
      );
    });
  });

  describe('en', () => {
    it('should keep the react-datepicker calendar', async () => {
      renderDateTimePicker({ locale: 'en', date: TEHRAN_DATE_TIME });

      expect(
        await screen.findByRole('dialog', { name: 'Choose Date' }),
      ).toHaveClass('react-datepicker');
      expect(screen.queryByRole('grid')).toBeNull();
    });

    it('should keep Gregorian month navigation', async () => {
      const { onChange } = renderDateTimePicker({
        locale: 'en',
        date: Temporal.ZonedDateTime.from(
          '2026-01-31T13:30:00+03:30[Asia/Tehran]',
        ),
      });

      await screen.findByRole('dialog', { name: 'Choose Date' });
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(onChange.mock.calls[0][0].toString()).toBe(
        '2026-02-28T13:30:00+03:30[Asia/Tehran]',
      );
    });
  });
});
