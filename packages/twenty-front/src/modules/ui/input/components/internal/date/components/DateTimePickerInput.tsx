import { styled } from '@linaria/react';
import { useIMask } from 'react-imask';

import { useDateTimeFormat } from '@/localization/hooks/useDateTimeFormat';
import { formatJalaliDateInputString } from '@/localization/utils/jalali/formatJalaliDateInputString';
import { normalizeLocalizedDigitsToAscii } from '@/localization/utils/jalali/normalizeLocalizedDigitsToAscii';
import { parseJalaliDateInputString } from '@/localization/utils/jalali/parseJalaliDateInputString';
import { DATE_BLOCKS } from '@/ui/input/components/internal/date/constants/DateBlocks';
import { JALALI_DATE_BLOCKS } from '@/ui/input/components/internal/date/constants/JalaliDateBlocks';
import { MAX_DATE } from '@/ui/input/components/internal/date/constants/MaxDate';
import { MIN_DATE } from '@/ui/input/components/internal/date/constants/MinDate';
import { useTimeInput } from '@/ui/input/components/internal/date/hooks/useTimeInput';
import { getDateTimeMask } from '@/ui/input/components/internal/date/utils/getDateTimeMask';
import { getJalaliDateMask } from '@/ui/input/components/internal/date/utils/getJalaliDateMask';
import { getTimeBlocks } from '@/ui/input/components/internal/date/utils/getTimeBlocks';
import { getTimeMask } from '@/ui/input/components/internal/date/utils/getTimeMask';
import { isPlainDateWithinDatePickerRange } from '@/ui/input/components/internal/date/utils/isPlainDateWithinDatePickerRange';
import { type FormFieldInputVariant } from '@/ui/input/types/FormFieldInputVariant';

import { TimeZoneAbbreviation } from '@/ui/input/components/internal/date/components/TimeZoneAbbreviation';
import { useGetShiftedDateToCustomTimeZone } from '@/ui/input/components/internal/date/hooks/useGetShiftedDateToCustomTimeZone';
import { useGetShiftedDateToSystemTimeZone } from '@/ui/input/components/internal/date/hooks/useGetShiftedDateToSystemTimeZone';
import { useParseDateTimeInputStringToJSDate } from '@/ui/input/components/internal/date/hooks/useParseDateTimeInputStringToJSDate';
import { useParseJSDateToIMaskDateTimeInputString } from '@/ui/input/components/internal/date/hooks/useParseJSDateToIMaskDateTimeInputString';
import { useUserTimezone } from '@/ui/input/components/internal/date/hooks/useUserTimezone';
import { useCallback, useEffect, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { isDifferentZonedDateTime } from '~/utils/dates/isDifferentZonedDateTime';

const StyledInputContainer = styled.div<{
  $variant: FormFieldInputVariant;
}>`
  align-items: center;

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
  padding-inline-start: ${({ $variant }) =>
    $variant === 'transparent' ? '0' : themeCssVariables.spacing[2]};
  width: 140px;
`;

type DateTimePickerInputProps = {
  onChange?: (date: Temporal.ZonedDateTime | null) => void;
  date: Temporal.ZonedDateTime | null;
  onFocus?: () => void;
  readonly?: boolean;
  timeZone?: string;
  variant?: FormFieldInputVariant;
};

export const DateTimePickerInput = ({
  date,
  onChange,
  onFocus,
  readonly,
  timeZone,
  variant = 'default',
}: DateTimePickerInputProps) => {
  const [internalDate, setInternalDate] = useState(date);

  const { userTimezone } = useUserTimezone();

  const { dateFormat, timeFormat, calendar } = useDateTimeFormat();
  const isPersianCalendar = calendar === 'persian';
  const [hasInvalidJalaliDate, setHasInvalidJalaliDate] = useState(false);
  const { formatTime, parseTime } = useTimeInput(timeFormat);

  const { getShiftedDateToSystemTimeZone } =
    useGetShiftedDateToSystemTimeZone();

  const { getShiftedDateToCustomTimeZone } =
    useGetShiftedDateToCustomTimeZone();

  const { parseDateTimeInputStringToJSDate } =
    useParseDateTimeInputStringToJSDate();
  const { parseJSDateToDateTimeInputString } =
    useParseJSDateToIMaskDateTimeInputString();

  const handleParseStringToDate = (newDateAsString: string) => {
    const date = parseDateTimeInputStringToJSDate(newDateAsString);

    return date;
  };

  const pattern = getDateTimeMask({ dateFormat, timeFormat });

  const blocks = { ...DATE_BLOCKS, ...getTimeBlocks(timeFormat) };

  const defaultValueForIMask = isDefined(internalDate)
    ? new Date(internalDate?.toInstant().toString())
    : null;

  const shiftedIMaskDate = isDefined(defaultValueForIMask)
    ? getShiftedDateToSystemTimeZone(
        defaultValueForIMask,
        timeZone ?? userTimezone,
      )
    : null;

  const formatZonedDateTimeForJalaliInput = useCallback(
    (zonedDateTime: Temporal.ZonedDateTime) => {
      const zonedDateTimeInTimeZone = zonedDateTime.withTimeZone(
        timeZone ?? userTimezone,
      );

      return `${formatJalaliDateInputString({
        isoPlainDate: zonedDateTimeInTimeZone.toPlainDate(),
        dateFormat,
      })} ${formatTime(zonedDateTimeInTimeZone.hour, zonedDateTimeInTimeZone.minute)}`;
    },
    [timeZone, userTimezone, dateFormat, formatTime],
  );

  const parseJalaliDateTimeInputString = (value: string) => {
    const [datePart, ...timeParts] = value.split(' ');
    const isoPlainDate = parseJalaliDateInputString({
      value: datePart,
      dateFormat,
    });
    const time = parseTime(timeParts.join(' '));

    if (
      !isDefined(isoPlainDate) ||
      !isDefined(time) ||
      !isPlainDateWithinDatePickerRange(isoPlainDate)
    ) {
      return null;
    }

    return Temporal.PlainDate.from(isoPlainDate)
      .toPlainDateTime({ hour: time.hour, minute: time.minute })
      .toZonedDateTime(timeZone ?? userTimezone);
  };

  // See DatePickerInput: numeric Jalali blocks instead of IMask's Date mask.
  const { ref, setValue } = useIMask(
    isPersianCalendar
      ? {
          mask: `${getJalaliDateMask(dateFormat)} ${getTimeMask(timeFormat)}`,
          blocks: { ...JALALI_DATE_BLOCKS, ...getTimeBlocks(timeFormat) },
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
          format: (date: any) => parseJSDateToDateTimeInputString(date),
          parse: handleParseStringToDate,
          lazy: false,
          autofix: false,
        },
    {
      defaultValue:
        isPersianCalendar && isDefined(internalDate)
          ? formatZonedDateTimeForJalaliInput(internalDate)
          : isDefined(shiftedIMaskDate)
            ? parseJSDateToDateTimeInputString(shiftedIMaskDate)
            : undefined,
      onAccept: () => {
        setHasInvalidJalaliDate(false);
      },
      onComplete: (value) => {
        if (isPersianCalendar) {
          const zonedDateTime = parseJalaliDateTimeInputString(value);

          if (!isDefined(zonedDateTime)) {
            setHasInvalidJalaliDate(true);
            return;
          }

          setInternalDate(date);

          onChange?.(zonedDateTime);
          return;
        }

        const parsedDate = parseDateTimeInputStringToJSDate(value);

        if (!isDefined(parsedDate)) {
          return;
        }

        const pointInTime = getShiftedDateToCustomTimeZone(
          parsedDate,
          timeZone ?? userTimezone,
        );

        setInternalDate(date);

        const zonedDateTime = Temporal.Instant.from(
          pointInTime.toISOString(),
        ).toZonedDateTimeISO(timeZone ?? userTimezone);

        onChange?.(zonedDateTime);
      },
    },
  );

  useEffect(() => {
    if (isDifferentZonedDateTime(internalDate, date)) {
      setInternalDate(date);

      if (!isDefined(date)) {
        setValue('');
        return;
      }

      if (isPersianCalendar) {
        setValue(formatZonedDateTimeForJalaliInput(date));
        return;
      }

      const newDateAsDate = new Date(date.toInstant().toString());

      const newShiftedDate = getShiftedDateToSystemTimeZone(
        newDateAsDate,
        timeZone ?? userTimezone,
      );

      setValue(parseJSDateToDateTimeInputString(newShiftedDate));
    }
  }, [
    date,
    internalDate,
    isPersianCalendar,
    formatZonedDateTimeForJalaliInput,
    parseJSDateToDateTimeInputString,
    setValue,
    shiftedIMaskDate,
    timeZone,
    getShiftedDateToSystemTimeZone,
    userTimezone,
  ]);

  const shouldDisplayReadOnly = readonly === true;

  const internalDateForTimeZoneAbbreviation =
    internalDate?.toInstant() ?? Temporal.Now.instant();

  return (
    <StyledInputContainer $variant={variant}>
      <StyledInput
        $variant={variant}
        disabled={shouldDisplayReadOnly}
        hasError={hasInvalidJalaliDate}
        aria-invalid={hasInvalidJalaliDate || undefined}
        dir={isPersianCalendar ? 'ltr' : undefined}
        type="text"
        ref={ref as any}
        onFocus={!shouldDisplayReadOnly ? onFocus : undefined}
      />
      <TimeZoneAbbreviation
        instant={internalDateForTimeZoneAbbreviation}
        timeZone={timeZone ?? userTimezone}
      />
    </StyledInputContainer>
  );
};
