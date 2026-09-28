import { type TimelineActivity } from '@/activities/timeline-activities/types/TimelineActivity';
import { getEventGroupLabels } from '@/activities/timeline-activities/utils/getEventGroupLabels';
import { groupEventsByMonth } from '@/activities/timeline-activities/utils/groupEventsByMonth';

const events = [
  { happensAt: '2026-03-20T20:15:00.000Z' },
  { happensAt: '2026-03-20T20:45:00.000Z' },
] as TimelineActivity[];

describe('getEventGroupLabels', () => {
  it('labels persian groups with the persian month and persian-digit year', () => {
    const timeZone = 'Asia/Tehran';
    const groups = groupEventsByMonth(events, {
      calendar: 'persian',
      timeZone,
    });

    expect(
      groups.map((group) =>
        getEventGroupLabels({
          group,
          locale: 'fa-IR',
          calendar: 'persian',
          timeZone,
        }),
      ),
    ).toEqual([
      { monthLabel: 'فروردین', yearLabel: '۱۴۰۵' },
      { monthLabel: 'اسفند', yearLabel: '۱۴۰۴' },
    ]);
  });

  it('keeps the gregorian month in the en app locale', () => {
    const [group] = groupEventsByMonth(events);

    expect(
      getEventGroupLabels({
        group,
        locale: 'en',
        calendar: 'gregory',
        timeZone: 'Asia/Tehran',
      }),
    ).toEqual({ monthLabel: 'March', yearLabel: '2026' });
  });

  it('keeps the gregorian month in another non-fa app locale', () => {
    const [group] = groupEventsByMonth(events);

    expect(
      getEventGroupLabels({
        group,
        locale: 'fr-FR',
        calendar: 'gregory',
        timeZone: 'Asia/Tehran',
      }),
    ).toEqual({ monthLabel: 'mars', yearLabel: '2026' });
  });
});
