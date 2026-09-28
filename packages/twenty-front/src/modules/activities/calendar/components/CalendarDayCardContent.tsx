import { styled } from '@linaria/react';
import { differenceInSeconds, endOfDay, format } from 'date-fns';

import { CalendarEventRow } from '@/activities/calendar/components/CalendarEventRow';
import { getCalendarEventStartDate } from '@/activities/calendar/utils/getCalendarEventStartDate';
import { useDateDisplayContext } from '@/localization/hooks/useDateDisplayContext';
import { formatDateTimeForAppLocale } from '@/localization/utils/formatDateTimeForAppLocale';
import { CardContent } from 'twenty-ui/primitives/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { type TimelineCalendarEvent } from '~/generated/graphql';

type CalendarDayCardContentProps = {
  calendarEvents: TimelineCalendarEvent[];
  divider?: boolean;
};

const StyledCardContentContainer = styled.div`
  > div {
    align-items: flex-start;
    display: flex;
    flex-direction: row;
    gap: ${themeCssVariables.spacing[3]};
    padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  }
`;

const StyledDayCardContent = styled(CardContent)`
  @keyframes calendarDayEnded {
    to {
      background-color: ${themeCssVariables.background.primary};
    }
  }

  animation: calendarDayEnded calc(var(--t-animation-duration-fast) * 1s) ease
    forwards;
`;

const StyledDayContainer = styled.div`
  text-align: center;
  width: ${themeCssVariables.spacing[6]};
`;

const StyledWeekDay = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xxs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledMonthDay = styled.div`
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledEvents = styled.div`
  align-items: stretch;
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledEventRowContainer = styled.div`
  flex: 1 0 auto;
`;

export const CalendarDayCardContent = ({
  calendarEvents,
  divider,
}: CalendarDayCardContentProps) => {
  const { locale, calendar } = useDateDisplayContext();
  const endOfDayDate = endOfDay(getCalendarEventStartDate(calendarEvents[0]));
  const dayEndsIn = differenceInSeconds(endOfDayDate, Date.now());

  const weekDayLabel =
    calendar === 'persian'
      ? formatDateTimeForAppLocale({
          date: endOfDayDate,
          locale,
          options: { weekday: 'short' },
        })
      : format(endOfDayDate, 'EE');
  const monthDayLabel =
    calendar === 'persian'
      ? formatDateTimeForAppLocale({
          date: endOfDayDate,
          locale,
          options: { day: '2-digit' },
        })
      : format(endOfDayDate, 'dd');

  return (
    <StyledCardContentContainer>
      <StyledDayCardContent
        divider={divider}
        style={{ animationDelay: `${Math.max(0, dayEndsIn)}s` }}
      >
        <StyledDayContainer>
          <StyledWeekDay>{weekDayLabel}</StyledWeekDay>
          <StyledMonthDay>{monthDayLabel}</StyledMonthDay>
        </StyledDayContainer>
        <StyledEvents>
          {calendarEvents.map((calendarEvent) => (
            <StyledEventRowContainer key={calendarEvent.id}>
              <CalendarEventRow calendarEvent={calendarEvent} />
            </StyledEventRowContainer>
          ))}
        </StyledEvents>
      </StyledDayCardContent>
    </StyledCardContentContainer>
  );
};
