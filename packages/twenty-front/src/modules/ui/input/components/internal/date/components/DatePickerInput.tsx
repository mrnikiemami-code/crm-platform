import { styled } from '@linaria/react';
import { useCallback, useEffect, useState } from 'react';
import { useIMask } from 'react-imask';

import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { formatJalaliDateInputString } from '@/localization/utils/jalali/formatJalaliDateInputString';
import { normalizeLocalizedDigitsToAscii } from '@/localization/utils/jalali/normalizeLocalizedDigitsToAscii';
import { parseJalaliDateInputString } from '@/localization/utils/jalali/parseJalaliDateInputString';
import { DATE_BLOCKS } from '@/ui/input/components/internal/date/constants/DateBlocks';
import { JALALI_DATE_BLOCKS } from '@/ui/input/components/internal/date/constants/JalaliDateBlocks';
import { MAX_DATE } from '@/ui/input/components/internal/date/constants/MaxDate';
import { MIN_DATE } from '@/ui/input/components/internal/date/constants/MinDate';
import { useParseDateInputStringToJSDate } from '@/ui/input/components/internal/date/hooks/useParseDateInputStringToJSDate';
import { useParsePlainDateToDateInputString } from '@/ui/input/components/internal/date/hooks/useParsePlainDateToDateInputString';
import { getDateMask } from '@/ui/input/components/internal/date/utils/getDateMask';
import { getJalaliDateMask } from '@/ui/input/components/internal/date/utils/getJalaliDateMask';
import { isPlainDateWithinDatePickerRange } from '@/ui/input/components/internal/date/utils/isPlainDateWithinDatePickerRange';
import { type FormFieldInputVariant } from '@/ui/input/types/FormFieldInputVariant';

import { useParseDateInputStringToPlainDate } from '@/ui/input/components/internal/date/hooks/useParseDateInputStringToPlainDate';
import { useParseJSDateToIMaskDateInputString } from '@/ui/input/components/internal/date/hooks/useParseJSDateToIMaskDateInputString';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledInputContainer = styled.div<{
  $variant: FormFieldInputVariant;
}>`
  align-items: center;
  border-bottom: ${({ $variant }) =>
    $variant === 'transparent'
      ? 'none'
      : `1px solid ${themeCssVariables.border.color.light}`};
  border-top-left-radius: ${themeCssVariables.border.radius.md};
  border-top-right-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  height: ${({ $variant }) =>
    $variant === 'transparent'
      ? themeCssVariables.spacing[6]
      : themeCssVariables.spacing[8]};
  width: 100%;
`;

const StyledInput = styled.input<{
  hasError?: boolean;
  $variant: FormFieldInputVariant;
}>`
  background: transparent;
  border: none;
  color: ${({ hasError }) =>
    hasError
      ? themeCssVariables.color.red
      : themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${({ $variant }) =>
    $variant === 'transparent' ? themeCssVariables.font.weight.regular : 500};
  outline: none;
  padding: ${({ $variant }) => ($variant === 'transparent' ? '0' : '4px 8px')};
  width: 100%;
`;

type DatePickerInputProps = {
  onChange?: (date: string | null) => void;
  date: string | null;
  readonly?: boolean;
  variant?: FormFieldInputVariant;
};

export const DatePickerInput = ({
  date,
  onChange,
  readonly = false,
  variant = 'default',
}: DatePickerInputProps) => {
  const { dateFormat, calendar } = useDateTimeFormat();
  const isPersianCalendar = calendar === 'persian';

  const [internalDate, setInternalDate] = useState(date);
  const [hasInvalidJalaliDate, setHasInvalidJalaliDate] = useState(false);

  const { parseDateInputStringToPlainDate } =
    useParseDateInputStringToPlainDate();
  const { parseDateInputStringToJSDate } = useParseDateInputStringToJSDate();
  const { parsePlainDateToDateInputString } =
    useParsePlainDateToDateInputString();

  const { parseIMaskJSDateIMaskDateInputString } =
    useParseJSDateToIMaskDateInputString();

  const parseIMaskDateInputStringToJSDate = (newDateAsString: string) => {
    const newDate = parseDateInputStringToJSDate(newDateAsString);

    return newDate;
  };

  const pattern = getDateMask(dateFormat);
  const blocks = DATE_BLOCKS;

  const formatPlainDateForInput = useCallback(
    (plainDate: string) =>
      isPersianCalendar
        ? formatJalaliDateInputString({ isoPlainDate: plainDate, dateFormat })
        : parsePlainDateToDateInputString(plainDate),
    [isPersianCalendar, dateFormat, parsePlainDateToDateInputString],
  );

  const defaultValue = internalDate
    ? (formatPlainDateForInput(internalDate) ?? undefined)
    : undefined;

  // IMask's Date mask validates gregorian month lengths, so the persian
  // calendar uses numeric blocks and validates the complete Jalali date
  // itself. Localized digits are typed in as ASCII.
  const { ref, setValue, value } = useIMask(
    isPersianCalendar
      ? {
          mask: getJalaliDateMask(dateFormat),
          blocks: JALALI_DATE_BLOCKS,
          prepareChar: normalizeLocalizedDigitsToAscii,
          lazy: false,
          autofix: false,
        }
      : {
          mask: Date,
          pattern,
          blocks,
          min: MIN_DATE,
          max: MAX_DATE,
          format: (date: any) =>
            isDefined(date) ? parseIMaskJSDateIMaskDateInputString(date) : '',
          parse: parseIMaskDateInputStringToJSDate,
          lazy: false,
          autofix: true,
        },
    {
      defaultValue,
      onAccept: () => {
        setHasInvalidJalaliDate(false);
      },
      onComplete: (newValue) => {
        if (isPersianCalendar) {
          const parsedPlainDate = parseJalaliDateInputString({
            value: newValue,
            dateFormat,
          });

          if (
            !isDefined(parsedPlainDate) ||
            !isPlainDateWithinDatePickerRange(parsedPlainDate)
          ) {
            setHasInvalidJalaliDate(true);
            return;
          }

          onChange?.(parsedPlainDate);
          return;
        }

        const parsedDate = parseDateInputStringToPlainDate(newValue);

        onChange?.(parsedDate);
      },
    },
  );

  useEffect(() => {
    if (internalDate !== date) {
      setInternalDate(date);
      if (isDefined(date)) {
        setValue(formatPlainDateForInput(date));
      } else {
        setValue('');
      }
    }
  }, [date, internalDate, formatPlainDateForInput, setValue]);

  return (
    <StyledInputContainer $variant={variant}>
      <StyledInput
        $variant={variant}
        hasError={hasInvalidJalaliDate}
        aria-invalid={hasInvalidJalaliDate || undefined}
        dir={isPersianCalendar ? 'ltr' : undefined}
        type="text"
        disabled={readonly}
        ref={ref as any}
        value={value}
        onChange={() => {}} // Prevent React warning
      />
    </StyledInputContainer>
  );
};
