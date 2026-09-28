import { type TimelineActivity } from '@/activities/timeline-activities/types/TimelineActivity';
import { groupEventsByMonth } from '@/activities/timeline-activities/utils/groupEventsByMonth';
import { mockedTimelineActivityRecords } from '~/testing/mock-data/generated/data/timelineActivities/mock-timelineActivities-data';

const mockedTimelineActivities =
  mockedTimelineActivityRecords as unknown as TimelineActivity[];

describe('groupEventsByMonth', () => {
  it('groups an event by when it happened rather than when it was persisted', () => {
    const [group] = groupEventsByMonth([
      {
        createdAt: '2026-03-01T00:00:00.000Z',
        happensAt: '2026-02-01T00:00:00.000Z',
      } as TimelineActivity,
    ]);

    expect(group.month).toBe(1);
    expect(group.year).toBe(2026);
  });

  it('should group activities by month', () => {
    const grouped = groupEventsByMonth(mockedTimelineActivities);

    const totalItems = grouped.reduce(
      (sum, group) => sum + group.items.length,
      0,
    );
    expect(totalItems).toBe(mockedTimelineActivities.length);

    for (const group of grouped) {
      for (const item of group.items) {
        const date = new Date(item.happensAt);
        expect(date.getMonth()).toBe(group.month);
        expect(date.getFullYear()).toBe(group.year);
      }
    }
  });

  it('should sort groups by most recent first', () => {
    const grouped = groupEventsByMonth(mockedTimelineActivities);

    for (let index = 1; index < grouped.length; index++) {
      const previous = grouped[index - 1];
      const current = grouped[index];
      const isPreviousMoreRecent =
        previous.year > current.year ||
        (previous.year === current.year && previous.month > current.month);
      expect(isPreviousMoreRecent).toBe(true);
    }
  });

  describe('persian calendar', () => {
    const persianOptions = {
      calendar: 'persian' as const,
      timeZone: 'Asia/Tehran',
    };
    const lastDayOf1404 = {
      id: 'esfand-29',
      happensAt: '2026-03-20T20:15:00.000Z',
    } as TimelineActivity;
    const nowruzJustAfterMidnight = {
      id: 'nowruz-00-15',
      happensAt: '2026-03-20T20:45:00.000Z',
    } as TimelineActivity;
    const nowruzMorning = {
      id: 'nowruz-morning',
      happensAt: '2026-03-21T08:00:00.000Z',
    } as TimelineActivity;

    it('splits 1404/12/29 and 1405/01/01 into separate persian months', () => {
      const grouped = groupEventsByMonth(
        [lastDayOf1404, nowruzJustAfterMidnight, nowruzMorning],
        persianOptions,
      );

      expect(grouped).toEqual([
        {
          year: 1405,
          month: 0,
          items: [nowruzJustAfterMidnight, nowruzMorning],
        },
        { year: 1404, month: 11, items: [lastDayOf1404] },
      ]);
    });

    it('groups by the persian month boundary inside a year', () => {
      const lastDayOfFarvardin = {
        happensAt: '2026-04-20T19:59:00.000Z',
      } as TimelineActivity;
      const firstDayOfOrdibehesht = {
        happensAt: '2026-04-20T20:31:00.000Z',
      } as TimelineActivity;

      const grouped = groupEventsByMonth(
        [lastDayOfFarvardin, firstDayOfOrdibehesht],
        persianOptions,
      );

      expect(grouped.map(({ year, month }) => ({ year, month }))).toEqual([
        { year: 1405, month: 1 },
        { year: 1405, month: 0 },
      ]);
    });

    it('keeps the gregorian host-timezone grouping for the gregorian calendar', () => {
      const events = [lastDayOf1404, nowruzJustAfterMidnight, nowruzMorning];

      const expected = [{ year: 2026, month: 2, items: events }];

      expect(groupEventsByMonth(events)).toEqual(expected);
      expect(
        groupEventsByMonth(events, {
          calendar: 'gregory',
          timeZone: 'Asia/Tehran',
        }),
      ).toEqual(expected);
    });
  });
});
