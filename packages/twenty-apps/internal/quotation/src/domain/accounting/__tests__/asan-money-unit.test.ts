import { describe, expect, it } from 'vitest';

import {
  asanUnitsToCrmMicros,
  crmMicrosToAsanUnits,
  formatCrmMicrosForVendor,
  moneyUnitLabel,
} from 'src/domain/accounting/adapters/asan/asan-money-unit';

// 1 rial = 1,000,000 micros; 1 toman = 10 rials.
const ONE_RIAL = 1_000_000n;
const ONE_TOMAN = 10_000_000n;

describe('crm micros to vendor units', () => {
  it('refuses every conversion while the unit is unconfirmed', () => {
    expect(crmMicrosToAsanUnits(ONE_RIAL, 'UNCONFIRMED')).toMatchObject({
      ok: false,
      refusal: { code: 'MONEY_UNIT_UNCONFIRMED' },
    });
    expect(asanUnitsToCrmMicros(1000, 'UNCONFIRMED')).toMatchObject({
      ok: false,
      refusal: { code: 'MONEY_UNIT_UNCONFIRMED' },
    });
  });

  it('sends whole rials when the vendor unit is rial', () => {
    expect(crmMicrosToAsanUnits(450_000n * ONE_RIAL, 'RIAL')).toEqual({
      ok: true,
      value: 450_000,
    });
  });

  it('sends one tenth of the rial figure when the vendor unit is toman', () => {
    expect(crmMicrosToAsanUnits(450_000n * ONE_RIAL, 'TOMAN')).toEqual({
      ok: true,
      value: 45_000,
    });
  });

  it('refuses a fraction of the vendor unit instead of rounding the payable', () => {
    expect(crmMicrosToAsanUnits(ONE_RIAL + 1n, 'RIAL')).toMatchObject({
      ok: false,
      refusal: { code: 'AMOUNT_NOT_WHOLE_UNIT' },
    });
    expect(crmMicrosToAsanUnits(ONE_RIAL / 2n, 'TOMAN')).toMatchObject({
      ok: false,
      refusal: { code: 'AMOUNT_NOT_WHOLE_UNIT' },
    });
  });

  it('refuses an amount beyond the exact JSON number range', () => {
    const huge = (BigInt(Number.MAX_SAFE_INTEGER) + 1n) * ONE_RIAL;

    expect(crmMicrosToAsanUnits(huge, 'RIAL')).toMatchObject({
      ok: false,
      refusal: { code: 'AMOUNT_OUT_OF_RANGE' },
    });
  });
});

describe('vendor units to crm micros', () => {
  it('turns a rial price into micros', () => {
    expect(asanUnitsToCrmMicros(450_000, 'RIAL')).toEqual({
      ok: true,
      value: 450_000n * ONE_RIAL,
    });
  });

  it('treats a toman price as ten rials', () => {
    expect(asanUnitsToCrmMicros(45_000, 'TOMAN')).toEqual({
      ok: true,
      value: 450_000n * ONE_RIAL,
    });
    expect(ONE_TOMAN).toBe(ONE_RIAL * 10n);
  });

  it('refuses a non-integer vendor price', () => {
    expect(asanUnitsToCrmMicros(10.5, 'RIAL')).toMatchObject({
      ok: false,
      refusal: { code: 'AMOUNT_NOT_A_DECIMAL' },
    });
  });
});

describe('vendor formatting', () => {
  it('labels the configured unit', () => {
    expect(moneyUnitLabel('RIAL')).toBe('ریال');
    expect(moneyUnitLabel('TOMAN')).toBe('تومان');
    expect(moneyUnitLabel('UNCONFIRMED')).toContain('تأیید');
  });

  it('does not print a converted amount while the unit is unconfirmed', () => {
    const text = formatCrmMicrosForVendor(ONE_RIAL, 'UNCONFIRMED');

    expect(text).toContain('تأیید نشده');
    expect(text).toContain('1.000000');
  });
});
