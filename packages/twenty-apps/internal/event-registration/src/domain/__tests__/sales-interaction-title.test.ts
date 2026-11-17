import { describe, expect, it } from 'vitest';

import {
  buildSalesInteractionTitle,
  composeCustomerName,
  decideSalesInteractionTitle,
  UNNAMED_CUSTOMER,
  type SalesInteractionTitleState,
} from 'src/domain/sales-interaction-title';

const state = (
  overrides: Partial<SalesInteractionTitleState> = {},
): SalesInteractionTitleState => ({
  callAttempt: 'CALL_1',
  customerFirstName: 'سارا',
  customerLastName: 'رضایی',
  title: null,
  ...overrides,
});

describe('composeCustomerName', () => {
  it('joins both parts with a single space', () => {
    expect(composeCustomerName('سارا', 'رضایی')).toBe('سارا رضایی');
  });

  it('drops a missing part instead of leaving a stray space', () => {
    expect(composeCustomerName('سارا', null)).toBe('سارا');
    expect(composeCustomerName(null, 'رضایی')).toBe('رضایی');
  });

  it('treats blank and whitespace-only parts as absent', () => {
    expect(composeCustomerName('   ', '')).toBeNull();
  });
});

describe('buildSalesInteractionTitle', () => {
  it('builds the documented format', () => {
    expect(buildSalesInteractionTitle(state())).toBe('تماس اول با سارا رضایی');
  });

  it('uses the ordinal that matches the attempt', () => {
    const ordinals: Array<[string, string]> = [
      ['CALL_1', 'اول'],
      ['CALL_2', 'دوم'],
      ['CALL_3', 'سوم'],
      ['CALL_4', 'چهارم'],
      ['CALL_5', 'پنجم'],
    ];

    for (const [callAttempt, ordinal] of ordinals) {
      expect(buildSalesInteractionTitle(state({ callAttempt }))).toBe(
        `تماس ${ordinal} با سارا رضایی`,
      );
    }
  });

  it('uses «مشتری بدون نام» when the person has no name', () => {
    expect(
      buildSalesInteractionTitle(
        state({ customerFirstName: null, customerLastName: null }),
      ),
    ).toBe(`تماس اول با ${UNNAMED_CUSTOMER}`);
  });

  it('refuses to build a title for a missing attempt', () => {
    expect(buildSalesInteractionTitle(state({ callAttempt: null }))).toBeNull();
    expect(buildSalesInteractionTitle(state({ callAttempt: '  ' }))).toBeNull();
  });

  it('refuses to build a title for an ordinal it does not know', () => {
    // A sixth option added in metadata must fail visibly rather than write
    // «تماس  با …» with an empty ordinal.
    expect(
      buildSalesInteractionTitle(state({ callAttempt: 'CALL_6' })),
    ).toBeNull();
  });
});

describe('decideSalesInteractionTitle', () => {
  it('creates a title on a new follow-up', () => {
    const decision = decideSalesInteractionTitle({
      previous: null,
      next: state({ title: null }),
    });

    expect(decision).toEqual({
      apply: true,
      title: 'تماس اول با سارا رضایی',
      because: 'TITLE_EMPTY',
    });
  });

  it('fills an empty title on an existing follow-up', () => {
    const decision = decideSalesInteractionTitle({
      previous: state({ title: '' }),
      next: state({ title: '' }),
    });

    expect(decision).toMatchObject({ apply: true, because: 'TITLE_EMPTY' });
  });

  it('updates the title when the attempt changes', () => {
    const decision = decideSalesInteractionTitle({
      previous: state({ title: 'تماس اول با سارا رضایی' }),
      next: state({ callAttempt: 'CALL_2', title: 'تماس اول با سارا رضایی' }),
    });

    expect(decision).toEqual({
      apply: true,
      title: 'تماس دوم با سارا رضایی',
      because: 'TITLE_WAS_AUTO',
    });
  });

  it('updates the title when the customer name changes', () => {
    const decision = decideSalesInteractionTitle({
      previous: state({ title: 'تماس اول با سارا رضایی' }),
      next: state({
        customerFirstName: 'کریم',
        title: 'تماس اول با سارا رضایی',
      }),
    });

    expect(decision).toEqual({
      apply: true,
      title: 'تماس اول با کریم رضایی',
      because: 'TITLE_WAS_AUTO',
    });
  });

  it('never overwrites a hand-written title', () => {
    const decision = decideSalesInteractionTitle({
      previous: state({ title: 'پیکیری' }),
      next: state({ callAttempt: 'CALL_3', title: 'پیکیری' }),
    });

    expect(decision).toEqual({
      apply: false,
      because: 'TITLE_MANUAL',
      title: 'پیکیری',
    });
  });

  it('keeps a hand-written title even when the recorded facts are missing', () => {
    const decision = decideSalesInteractionTitle({
      previous: state({ callAttempt: null, title: 'پیکیری' }),
      next: state({ callAttempt: null, title: 'پیکیری' }),
    });

    expect(decision).toMatchObject({ apply: false });
  });

  it('does not write when the computed title already matches', () => {
    // This is what stops a write from re-triggering its own update event.
    const decision = decideSalesInteractionTitle({
      previous: state({ title: 'تماس اول با سارا رضایی' }),
      next: state({ title: 'تماس اول با سارا رضایی' }),
    });

    expect(decision).toMatchObject({
      apply: false,
      because: 'TITLE_UNCHANGED',
    });
  });

  it('is idempotent: applying twice issues no second write', () => {
    const first = decideSalesInteractionTitle({
      previous: state({ title: 'تماس اول با سارا رضایی' }),
      next: state({ callAttempt: 'CALL_2', title: 'تماس اول با سارا رضایی' }),
    });

    expect(first.apply).toBe(true);

    const appliedTitle = first.apply ? first.title : null;

    const second = decideSalesInteractionTitle({
      previous: state({
        callAttempt: 'CALL_2',
        title: 'تماس اول با سارا رضایی',
      }),
      next: state({ callAttempt: 'CALL_2', title: appliedTitle }),
    });

    expect(second).toMatchObject({
      apply: false,
      because: 'TITLE_UNCHANGED',
    });
  });

  it('renames a title to the unnamed fallback when the name is cleared', () => {
    const decision = decideSalesInteractionTitle({
      previous: state({ title: 'تماس اول با سارا رضایی' }),
      next: state({
        customerFirstName: null,
        customerLastName: null,
        title: 'تماس اول با سارا رضایی',
      }),
    });

    expect(decision).toEqual({
      apply: true,
      title: `تماس اول با ${UNNAMED_CUSTOMER}`,
      because: 'TITLE_WAS_AUTO',
    });
  });

  it('reports an unbuildable title instead of writing a partial one', () => {
    const decision = decideSalesInteractionTitle({
      previous: null,
      next: state({ callAttempt: 'CALL_9' }),
    });

    expect(decision).toEqual({
      apply: false,
      because: 'TITLE_UNBUILDABLE',
      title: null,
    });
  });
});
