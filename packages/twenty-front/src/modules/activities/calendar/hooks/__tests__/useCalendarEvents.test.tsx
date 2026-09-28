import { renderHook } from '@testing-library/react';

import { useCalendarEvents } from '@/activities/calendar/hooks/useCalendarEvents';
import {
  CalendarChannelVisibility,
  type TimelineCalendarEvent,
} from '~/generated/graphql';

const calendarEvents: TimelineCalendarEvent[] = [
  {
    id: '1234',
    isFullDay: false,
    startsAt: '2024-02-17T21:45:27.822Z',
    visibility: CalendarChannelVisibility.METADATA,
    conferenceLink: {
      primaryLinkUrl: 'https://meet.google.com/abc-def-ghi',
      primaryLinkLabel: 'Google Meet',
      __typename: 'LinksMetadata',
    },
    conferenceSolution: 'GoogleMeet',
    description: 'Description',
    endsAt: '2024-02-17T22:45:27.822Z',
    isCanceled: false,
    location: 'Location',
    participants: [],
    callRecordings: [],
    title: 'Title',
    __typename: 'TimelineCalendarEvent',
  },
  {
    id: '5678',
    isFullDay: false,
    startsAt: '2024-02-18T21:43:27.754Z',
    visibility: CalendarChannelVisibility.SHARE_EVERYTHING,
    conferenceLink: {
      primaryLinkUrl: 'https://meet.google.com/abc-def-ghi',
      primaryLinkLabel: 'Google Meet',
      __typename: 'LinksMetadata',
    },
    conferenceSolution: 'GoogleMeet',
    description: 'Description',
    endsAt: '2024-02-17T22:45:27.822Z',
    isCanceled: false,
    location: 'Location',
    participants: [],
    callRecordings: [],
    title: 'Title',
    __typename: 'TimelineCalendarEvent',
  },
  {
    id: '91011',
    isFullDay: true,
    startsAt: '2024-02-19T22:05:27.653Z',
    visibility: CalendarChannelVisibility.METADATA,
    conferenceLink: {
      primaryLinkUrl: 'https://meet.google.com/abc-def-ghi',
      primaryLinkLabel: 'Google Meet',
      __typename: 'LinksMetadata',
    },
    conferenceSolution: 'GoogleMeet',
    description: 'Description',
    endsAt: '2024-02-17T22:45:27.822Z',
    isCanceled: false,
    location: 'Location',
    participants: [],
    callRecordings: [],
    title: 'Title',
    __typename: 'TimelineCalendarEvent',
  },
  {
    id: '121314',
    isFullDay: true,
    startsAt: '2024-02-20T23:15:23.150Z',
    visibility: CalendarChannelVisibility.SHARE_EVERYTHING,
    conferenceLink: {
      primaryLinkUrl: 'https://meet.google.com/abc-def-ghi',
      primaryLinkLabel: 'Google Meet',
      __typename: 'LinksMetadata',
    },
    conferenceSolution: 'GoogleMeet',
    description: 'Description',
    endsAt: '2024-02-17T22:45:27.822Z',
    isCanceled: false,
    location: 'Location',
    participants: [],
    callRecordings: [],
    title: 'Title',
    __typename: 'TimelineCalendarEvent',
  },
];

describe('useCalendarEvents', () => {
  it('returns calendar events grouped by day time', () => {
    const { result } = renderHook(() => useCalendarEvents(calendarEvents));

    expect(result.current.calendarEventsByDayTime).toBeDefined();
    expect(result.current.daysByMonthTime).toBeDefined();
    expect(result.current.monthTimes).toBeDefined();
    expect(result.current.monthTimesByYear).toBeDefined();
  });

  it('keeps gregorian month and year grouping by default', () => {
    const { result } = renderHook(() => useCalendarEvents(calendarEvents));

    expect(result.current.monthTimes).toEqual([new Date(2024, 1, 1).getTime()]);
    expect(Object.keys(result.current.monthTimesByYear)).toEqual(['2024']);
  });

  it('groups days by persian month and year across nowruz', () => {
    const [baseCalendarEvent] = calendarEvents;
    const nowruzCalendarEvents = [
      {
        ...baseCalendarEvent,
        id: 'esfand-29',
        startsAt: '2026-03-20T10:00:00Z',
      },
      {
        ...baseCalendarEvent,
        id: 'farvardin-1',
        startsAt: '2026-03-21T10:00:00Z',
      },
    ];

    const { result } = renderHook(() =>
      useCalendarEvents(nowruzCalendarEvents, 'persian'),
    );

    expect(result.current.monthTimes).toHaveLength(2);
    expect(Object.keys(result.current.monthTimesByYear).sort()).toEqual([
      '1404',
      '1405',
    ]);
    expect(result.current.monthTimesByYear[1405]).toEqual([
      result.current.monthTimes[0],
    ]);
  });
});
