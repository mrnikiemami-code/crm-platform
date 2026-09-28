import { styled } from '@linaria/react';
import { type ReactNode, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import {
  isDefined,
  turnPlainDateToShiftedDateInSystemTimeZone,
} from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { DateFormat } from '@/localization/constants/DateFormat';
import { PERSIAN_CALENDAR_INTL_LOCALE } from '@/localization/constants/PersianCalendarIntlLocale';
import { formatPlainDateISOString } from '@/localization/utils/formatPlainDateISOString';
import { turnISOPlainDateIntoPersianPlainDate } from '@/localization/utils/jalali/turnISOPlainDateIntoPersianPlainDate';
import { turnPersianPlainDateIntoISOPlainDate } from '@/localization/utils/jalali/turnPersianPlainDateIntoISOPlainDate';
import { getJalaliCalendarWeeks } from '@/ui/input/components/internal/date/utils/getJalaliCalendarWeeks';
import { getJalaliWeekDayNames } from '@/ui/input/components/internal/date/utils/getJalaliWeekDayNames';

// Used only without a user start day: the persian week starts on Saturday.
const DEFAULT_PERSIAN_CALENDAR_START_DAY = 6;

const StyledCalendar = styled.div<{ isDisabled: boolean }>`
  opacity: ${({ isDisabled }) => (isDisabled ? '0.5' : '1')};
  pointer-events: ${({ isDisabled }) => (isDisabled ? 'none' : 'auto')};
`;

const StyledWeek = styled.div`
  display: flex;
  justify-content: center;
`;

const StyledWeekDayName = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  height: 40px;
  line-height: 40px;
  margin: 2px;
  text-align: center;
  width: 34px;
`;

const StyledDay = styled.div<{
  isHighlighted: boolean;
  isOutsideMonth: boolean;
  isToday: boolean;
}>`
  background-color: ${({ isHighlighted }) =>
    isHighlighted ? themeCssVariables.color.blue : 'transparent'};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${({ isHighlighted, isOutsideMonth }) =>
    isHighlighted
      ? themeCssVariables.background.primary
      : isOutsideMonth
        ? themeCssVariables.font.color.tertiary
        : themeCssVariables.font.color.primary};
  cursor: pointer;
  font-weight: ${({ isToday }) =>
    isToday
      ? themeCssVariables.font.weight.semiBold
      : themeCssVariables.font.weight.regular};
  height: 34px;
  line-height: 34px;
  margin: 2px;
  text-align: center;
  width: 34px;

  &:hover {
    background-color: ${({ isHighlighted }) =>
      isHighlighted
        ? themeCssVariables.color.blue
        : themeCssVariables.background.transparent.light};
  }
`;

type JalaliDatePickerCalendarProps = {
  anchorPlainDate: Temporal.PlainDate;
  selectedPlainDate?: Temporal.PlainDate | null;
  rangeStartPlainDate?: Temporal.PlainDate | null;
  rangeEndPlainDate?: Temporal.PlainDate | null;
  todayPlainDate: Temporal.PlainDate;
  calendarStartDay?: number;
  disabled?: boolean;
  onDaySelect: (plainDate: Temporal.PlainDate) => void;
  renderHeader: (navigation: {
    monthDate: Date;
    decreaseMonth: () => void;
    increaseMonth: () => void;
    prevMonthButtonDisabled: boolean;
    nextMonthButtonDisabled: boolean;
  }) => ReactNode;
};

export const JalaliDatePickerCalendar = ({
  anchorPlainDate,
  selectedPlainDate,
  rangeStartPlainDate,
  rangeEndPlainDate,
  todayPlainDate,
  calendarStartDay = DEFAULT_PERSIAN_CALENDAR_START_DAY,
  disabled = false,
  onDaySelect,
  renderHeader,
}: JalaliDatePickerCalendarProps) => {
  const anchorPersianPlainDate =
    turnISOPlainDateIntoPersianPlainDate(anchorPlainDate);
  const anchorMonthKey = `${anchorPersianPlainDate.year}-${anchorPersianPlainDate.month}`;

  // Like react-datepicker, browsing months only moves the view; the view
  // snaps back to the anchor month whenever the anchor changes.
  const [monthOffset, setMonthOffset] = useState({
    anchorMonthKey,
    offset: 0,
  });

  const currentMonthOffset =
    monthOffset.anchorMonthKey === anchorMonthKey ? monthOffset.offset : 0;

  const displayedMonthFirstDay = anchorPersianPlainDate
    .with({ day: 1 })
    .add({ months: currentMonthOffset });

  const moveDisplayedMonth = (monthDelta: number) =>
    setMonthOffset({
      anchorMonthKey,
      offset: currentMonthOffset + monthDelta,
    });

  const weeks = getJalaliCalendarWeeks({
    year: displayedMonthFirstDay.year,
    month: displayedMonthFirstDay.month,
    calendarStartDay,
  });

  const weekDayNames = getJalaliWeekDayNames(calendarStartDay);

  const dayOfMonthFormatter = new Intl.NumberFormat(
    PERSIAN_CALENDAR_INTL_LOCALE,
  );

  const isWithinRange = (plainDate: Temporal.PlainDate) =>
    isDefined(rangeStartPlainDate) &&
    isDefined(rangeEndPlainDate) &&
    Temporal.PlainDate.compare(plainDate, rangeStartPlainDate) >= 0 &&
    Temporal.PlainDate.compare(plainDate, rangeEndPlainDate) <= 0;

  return (
    <>
      {renderHeader({
        monthDate: turnPlainDateToShiftedDateInSystemTimeZone(
          turnPersianPlainDateIntoISOPlainDate(displayedMonthFirstDay),
        ),
        decreaseMonth: () => moveDisplayedMonth(-1),
        increaseMonth: () => moveDisplayedMonth(1),
        prevMonthButtonDisabled: false,
        nextMonthButtonDisabled: false,
      })}
      <StyledCalendar
        role="grid"
        isDisabled={disabled}
        aria-disabled={disabled}
      >
        <StyledWeek role="row">
          {weekDayNames.map(({ narrowName, longName }) => (
            <StyledWeekDayName
              key={longName}
              role="columnheader"
              aria-label={longName}
            >
              {narrowName}
            </StyledWeekDayName>
          ))}
        </StyledWeek>
        {weeks.map((week) => (
          <StyledWeek key={week[0].isoPlainDate} role="row">
            {week.map((day) => {
              const dayPlainDate = Temporal.PlainDate.from(day.isoPlainDate);
              const isSelected =
                isDefined(selectedPlainDate) &&
                dayPlainDate.equals(selectedPlainDate);
              const isToday = dayPlainDate.equals(todayPlainDate);

              return (
                <StyledDay
                  key={day.isoPlainDate}
                  role="gridcell"
                  aria-label={formatPlainDateISOString({
                    date: day.isoPlainDate,
                    dateFormat: DateFormat.DAY_FIRST,
                    calendar: 'persian',
                  })}
                  aria-selected={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  isHighlighted={isSelected || isWithinRange(dayPlainDate)}
                  isOutsideMonth={day.isOutsideMonth}
                  isToday={isToday}
                  onClick={
                    disabled ? undefined : () => onDaySelect(dayPlainDate)
                  }
                >
                  {dayOfMonthFormatter.format(day.dayOfMonth)}
                </StyledDay>
              );
            })}
          </StyledWeek>
        ))}
      </StyledCalendar>
    </>
  );
};
