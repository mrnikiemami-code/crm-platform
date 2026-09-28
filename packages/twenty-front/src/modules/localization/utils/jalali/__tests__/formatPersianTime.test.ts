import { TimeFormat } from '@/localization/constants/TimeFormat';
import { formatPersianTime } from '@/localization/utils/jalali/formatPersianTime';

const TEN_UTC = new Date('2026-09-28T10:00:00Z');

describe('formatPersianTime', () => {
  it('should format 24h time with Persian digits', () => {
    expect(
      formatPersianTime({
        date: TEN_UTC,
        timeZone: 'Asia/Tehran',
        timeFormat: TimeFormat.HOUR_24,
      }),
    ).toBe('۱۳:۳۰');
  });

  it('should zero-pad hours in 24h time', () => {
    expect(
      formatPersianTime({
        date: new Date('2026-09-27T21:00:00Z'),
        timeZone: 'Asia/Tehran',
        timeFormat: TimeFormat.HOUR_24,
      }),
    ).toBe('۰۰:۳۰');
  });

  it('should format 12h time with the Intl Persian day period', () => {
    expect(
      formatPersianTime({
        date: TEN_UTC,
        timeZone: 'Asia/Tehran',
        timeFormat: TimeFormat.HOUR_12,
      }),
    ).toBe('۱:۳۰ ب.ظ.');
    expect(
      formatPersianTime({
        date: new Date('2026-09-27T21:00:00Z'),
        timeZone: 'Asia/Tehran',
        timeFormat: TimeFormat.HOUR_12,
      }),
    ).toBe('۱۲:۳۰ ق.ظ.');
  });

  it('should apply the given timezone', () => {
    expect(
      formatPersianTime({
        date: TEN_UTC,
        timeZone: 'UTC',
        timeFormat: TimeFormat.HOUR_24,
      }),
    ).toBe('۱۰:۰۰');
  });
});
