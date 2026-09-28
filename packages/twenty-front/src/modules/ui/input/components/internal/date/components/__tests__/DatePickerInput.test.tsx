import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as JotaiProvider } from 'jotai';

import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { DateFormat } from '@/localization/constants/DateFormat';
import { workspaceMemberFormatPreferencesState } from '@/localization/states/workspaceMemberFormatPreferencesState';
import { DatePickerInput } from '@/ui/input/components/internal/date/components/DatePickerInput';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';

const renderDatePickerInput = ({
  locale,
  dateFormat,
  date = null,
}: {
  locale: string;
  dateFormat: DateFormat;
  date?: string | null;
}) => {
  jotaiStore.set(currentWorkspaceMemberState.atom, {
    locale,
  } as CurrentWorkspaceMember);
  jotaiStore.set(workspaceMemberFormatPreferencesState.atom, {
    ...jotaiStore.get(workspaceMemberFormatPreferencesState.atom),
    dateFormat,
  });

  const onChange = jest.fn();

  render(
    <JotaiProvider store={jotaiStore}>
      <DatePickerInput date={date} onChange={onChange} />
    </JotaiProvider>,
  );

  return { onChange, input: screen.getByRole('textbox') as HTMLInputElement };
};

const typeIntoMaskedInput = (input: HTMLInputElement, text: string) =>
  userEvent.type(input, text, {
    initialSelectionStart: 0,
    initialSelectionEnd: input.value.length,
  });

describe('DatePickerInput', () => {
  describe('fa-IR', () => {
    it('should display the value as a Jalali date', () => {
      const { input } = renderDatePickerInput({
        locale: 'fa-IR',
        dateFormat: DateFormat.YEAR_FIRST,
        date: '2026-09-28',
      });

      expect(input.value).toBe('1405/07/06');
      expect(input).toHaveAttribute('dir', 'ltr');
    });

    it.each([
      ['ASCII', '14050706'],
      ['Persian', '۱۴۰۵۰۷۰۶'],
      ['Arabic-Indic', '١٤٠٥٠٧٠٦'],
    ])('should accept %s digits', async (_, typedDigits) => {
      const { input, onChange } = renderDatePickerInput({
        locale: 'fa-IR',
        dateFormat: DateFormat.YEAR_FIRST,
      });

      await typeIntoMaskedInput(input, typedDigits);

      expect(input.value).toBe('1405/07/06');
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('2026-09-28');
    });

    it('should follow the day-first input order', async () => {
      const { input, onChange } = renderDatePickerInput({
        locale: 'fa-IR',
        dateFormat: DateFormat.DAY_FIRST,
      });

      await typeIntoMaskedInput(input, '01011405');

      expect(onChange).toHaveBeenCalledWith('2026-03-21');
    });

    it('should accept 30 Esfand in a leap year', async () => {
      const { input, onChange } = renderDatePickerInput({
        locale: 'fa-IR',
        dateFormat: DateFormat.YEAR_FIRST,
      });

      await typeIntoMaskedInput(input, '14031230');

      expect(onChange).toHaveBeenCalledWith('2025-03-20');
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('should reject 30 Esfand in a common year without emitting', async () => {
      const { input, onChange } = renderDatePickerInput({
        locale: 'fa-IR',
        dateFormat: DateFormat.YEAR_FIRST,
      });

      await typeIntoMaskedInput(input, '14041230');

      expect(onChange).not.toHaveBeenCalled();
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should reject a day that does not exist in the month', async () => {
      const { input, onChange } = renderDatePickerInput({
        locale: 'fa-IR',
        dateFormat: DateFormat.YEAR_FIRST,
      });

      await typeIntoMaskedInput(input, '14050731');

      expect(onChange).not.toHaveBeenCalled();
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should clear the error once the value is edited', async () => {
      const { input, onChange } = renderDatePickerInput({
        locale: 'fa-IR',
        dateFormat: DateFormat.YEAR_FIRST,
      });

      await typeIntoMaskedInput(input, '14041230');
      await typeIntoMaskedInput(input, '14041229');

      expect(input).not.toHaveAttribute('aria-invalid');
      expect(onChange).toHaveBeenCalledWith('2026-03-20');
    });

    it('should not accept month 13', async () => {
      const { input, onChange } = renderDatePickerInput({
        locale: 'fa-IR',
        dateFormat: DateFormat.YEAR_FIRST,
      });

      await typeIntoMaskedInput(input, '140513');

      expect(input.value).not.toContain('/13');
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('en', () => {
    it('should keep the Gregorian mask and output', async () => {
      const { input, onChange } = renderDatePickerInput({
        locale: 'en',
        dateFormat: DateFormat.MONTH_FIRST,
      });

      await typeIntoMaskedInput(input, '09282026');

      expect(input.value).toBe('09/28/2026');
      expect(input).not.toHaveAttribute('dir');
      expect(onChange).toHaveBeenCalledWith('2026-09-28');
    });
  });
});
