import { describe, expect, it } from 'vitest';

import { buildPaymentTitle, buildRegistrationTitle } from 'src/domain/record-title';

const PERSON = 'مهران صالحپور';
const EVENT = 'همایش آذر ماه';

describe('buildRegistrationTitle', () => {
  it('names the person and the event', () => {
    expect(
      buildRegistrationTitle({
        personName: PERSON,
        eventName: EVENT,
        leadName: PERSON,
      }),
    ).toBe('ثبت‌نام مهران صالحپور در همایش آذر ماه');
  });

  it('falls back to the lead label when the person label is missing', () => {
    expect(
      buildRegistrationTitle({
        personName: null,
        eventName: EVENT,
        leadName: 'سرنخ آذراد',
      }),
    ).toBe('ثبت‌نام سرنخ آذراد در همایش آذر ماه');
  });

  it('keeps the event when only the event is known', () => {
    expect(
      buildRegistrationTitle({
        personName: null,
        eventName: EVENT,
        leadName: null,
      }),
    ).toBe('ثبت‌نام همایش همایش آذر ماه');
  });

  it('never returns an empty title when nothing is known', () => {
    const title = buildRegistrationTitle({
      personName: null,
      eventName: null,
      leadName: null,
    });

    expect(title).toBe('ثبت‌نام همایش');
    expect(title.trim().length).toBeGreaterThan(0);
  });

  it('ignores blank and whitespace-only labels', () => {
    expect(
      buildRegistrationTitle({
        personName: '   ',
        eventName: '',
        leadName: '  ',
      }),
    ).toBe('ثبت‌نام همایش');
  });

  it('trims labels so the title has no doubled spaces', () => {
    expect(
      buildRegistrationTitle({
        personName: '  مهران صالحپور  ',
        eventName: '  همایش آذر ماه ',
        leadName: null,
      }),
    ).toBe('ثبت‌نام مهران صالحپور در همایش آذر ماه');
  });
});

describe('buildPaymentTitle', () => {
  it('leads with the received amount, then the person and the event', () => {
    expect(
      buildPaymentTitle({
        amountToman: 3000000,
        personName: PERSON,
        eventName: EVENT,
        leadName: PERSON,
      }),
    ).toBe('پرداخت ۳٬۰۰۰٬۰۰۰ تومان — مهران صالحپور — همایش آذر ماه');
  });

  it('groups the amount with the Persian separator', () => {
    const title = buildPaymentTitle({
      amountToman: 12500000,
      personName: PERSON,
      eventName: EVENT,
      leadName: PERSON,
    });

    expect(title).toContain('۱۲٬۵۰۰٬۰۰۰');
  });

  it('falls back to the lead label, then to the event alone', () => {
    expect(
      buildPaymentTitle({
        amountToman: 3900000,
        personName: null,
        eventName: EVENT,
        leadName: 'سرنخ آذراد',
      }),
    ).toBe('پرداخت ۳٬۹۰۰٬۰۰۰ تومان — سرنخ آذراد — همایش آذر ماه');

    expect(
      buildPaymentTitle({
        amountToman: 3900000,
        personName: null,
        eventName: EVENT,
        leadName: null,
      }),
    ).toBe('پرداخت ۳٬۹۰۰٬۰۰۰ تومان — همایش آذر ماه');
  });

  it('still carries the amount when no label exists', () => {
    expect(
      buildPaymentTitle({
        amountToman: 1000000,
        personName: null,
        eventName: null,
        leadName: null,
      }),
    ).toBe('پرداخت ۱٬۰۰۰٬۰۰۰ تومان');
  });

  it('never returns an empty title for a positive amount', () => {
    const title = buildPaymentTitle({
      amountToman: 1,
      personName: null,
      eventName: null,
      leadName: null,
    });

    expect(title.startsWith('پرداخت ')).toBe(true);
    expect(title.trim().length).toBeGreaterThan(0);
  });
});
