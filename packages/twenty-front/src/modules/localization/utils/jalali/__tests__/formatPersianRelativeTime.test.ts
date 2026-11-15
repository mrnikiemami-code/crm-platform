import { formatPersianRelativeTime } from '@/localization/utils/jalali/formatPersianRelativeTime';

const BASE = Date.parse('2026-09-28T12:00:00Z');
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatExact = (offsetMs: number) =>
  formatPersianRelativeTime({
    targetEpochMilliseconds: BASE + offsetMs,
    baseEpochMilliseconds: BASE,
    isDayLevelComparison: false,
  });

const formatDayLevel = (offsetMs: number) =>
  formatPersianRelativeTime({
    targetEpochMilliseconds: BASE + offsetMs,
    baseEpochMilliseconds: BASE,
    isDayLevelComparison: true,
  });

describe('formatPersianRelativeTime', () => {
  describe('exact comparisons', () => {
    it('should say a moment ago under a minute', () => {
      expect(formatExact(-20 * 1000)).toBe('چند لحظه پیش');
    });

    it('should format minutes with Persian digits', () => {
      expect(formatExact(-5 * MINUTE)).toBe('۵ دقیقه پیش');
    });

    it('should format 3 hours ago', () => {
      expect(formatExact(-3 * HOUR)).toBe('۳ ساعت پیش');
    });

    it('should format future hours', () => {
      expect(formatExact(3 * HOUR)).toBe('۳ ساعت دیگر');
    });

    it('should keep the date-fns thresholds (44 min stays in minutes, 45 min becomes 1 hour)', () => {
      expect(formatExact(-44 * MINUTE)).toBe('۴۴ دقیقه پیش');
      expect(formatExact(-45 * MINUTE)).toBe('۱ ساعت پیش');
    });
  });

  describe('day-level comparisons', () => {
    it('should say today for the same day', () => {
      expect(formatDayLevel(0)).toBe('امروز');
    });

    it('should use a count of one day rather than a word', () => {
      expect(formatDayLevel(-DAY)).toBe('۱ روز پیش');
      expect(formatDayLevel(DAY)).toBe('۱ روز دیگر');
    });

    it('should use numbers from two days on', () => {
      expect(formatDayLevel(-2 * DAY)).toBe('۲ روز پیش');
      expect(formatDayLevel(2 * DAY)).toBe('۲ روز دیگر');
    });

    it('should round a DST-shortened day to one day instead of hours', () => {
      expect(formatDayLevel(-23 * HOUR)).toBe('۱ روز پیش');
      expect(formatDayLevel(-25 * HOUR)).toBe('۱ روز پیش');
    });

    it('should switch to months and years at the date-fns thresholds', () => {
      expect(formatDayLevel(-60 * DAY)).toBe('۲ ماه پیش');
      expect(formatDayLevel(-2 * 365 * DAY)).toBe('۲ سال پیش');
    });

    it('should render the People creation date as a natural Persian phrase', () => {
      // The column that reported "days ago 21": a fixed 21-day old record must
      // read right-to-left as number, unit, then direction.
      expect(formatDayLevel(-21 * DAY)).toBe('۲۱ روز پیش');
      expect(formatExact(-2 * HOUR)).toBe('۲ ساعت پیش');
    });
  });
});
