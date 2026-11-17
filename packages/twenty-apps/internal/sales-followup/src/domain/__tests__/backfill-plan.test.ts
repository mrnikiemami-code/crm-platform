import { describe, expect, it } from 'vitest';

import {
  planTitleBackfill,
  type BackfillRecord,
} from 'src/domain/backfill-plan';

const record = (overrides: Partial<BackfillRecord> = {}): BackfillRecord => ({
  id: 'i1',
  callAttempt: 'CALL_1',
  customerFirstName: 'سارا',
  customerLastName: 'رضایی',
  title: null,
  titleIsAuto: null,
  ...overrides,
});

describe('planTitleBackfill', () => {
  it('fills an empty title and reports the text it would write', () => {
    const plan = planTitleBackfill([record()]);

    expect(plan.items).toEqual([
      {
        id: 'i1',
        action: 'FILL',
        title: 'تماس اول با سارا رضایی',
        because: 'TITLE_EMPTY',
      },
    ]);
    expect(plan.fill).toBe(1);
  });

  it('preserves a legacy hand-written title and never touches it', () => {
    const plan = planTitleBackfill([record({ title: 'پیکیری' })]);

    expect(plan.items[0]).toMatchObject({
      action: 'PRESERVE',
      because: 'TITLE_MANUAL',
      title: 'پیکیری',
    });
    expect(plan.preserveManual).toBe(1);
  });

  it('preserves a title even when ownership was already recorded as automatic', () => {
    // The backfill never rewrites existing text; only the empty case is filled.
    const plan = planTitleBackfill([
      record({ title: 'تماس اول با نام قدیمی', titleIsAuto: true }),
    ]);

    expect(plan.items[0]).toMatchObject({
      action: 'PRESERVE',
      because: 'TITLE_MANUAL',
    });
  });

  it('treats an already-correct title as unchanged, so a re-run is a no-op', () => {
    const plan = planTitleBackfill([
      record({ title: 'تماس اول با سارا رضایی', titleIsAuto: true }),
    ]);

    expect(plan.items[0]).toMatchObject({
      action: 'PRESERVE',
      because: 'TITLE_UNCHANGED',
    });
    expect(plan.fill).toBe(0);
  });

  it('reports an unbuildable title instead of writing a partial one', () => {
    const plan = planTitleBackfill([record({ callAttempt: null })]);

    expect(plan.items[0]).toMatchObject({
      action: 'PRESERVE',
      because: 'TITLE_UNBUILDABLE',
      title: null,
    });
    expect(plan.preserveUnbuildable).toBe(1);
  });

  it('uses the unnamed fallback rather than leaving the title empty', () => {
    const plan = planTitleBackfill([
      record({ customerFirstName: null, customerLastName: null }),
    ]);

    expect(plan.items[0]).toMatchObject({
      action: 'FILL',
      title: 'تماس اول با مشتری بدون نام',
    });
  });

  it('treats a whitespace-only title as empty', () => {
    const plan = planTitleBackfill([record({ title: '   ' })]);

    expect(plan.items[0]).toMatchObject({ action: 'FILL' });
  });

  it('summarises a mixed batch', () => {
    const plan = planTitleBackfill([
      record({ id: 'a' }),
      record({ id: 'b', title: 'پیکیری' }),
      record({ id: 'c', title: 'تماس اول با سارا رضایی' }),
      record({ id: 'd', callAttempt: null }),
    ]);

    expect(plan).toMatchObject({
      fill: 1,
      preserve: 3,
      preserveManual: 1,
      preserveUnbuildable: 1,
    });
  });

  it('is idempotent: the second plan fills nothing', () => {
    const first = planTitleBackfill([record()]);
    const filled = first.items[0];

    expect(filled.action).toBe('FILL');

    const second = planTitleBackfill([
      record({
        title: filled.action === 'FILL' ? filled.title : null,
        titleIsAuto: true,
      }),
    ]);

    expect(second.fill).toBe(0);
  });
});
