import {
  formatToHumanReadableDay,
  formatToHumanReadableMonth,
  formatToHumanReadableTime,
} from '~/utils/format/formatDate';

// Every assertion passes an explicit app locale, so results must not depend on
// the host locale the test runner happens to use.
describe('formatToHumanReadableMonth', () => {
  it('should format the month in the en app locale', () => {
    expect(
      formatToHumanReadableMonth(new Date('2022-01-01'), 'UTC', 'en'),
    ).toBe('Jan');
  });

  it('should format the month in another non-fa app locale', () => {
    expect(
      formatToHumanReadableMonth(new Date('2022-01-01'), 'UTC', 'fr-FR'),
    ).toBe('janv.');
  });

  it('should format the persian month for fa-IR', () => {
    expect(
      formatToHumanReadableMonth(new Date('2022-01-01'), 'UTC', 'fa-IR'),
    ).toBe('دی');
  });

  it('should fall back to en for app locales unknown to Intl', () => {
    expect(
      formatToHumanReadableMonth(new Date('2022-01-01'), 'UTC', 'pseudo-en'),
    ).toBe('Jan');
  });
});

describe('formatToHumanReadableDay', () => {
  it('should format the day in the en app locale', () => {
    expect(formatToHumanReadableDay(new Date('2022-01-01'), 'UTC', 'en')).toBe(
      '1',
    );
  });

  it('should format the persian day with persian digits for fa-IR', () => {
    expect(
      formatToHumanReadableDay(new Date('2022-01-01'), 'UTC', 'fa-IR'),
    ).toBe('۱۱');
  });

  it('should use the given timezone across midnight', () => {
    const lateEveningUtc = new Date('2022-01-01T20:45:00Z');

    expect(formatToHumanReadableDay(lateEveningUtc, 'UTC', 'en')).toBe('1');
    expect(formatToHumanReadableDay(lateEveningUtc, 'Asia/Tehran', 'en')).toBe(
      '2',
    );
    expect(
      formatToHumanReadableDay(lateEveningUtc, 'Asia/Tehran', 'fa-IR'),
    ).toBe('۱۲');
  });
});

describe('formatToHumanReadableTime', () => {
  it('should format the time in the en app locale', () => {
    expect(
      formatToHumanReadableTime(new Date('2022-01-01T12:30:00Z'), 'UTC', 'en'),
    ).toMatch(/^12:30\sPM$/);
  });

  it('should format the time in another non-fa app locale', () => {
    expect(
      formatToHumanReadableTime(
        new Date('2022-01-01T12:30:00Z'),
        'UTC',
        'fr-FR',
      ),
    ).toBe('12:30');
  });

  it('should format the time with persian digits for fa-IR', () => {
    expect(
      formatToHumanReadableTime(
        new Date('2022-01-01T12:30:00Z'),
        'UTC',
        'fa-IR',
      ),
    ).toBe('۱۲:۳۰');
  });
});
