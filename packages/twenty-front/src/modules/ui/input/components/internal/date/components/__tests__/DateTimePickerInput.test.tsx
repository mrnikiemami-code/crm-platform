import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as JotaiProvider } from 'jotai';
import { Temporal } from 'temporal-polyfill';

import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { DateFormat } from '@/localization/constants/DateFormat';
import { TimeFormat } from '@/localization/constants/TimeFormat';
import { workspaceMemberFormatPreferencesState } from '@/localization/states/workspaceMemberFormatPreferencesState';
import { DateTimePickerInput } from '@/ui/input/components/internal/date/components/DateTimePickerInput';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';

const RIGHT_TO_LEFT_MARK = '\u200F';

const renderDateTimePickerInput = ({
  locale,
  timeFormat,
  date = null,
  timeZone,
  dateFormat = locale === 'en' ? DateFormat.MONTH_FIRST : DateFormat.YEAR_FIRST,
}: {
  locale: string;
  timeFormat: TimeFormat;
  date?: Temporal.ZonedDateTime | null;
  timeZone?: string;
  dateFormat?: DateFormat;
}) => {
  jotaiStore.set(currentWorkspaceMemberState.atom, {
    locale,
    timeZone: 'Asia/Tehran',
  } as CurrentWorkspaceMember);
  jotaiStore.set(workspaceMemberFormatPreferencesState.atom, {
    ...jotaiStore.get(workspaceMemberFormatPreferencesState.atom),
    dateFormat,
    timeFormat,
  });

  const onChange = jest.fn();

  render(
    <JotaiProvider store={jotaiStore}>
      <DateTimePickerInput
        date={date}
        onChange={onChange}
        timeZone={timeZone}
      />
    </JotaiProvider>,
  );

  return { onChange, input: screen.getByRole('textbox') as HTMLInputElement };
};

const typeIntoMaskedInput = (input: HTMLInputElement, text: string) =>
  userEvent.type(input, text, {
    initialSelectionStart: 0,
    initialSelectionEnd: input.value.length,
  });

describe('DateTimePickerInput', () => {
  describe('fa-IR', () => {
    it('should display the value as a Jalali date in the user timezone', () => {
      // 2026-09-27T21:00Z is already 1405/07/06 00:30 in Tehran.
      const { input } = renderDateTimePickerInput({
        locale: 'fa-IR',
        timeFormat: TimeFormat.HOUR_24,
        date: Temporal.Instant.from('2026-09-27T21:00:00Z').toZonedDateTimeISO(
          'UTC',
        ),
      });

      expect(input.value).toBe('۱۴۰۵/۰۷/۰۶ ۰۰:۳۰');
    });

    it.each([
      [
        '2026-09-23T14:30:00+03:30[Asia/Tehran]',
        `۱۴۰۵/۰۷/۰۱ ۰۲:۳۰ ب.ظ.${RIGHT_TO_LEFT_MARK}`,
      ],
      [
        '2026-09-23T09:05:00+03:30[Asia/Tehran]',
        `۱۴۰۵/۰۷/۰۱ ۰۹:۰۵ ق.ظ.${RIGHT_TO_LEFT_MARK}`,
      ],
    ])(
      'should display an existing 12-hour value %s year-first with the Persian day period',
      (zonedDateTime, expected) => {
        const { input } = renderDateTimePickerInput({
          locale: 'fa-IR',
          timeFormat: TimeFormat.HOUR_12,
          dateFormat: DateFormat.DAY_FIRST,
          date: Temporal.ZonedDateTime.from(zonedDateTime),
        });

        expect(input.value).toBe(expected);
        expect(input).toHaveAttribute('dir', 'ltr');
      },
    );

    it('should display an existing 24-hour value year-first', () => {
      const { input } = renderDateTimePickerInput({
        locale: 'fa-IR',
        timeFormat: TimeFormat.HOUR_24,
        dateFormat: DateFormat.MONTH_FIRST,
        date: Temporal.ZonedDateTime.from(
          '2026-09-23T14:30:00+03:30[Asia/Tehran]',
        ),
      });

      expect(input.value).toBe('۱۴۰۵/۰۷/۰۱ ۱۴:۳۰');
    });

    it.each([
      ['ASCII', '140507061330'],
      ['Persian', '۱۴۰۵۰۷۰۶۱۳۳۰'],
      ['Arabic-Indic', '١٤٠٥٠٧٠٦١٣٣٠'],
    ])(
      'should emit a zoned date-time in the user timezone from %s digits',
      async (_, typedDigits) => {
        const { input, onChange } = renderDateTimePickerInput({
          locale: 'fa-IR',
          timeFormat: TimeFormat.HOUR_24,
        });

        await typeIntoMaskedInput(input, typedDigits);

        expect(input.value).toBe('۱۴۰۵/۰۷/۰۶ ۱۳:۳۰');
        expect(onChange).toHaveBeenCalledTimes(1);

        const emitted: Temporal.ZonedDateTime = onChange.mock.calls[0][0];

        expect(emitted.toString()).toBe(
          '2026-09-28T13:30:00+03:30[Asia/Tehran]',
        );
        expect(emitted.calendarId).toBe('iso8601');
      },
    );

    it('should keep the 12-hour time preference', async () => {
      const { input, onChange } = renderDateTimePickerInput({
        locale: 'fa-IR',
        timeFormat: TimeFormat.HOUR_12,
      });

      await typeIntoMaskedInput(input, '1405070601:30PM');

      expect(input.value).toBe(`۱۴۰۵/۰۷/۰۶ ۰۱:۳۰ ب.ظ.${RIGHT_TO_LEFT_MARK}`);
      expect(onChange.mock.calls[0][0].toString()).toBe(
        '2026-09-28T13:30:00+03:30[Asia/Tehran]',
      );
    });

    it('should let the explicit timezone take precedence over the user timezone', async () => {
      const { input, onChange } = renderDateTimePickerInput({
        locale: 'fa-IR',
        timeFormat: TimeFormat.HOUR_24,
        timeZone: 'Asia/Tokyo',
      });

      await typeIntoMaskedInput(input, '140507061330');

      expect(onChange.mock.calls[0][0].toString()).toBe(
        '2026-09-28T13:30:00+09:00[Asia/Tokyo]',
      );
    });

    it('should reject an impossible Jalali date without emitting', async () => {
      const { input, onChange } = renderDateTimePickerInput({
        locale: 'fa-IR',
        timeFormat: TimeFormat.HOUR_24,
      });

      await typeIntoMaskedInput(input, '140412301330');

      expect(onChange).not.toHaveBeenCalled();
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('en', () => {
    it('should keep the Gregorian mask and output', async () => {
      const { input, onChange } = renderDateTimePickerInput({
        locale: 'en',
        timeFormat: TimeFormat.HOUR_24,
      });

      await typeIntoMaskedInput(input, '092820261330');

      expect(input.value).toBe('09/28/2026 13:30');
      expect(onChange.mock.calls[0][0].toString()).toBe(
        '2026-09-28T13:30:00+03:30[Asia/Tehran]',
      );
    });
  });
});
