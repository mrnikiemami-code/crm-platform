import { CalendarMonthCard } from '@/activities/calendar/components/CalendarMonthCard';
import { CalendarContext } from '@/activities/calendar/contexts/CalendarContext';
import { useCalendarEvents } from '@/activities/calendar/hooks/useCalendarEvents';
import { getCalendarYear } from '@/activities/calendar/utils/getCalendarYear';
import { CustomResolverFetchMoreLoader } from '@/activities/components/CustomResolverFetchMoreLoader';
import { SkeletonLoader } from '@/activities/components/SkeletonLoader';
import { useDateDisplayContext } from '@/localization/hooks/useDateDisplayContext';
import { formatDateTimeForAppLocale } from '@/localization/utils/formatDateTimeForAppLocale';
import { formatYearForAppLocale } from '@/localization/utils/formatYearForAppLocale';
import { StyledWidgetScrollContainer } from '@/ui/layout/components/WidgetContentContainer';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { format } from 'date-fns';
import { Section } from 'twenty-ui/components';
import {
  AnimatedPlaceholder,
  AnimatedPlaceholderEmptyContainer,
  AnimatedPlaceholderEmptySubTitle,
  AnimatedPlaceholderEmptyTextContainer,
  AnimatedPlaceholderEmptyTitle,
} from 'twenty-ui/primitives/feedback';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Heading } from 'twenty-ui/primitives/typography';
import { type TimelineCalendarEvent } from '~/generated/graphql';
import { dateLocaleState } from '~/localization/states/dateLocaleState';

const StyledContainer = styled(StyledWidgetScrollContainer)`
  gap: ${themeCssVariables.spacing[8]};
`;

const StyledYear = styled.span`
  color: ${themeCssVariables.font.color.light};
`;

const StyledTitleContainer = styled.div`
  margin-bottom: ${themeCssVariables.spacing[2]};

  h3 {
    color: ${themeCssVariables.font.color.secondary};
    font-size: ${themeCssVariables.font.size.md};
    font-weight: ${themeCssVariables.font.weight.regular};
    line-height: inherit;
  }
`;

type CalendarEventsCardContentProps = {
  firstQueryLoading: boolean;
  isFetchingMore: boolean;
  objectName: string;
  onLastRowVisible: () => Promise<void>;
  timelineCalendarEvents: TimelineCalendarEvent[] | undefined;
};

export const CalendarEventsCardContent = ({
  firstQueryLoading,
  isFetchingMore,
  objectName,
  onLastRowVisible,
  timelineCalendarEvents,
}: CalendarEventsCardContentProps) => {
  const { t } = useLingui();
  const { localeCatalog } = useAtomStateValue(dateLocaleState);
  const { locale, calendar } = useDateDisplayContext();
  const isPersianCalendar = calendar === 'persian';

  const {
    calendarEventsByDayTime,
    daysByMonthTime,
    monthTimes,
    monthTimesByYear,
  } = useCalendarEvents(timelineCalendarEvents ?? [], calendar);

  if (firstQueryLoading) {
    return <SkeletonLoader />;
  }

  if (!timelineCalendarEvents?.length) {
    // TODO: change animated placeholder
    return (
      <AnimatedPlaceholderEmptyContainer>
        <AnimatedPlaceholder type="noMatchRecord" />
        <AnimatedPlaceholderEmptyTextContainer>
          <AnimatedPlaceholderEmptyTitle>
            {t`No Events`}
          </AnimatedPlaceholderEmptyTitle>
          <AnimatedPlaceholderEmptySubTitle>
            {t`No events have been scheduled with this ${objectName} yet.`}
          </AnimatedPlaceholderEmptySubTitle>
        </AnimatedPlaceholderEmptyTextContainer>
      </AnimatedPlaceholderEmptyContainer>
    );
  }

  return (
    <CalendarContext.Provider
      value={{
        calendarEventsByDayTime,
      }}
    >
      <StyledContainer>
        {monthTimes.map((monthTime) => {
          const monthDayTimes = daysByMonthTime[monthTime] || [];
          const year = getCalendarYear(monthTime, calendar);
          const lastMonthTimeOfYear = monthTimesByYear[year]?.[0];
          const isLastMonthOfYear = lastMonthTimeOfYear === monthTime;
          const monthLabel = isPersianCalendar
            ? formatDateTimeForAppLocale({
                date: new Date(monthTime),
                locale,
                options: { month: 'long' },
              })
            : format(monthTime, 'MMMM', {
                locale: localeCatalog,
              });
          const yearLabel = isPersianCalendar
            ? formatYearForAppLocale(year, locale)
            : year;

          return (
            <Section.Root key={monthTime}>
              <StyledTitleContainer>
                <Heading level={3} size="lg">
                  {monthLabel}
                  {isLastMonthOfYear && <StyledYear> {yearLabel}</StyledYear>}
                </Heading>
              </StyledTitleContainer>
              <CalendarMonthCard dayTimes={monthDayTimes} />
            </Section.Root>
          );
        })}
        <CustomResolverFetchMoreLoader
          loading={isFetchingMore}
          onLastRowVisible={onLastRowVisible}
        />
      </StyledContainer>
    </CalendarContext.Provider>
  );
};
