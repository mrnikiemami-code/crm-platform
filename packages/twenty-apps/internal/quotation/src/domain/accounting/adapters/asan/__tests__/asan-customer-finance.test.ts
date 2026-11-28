import { describe, expect, it } from 'vitest';
import { buildCardexDateBounds, isExactAsanPositiveLong, parseCustomerCardex, parseCustomerFinanceSummary } from 'src/domain/accounting/adapters/asan/asan-customer-finance';
import { isApprovedAsanRead } from 'src/domain/accounting/adapters/asan/asan-approved-transport';

const binding = { connectionId: 'fixture', baseUrl: 'https://gateway.example/api', ipv4: '93.184.216.34' };
const cardex = { PersonCode: '42', Row: 1, ShowDate: '۱۴۰۵/۰۹/۰۷', Description: 'سند آزمایشی', FactorType: 'فاکتور',
  show_Bedehkar: '۱٬۲۳۴', show_Bestankar: '۰', show_Mande: '۱٬۲۳۴' };

describe('restricted Asan customer finance observations', () => {
  it('uses exact .NET ticks and rejects invalid dates or oversized ranges', () => {
    expect(buildCardexDateBounds('1970-01-01', '1970-01-01')).toEqual({
      ok: true, value: { FromDate: '621355968000000000', ToDate: '621356831999999999' },
    });
    for (const [from, to] of [['2026-02-30', '2026-03-02'], ['2026-11-28', '2026-11-27'], ['2026-01-01', '2026-04-04']]) {
      expect(buildCardexDateBounds(from, to).ok).toBe(false);
    }
    expect(isExactAsanPositiveLong('9223372036854775807')).toBe(true);
    expect(isExactAsanPositiveLong('9223372036854775808')).toBe(false);
  });

  it('separates vendor monetary text, JSON numbers, zero, missing and unsafe values', () => {
    expect(parseCustomerFinanceSummary([{ Code: '42', Remain: '-0.25', BookCredit: 0,
      ChequeCredit: Number.MAX_SAFE_INTEGER + 1, SettlementDays: 30 }], '42')).toEqual({
      ok: true, value: { customerExternalId: '42',
        remain: { reportedText: '-0.25', representation: 'VENDOR_TEXT' },
        bookCredit: { reportedText: '0', representation: 'JSON_NUMBER' },
        chequeCredit: null, settlementDays: 30 },
    });
    expect(parseCustomerFinanceSummary([{ Code: '42', PersonCode: '43' }], '42').ok).toBe(false);
    expect(parseCustomerFinanceSummary([{ Code: '42' }, { Code: '42' }], '42').ok).toBe(false);
  });

  it('preserves original formatted balances without synthesizing totals', () => {
    expect(parseCustomerCardex([cardex], '42')).toMatchObject({ ok: true, value: [{
      rowNumber: 1, debitText: '۱٬۲۳۴', creditText: '۰', balanceText: '۱٬۲۳۴',
    }] });
    expect(parseCustomerCardex([{ ...cardex, PersonCode: '43' }], '42').ok).toBe(false);
    expect(parseCustomerCardex([{ ...cardex, show_Mande: null }], '42').ok).toBe(false);
    expect(parseCustomerCardex(Array.from({ length: 501 }, () => cardex), '42').ok).toBe(false);
  });

  it('permits only bounded Cardex GET at the pinned origin and rejects duplicate/extra parameters', () => {
    const bounds = buildCardexDateBounds('2026-11-01', '2026-11-28');
    if (!bounds.ok) throw new Error('fixture bounds');
    const path = binding.baseUrl + '/CustomerCardex?CustomerCode=42&FromDate=' + bounds.value.FromDate + '&ToDate=' + bounds.value.ToDate;
    expect(isApprovedAsanRead(binding, path, 'GET')).toBe(true);
    expect(isApprovedAsanRead(binding, path, 'POST')).toBe(false);
    expect(isApprovedAsanRead(binding, path + '&CustomerCode=43', 'GET')).toBe(false);
    expect(isApprovedAsanRead(binding, path + '&All=true', 'GET')).toBe(false);
    expect(isApprovedAsanRead(binding, binding.baseUrl + '/CustomerCardex?CustomerCode=42', 'GET')).toBe(false);
    expect(isApprovedAsanRead(binding, binding.baseUrl + '/CustomerCardex?CustomerCode=42&FromDate=621355968000000000&ToDate=3155378975999999999', 'GET')).toBe(false);
    expect(isApprovedAsanRead(binding, path.replace('gateway.example', 'other.example'), 'GET')).toBe(false);
    expect(isApprovedAsanRead(binding, binding.baseUrl + '/PishFactors/RegisterPishFactor', 'POST')).toBe(false);
  });
});
