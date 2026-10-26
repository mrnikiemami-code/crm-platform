import { sanitizeChartAxisLabel } from '@/page-layout/widgets/graph/utils/sanitizeChartAxisLabel';

describe('sanitizeChartAxisLabel', () => {
  it('hides Count all of ID technical aggregate labels', () => {
    expect(sanitizeChartAxisLabel('Count all of ID')).toBeUndefined();
    expect(sanitizeChartAxisLabel('Count all of Id')).toBeUndefined();
    expect(sanitizeChartAxisLabel('Sum of UUID')).toBeUndefined();
  });

  it('keeps human-readable axis labels', () => {
    expect(sanitizeChartAxisLabel('نوبت تماس')).toBe('نوبت تماس');
    expect(sanitizeChartAxisLabel('Creation date')).toBe('Creation date');
  });

  it('returns undefined for empty labels', () => {
    expect(sanitizeChartAxisLabel('')).toBeUndefined();
    expect(sanitizeChartAxisLabel(null)).toBeUndefined();
    expect(sanitizeChartAxisLabel(undefined)).toBeUndefined();
  });
});
