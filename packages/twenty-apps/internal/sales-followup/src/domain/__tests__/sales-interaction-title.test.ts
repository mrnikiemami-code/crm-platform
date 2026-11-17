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
    expect(
      decideSalesInteractionTitle({ state: state(), titleEditedInThisEvent: false }),
    ).toEqual({
      kind: 'WRITE_TITLE',
      title: 'تماس اول با سارا رضایی',
      titleIsAuto: true,
      because: 'TITLE_EMPTY',
    });
  });

  it('fills an empty title and claims ownership', () => {
    expect(
      decideSalesInteractionTitle({
        state: state({ title: '', titleIsAuto: false }),
        titleEditedInThisEvent: false,
      }),
    ).toMatchObject({ kind: 'WRITE_TITLE', because: 'TITLE_EMPTY' });
  });

  it('updates the title when the attempt changes on an automatic title', () => {
    expect(
      decideSalesInteractionTitle({
        state: state({
          callAttempt: 'CALL_2',
          title: 'تماس اول با سارا رضایی',
          titleIsAuto: true,
        }),
        titleEditedInThisEvent: false,
      }),
    ).toEqual({
      kind: 'WRITE_TITLE',
      title: 'تماس دوم با سارا رضایی',
      titleIsAuto: true,
      because: 'FACTS_CHANGED',
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
        titleEditedInThisEvent: false,
      }),
    ).toMatchObject({ kind: 'WRITE_TITLE', title: 'تماس اول با کریم رضایی' });
  });

  it('recognises its OWN write as already correct and does nothing', () => {
    // This is the loop-breaker: the app's write comes back as an update whose
    // title equals the computed one, and must never be read as a manual edit.
    expect(
      decideSalesInteractionTitle({
        state: state({
          title: 'تماس اول با سارا رضایی',
          titleIsAuto: true,
        }),
        titleEditedInThisEvent: true,
      }),
    ).toEqual({ kind: 'NO_WRITE', because: 'TITLE_ALREADY_CORRECT' });
  });

  it('releases ownership when a person edits the title', () => {
    // The contract: a title that changed in this event and does not match what the
    // app would produce was typed by a person. Ownership is dropped, the text is
    // left exactly as typed.
    expect(
      decideSalesInteractionTitle({
        state: state({ title: 'پیکیری', titleIsAuto: true }),
        titleEditedInThisEvent: true,
      }),
    ).toEqual({
      kind: 'RELEASE_OWNERSHIP',
      titleIsAuto: false,
      because: 'TITLE_MANUAL_EDIT',
    });
  });

  it('never overwrites an already-manual title', () => {
    expect(
      decideSalesInteractionTitle({
        state: state({
          callAttempt: 'CALL_3',
          title: 'پیکیری',
          titleIsAuto: false,
        }),
        titleEditedInThisEvent: false,
      }),
    ).toEqual({ kind: 'NO_WRITE', because: 'TITLE_MANUAL' });
  });

  it('does not touch a legacy title whose ownership was never recorded', () => {
    expect(
      decideSalesInteractionTitle({
        state: state({ title: 'پیکیری', titleIsAuto: null }),
        titleEditedInThisEvent: false,
      }),
    ).toEqual({ kind: 'NO_WRITE', because: 'OWNERSHIP_ABSENT' });
  });

  it('does not write when the computed title already matches', () => {
    expect(
      decideSalesInteractionTitle({
        state: state({ title: 'تماس اول با سارا رضایی', titleIsAuto: true }),
        titleEditedInThisEvent: false,
      }),
    ).toEqual({ kind: 'NO_WRITE', because: 'TITLE_ALREADY_CORRECT' });
  });

  it('is idempotent: a repeated event issues no second write', () => {
    const first = decideSalesInteractionTitle({
      state: state({
        callAttempt: 'CALL_2',
        title: 'تماس اول با سارا رضایی',
        titleIsAuto: true,
      }),
      titleEditedInThisEvent: false,
    });

    expect(first.kind).toBe('WRITE_TITLE');

    const applied = first.kind === 'WRITE_TITLE' ? first.title : null;

    expect(
      decideSalesInteractionTitle({
        state: state({
          callAttempt: 'CALL_2',
          title: applied,
          titleIsAuto: true,
        }),
        titleEditedInThisEvent: true,
      }),
    ).toEqual({ kind: 'NO_WRITE', because: 'TITLE_ALREADY_CORRECT' });
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
        titleEditedInThisEvent: false,
      }),
    ).toMatchObject({
      kind: 'WRITE_TITLE',
      title: `تماس اول با ${UNNAMED_CUSTOMER}`,
    });
  });

  it('reports an unbuildable title instead of writing a partial one', () => {
    expect(
      decideSalesInteractionTitle({
        state: state({ callAttempt: 'CALL_9' }),
        titleEditedInThisEvent: false,
      }),
    ).toEqual({ kind: 'NO_WRITE', because: 'TITLE_UNBUILDABLE' });
  });
});
