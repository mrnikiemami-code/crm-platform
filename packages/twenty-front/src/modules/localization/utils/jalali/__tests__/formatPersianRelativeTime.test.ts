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
    it('should say "now" under a minute', () => {
      expect(formatExact(-20 * 1000)).toBe('اکنون');
    });

    it('should format minutes with Persian digits', () => {
      expect(formatExact(-5 * MINUTE)).toBe('۵ دقیقه پیش');
    });

    it('should format 3 hours ago', () => {
      expect(formatExact(-3 * HOUR)).toBe('۳ ساعت پیش');
    });

    it('should format future hours', () => {
      expect(formatExact(3 * HOUR)).toBe('۳ ساعت بعد');
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

    it('should say yesterday and tomorrow', () => {
      expect(formatDayLevel(-DAY)).toBe('دیروز');
      expect(formatDayLevel(DAY)).toBe('فردا');
    });

    it('should use numbers from two days on', () => {
      expect(formatDayLevel(-2 * DAY)).toBe('۲ روز پیش');
      expect(formatDayLevel(2 * DAY)).toBe('۲ روز دیگر');
    });

    it('should round a DST-shortened day to yesterday instead of hours', () => {
      expect(formatDayLevel(-23 * HOUR)).toBe('دیروز');
      expect(formatDayLevel(-25 * HOUR)).toBe('دیروز');
    });

    it('should switch to months and years at the date-fns thresholds', () => {
      expect(formatDayLevel(-60 * DAY)).toBe('۲ ماه پیش');
      expect(formatDayLevel(-2 * 365 * DAY)).toBe('۲ سال پیش');
    });
  });
});
