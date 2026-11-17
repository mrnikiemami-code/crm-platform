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
  titleIsAuto: null,
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
    expect(composeCustomerName(null, null)).toBeNull();
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
    expect(
      buildSalesInteractionTitle(state({ callAttempt: 'CALL_6' })),
    ).toBeNull();
  });
});

describe('decideSalesInteractionTitle', () => {
  it('creates an automatic title on a new follow-up', () => {
    expect(decideSalesInteractionTitle({ state: state() })).toEqual({
      apply: true,
      title: 'تماس اول با سارا رضایی',
      titleIsAuto: true,
      because: 'TITLE_EMPTY',
    });
  });

  it('fills an empty title and claims ownership', () => {
    const decision = decideSalesInteractionTitle({
      state: state({ title: '', titleIsAuto: false }),
    });

    expect(decision).toMatchObject({
      apply: true,
      because: 'TITLE_EMPTY',
      titleIsAuto: true,
    });
  });

  it('updates the title when the attempt changes on an automatic title', () => {
    expect(
      decideSalesInteractionTitle({
        state: state({
          callAttempt: 'CALL_2',
          title: 'تماس اول با سارا رضایی',
          titleIsAuto: true,
        }),
      }),
    ).toEqual({
      apply: true,
      title: 'تماس دوم با سارا رضایی',
      titleIsAuto: true,
      because: 'TITLE_WAS_AUTO',
    });
  });

  it('updates the title when the customer name changes', () => {
    expect(
      decideSalesInteractionTitle({
        state: state({
          customerFirstName: 'کریم',
          title: 'تماس اول با سارا رضایی',
          titleIsAuto: true,
        }),
      }),
    ).toMatchObject({ apply: true, title: 'تماس اول با کریم رضایی' });
  });

  it('never overwrites a hand-written title', () => {
    expect(
      decideSalesInteractionTitle({
        state: state({
          callAttempt: 'CALL_3',
          title: 'پیکیری',
          titleIsAuto: false,
        }),
      }),
    ).toEqual({
      apply: false,
      because: 'TITLE_MANUAL',
      title: 'پیکیری',
    });
  });

  it('does not touch a legacy title whose ownership was never recorded', () => {
    // The flag is null on every row that predates the field. Treating that as
    // "ours" would destroy text a person typed, so it is reported instead.
    expect(
      decideSalesInteractionTitle({
        state: state({ title: 'پیکیری', titleIsAuto: null }),
      }),
    ).toEqual({
      apply: false,
      because: 'OWNERSHIP_ABSENT',
      title: 'پیکیری',
    });
  });

  it('does not write when the computed title already matches', () => {
    expect(
      decideSalesInteractionTitle({
        state: state({
          title: 'تماس اول با سارا رضایی',
          titleIsAuto: true,
        }),
      }),
    ).toMatchObject({ apply: false, because: 'TITLE_UNCHANGED' });
  });

  it('is idempotent: a repeated event issues no second write', () => {
    const first = decideSalesInteractionTitle({
      state: state({
        callAttempt: 'CALL_2',
        title: 'تماس اول با سارا رضایی',
        titleIsAuto: true,
      }),
    });

    expect(first.apply).toBe(true);

    const applied = first.apply ? first.title : null;

    expect(
      decideSalesInteractionTitle({
        state: state({
          callAttempt: 'CALL_2',
          title: applied,
          titleIsAuto: true,
        }),
      }),
    ).toMatchObject({ apply: false, because: 'TITLE_UNCHANGED' });
  });

  it('falls back to the unnamed label when the name is cleared', () => {
    expect(
      decideSalesInteractionTitle({
        state: state({
          customerFirstName: null,
          customerLastName: null,
          title: 'تماس اول با سارا رضایی',
          titleIsAuto: true,
        }),
      }),
    ).toMatchObject({
      apply: true,
      title: `تماس اول با ${UNNAMED_CUSTOMER}`,
    });
  });

  it('reports an unbuildable title instead of writing a partial one', () => {
    expect(
      decideSalesInteractionTitle({ state: state({ callAttempt: 'CALL_9' }) }),
    ).toEqual({
      apply: false,
      because: 'TITLE_UNBUILDABLE',
      title: null,
    });
  });
});
