import { resolveDashboardSharedDateBounds } from '@/page-layout/utils/resolveDashboardSharedDateBounds';

describe('resolveDashboardSharedDateBounds', () => {
  it('returns none when both bounds empty (all-time includes undated)', () => {
    expect(
      resolveDashboardSharedDateBounds({
        dateFrom: null,
        dateTo: null,
        timeZone: 'Asia/Tehran',
      }),
    ).toEqual({ status: 'none' });
  });

  it('rejects reversed ranges', () => {
    expect(
      resolveDashboardSharedDateBounds({
        dateFrom: '2026-10-20',
        dateTo: '2026-10-10',
        timeZone: 'Asia/Tehran',
      }),
    ).toEqual({ status: 'invalid', reason: 'reversed' });
  });

  it('builds inclusive day start and exclusive next-day end in timezone', () => {
    const result = resolveDashboardSharedDateBounds({
      dateFrom: '2026-10-10',
      dateTo: '2026-10-12',
      timeZone: 'Asia/Tehran',
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') {
      return;
    }

    expect(result.bounds.rangeStartInstant).toContain('2026-10-10T00:00:00');
    expect(result.bounds.rangeEndExclusiveInstant).toContain(
      '2026-10-13T00:00:00',
    );
  });

  it('allows open-ended from-only and to-only ranges', () => {
    const fromOnly = resolveDashboardSharedDateBounds({
      dateFrom: '2026-01-01',
      dateTo: null,
      timeZone: 'UTC',
    });
    const toOnly = resolveDashboardSharedDateBounds({
      dateFrom: null,
      dateTo: '2026-01-02',
      timeZone: 'UTC',
    });

    expect(fromOnly.status).toBe('ok');
    expect(toOnly.status).toBe('ok');
    if (toOnly.status === 'ok') {
      expect(toOnly.bounds.rangeEndExclusiveInstant).toContain(
        '2026-01-03T00:00:00',
      );
    }
  });
});
