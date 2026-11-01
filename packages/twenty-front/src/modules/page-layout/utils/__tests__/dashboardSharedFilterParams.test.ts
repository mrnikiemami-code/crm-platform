import {
  DASHBOARD_SHARED_SOURCE_FILTER,
  EMPTY_DASHBOARD_SHARED_FILTER,
  type DashboardSharedFilter,
} from '@/page-layout/types/DashboardSharedFilter';
import {
  buildDashboardSharedSearchParams,
  resolveDashboardSharedFilterCommit,
  serializeDashboardSharedFilter,
} from '@/page-layout/utils/dashboardSharedFilterParams';

const withDate = (
  dateFrom: string | null,
  dateTo: string | null,
): DashboardSharedFilter => ({
  ...EMPTY_DASHBOARD_SHARED_FILTER,
  dateFrom,
  dateTo,
});

// Mirrors one day click in DatePicker: onChange fires, then onClose fires with
// the same value. Only the first must produce a state + URL write.
const simulateDayClick = ({
  current,
  picked,
}: {
  current: DashboardSharedFilter;
  picked: string;
}): { applied: DashboardSharedFilter; writes: number } => {
  let applied = current;
  let writes = 0;

  for (const candidate of [withDate(picked, null), withDate(picked, null)]) {
    const commit = resolveDashboardSharedFilterCommit({
      current: applied,
      next: candidate,
    });

    if (commit !== null) {
      applied = commit;
      writes += 1;
    }
  }

  return { applied, writes };
};

describe('dashboardSharedFilterCommit', () => {
  it('writes once per day click even though onChange and onClose both commit', () => {
    const result = simulateDayClick({
      current: EMPTY_DASHBOARD_SHARED_FILTER,
      picked: '2026-09-23',
    });

    expect(result.writes).toBe(1);
    expect(result.applied.dateFrom).toBe('2026-09-23');
  });

  it('is idempotent: re-selecting the same date twice writes nothing new', () => {
    const first = simulateDayClick({
      current: EMPTY_DASHBOARD_SHARED_FILTER,
      picked: '2026-09-23',
    });
    const second = simulateDayClick({
      current: first.applied,
      picked: '2026-09-23',
    });

    expect(second.writes).toBe(0);
    expect(second.applied).toBe(first.applied);
  });

  it('keeps source when dates change and keeps dates when source changes', () => {
    const withSource: DashboardSharedFilter = {
      source: DASHBOARD_SHARED_SOURCE_FILTER.INSTAGRAM,
      dateFrom: '2026-09-23',
      dateTo: null,
    };

    const dateOnly = resolveDashboardSharedFilterCommit({
      current: withSource,
      next: { ...withSource, dateTo: '2026-09-30' },
    });

    expect(dateOnly?.source).toBe(DASHBOARD_SHARED_SOURCE_FILTER.INSTAGRAM);

    const sourceOnly = resolveDashboardSharedFilterCommit({
      current: withSource,
      next: { ...withSource, source: DASHBOARD_SHARED_SOURCE_FILTER.VOICE },
    });

    expect(sourceOnly?.dateFrom).toBe('2026-09-23');
  });

  it('keeps dsSource when clearing dates and restores all-time scope', () => {
    const base = new URLSearchParams('dsSource=VOICE&dsFrom=2026-09-23&dsTo=2026-09-30');

    const cleared = buildDashboardSharedSearchParams({
      sharedFilter: {
        source: DASHBOARD_SHARED_SOURCE_FILTER.VOICE,
        dateFrom: null,
        dateTo: null,
      },
      baseSearchParams: base,
    });

    expect(cleared.get('dsSource')).toBe('VOICE');
    expect(cleared.get('dsFrom')).toBeNull();
    expect(cleared.get('dsTo')).toBeNull();
  });

  it('produces an identical URL when the filter is unchanged', () => {
    const filter = withDate('2026-09-23', '2026-09-30');
    const base = new URLSearchParams('viewId=abc');

    const first = buildDashboardSharedSearchParams({
      sharedFilter: filter,
      baseSearchParams: base,
    });
    const second = buildDashboardSharedSearchParams({
      sharedFilter: filter,
      baseSearchParams: first,
    });

    expect(second.toString()).toBe(first.toString());
    expect(first.get('viewId')).toBe('abc');
    expect(serializeDashboardSharedFilter(filter)).toBe(
      serializeDashboardSharedFilter({ ...filter }),
    );
  });

  it('does not commit invalid or unchanged filter objects', () => {
    expect(
      resolveDashboardSharedFilterCommit({
        current: EMPTY_DASHBOARD_SHARED_FILTER,
        next: { ...EMPTY_DASHBOARD_SHARED_FILTER },
      }),
    ).toBeNull();
  });
});
