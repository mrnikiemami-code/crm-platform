import {
  evaluateQuotationDelete,
  evaluateQuotationLineMutation,
  evaluateQuotationUpdate,
} from 'src/modules/quotation/utils/quotation-immutability.util';

describe('quotation-immutability.util', () => {
  it('allows content edits on DRAFT', () => {
    expect(
      evaluateQuotationUpdate({
        currentStatus: 'DRAFT',
        patch: { name: 'new', totalExact: '1.000000', personId: 'p1' },
      }).ok,
    ).toBe(true);
  });

  it('refuses content edits on SENT while allowing legal status transition', () => {
    const content = evaluateQuotationUpdate({
      currentStatus: 'SENT',
      patch: { name: 'mutated-after-sent' },
    });

    expect(content.ok).toBe(false);
    if (!content.ok) {
      expect(content.code).toBe('QUOTATION_IMMUTABLE');
    }

    const lifecycle = evaluateQuotationUpdate({
      currentStatus: 'SENT',
      patch: { status: 'CUSTOMER_ACCEPTED', decidedAt: '2026-11-19T00:00:00.000Z' },
    });

    expect(lifecycle.ok).toBe(true);
  });

  it('refuses illegal status transitions', () => {
    const decision = evaluateQuotationUpdate({
      currentStatus: 'SENT',
      patch: { status: 'DRAFT' },
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe('TRANSITION_NOT_ALLOWED');
    }
  });

  it('freezes lines once the quotation is past internal editing', () => {
    expect(
      evaluateQuotationLineMutation({ parentStatus: 'READY_TO_SEND' }).ok,
    ).toBe(false);
    expect(evaluateQuotationLineMutation({ parentStatus: 'SENT' }).ok).toBe(
      false,
    );
    expect(evaluateQuotationLineMutation({ parentStatus: 'DRAFT' }).ok).toBe(
      true,
    );
  });

  it('refuses delete of a sent quotation', () => {
    const decision = evaluateQuotationDelete({ currentStatus: 'SENT' });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe('QUOTATION_IMMUTABLE');
    }
  });

  it('refuses any change on terminal statuses', () => {
    const decision = evaluateQuotationUpdate({
      currentStatus: 'CONVERTED',
      patch: { status: 'CANCELLED' },
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe('QUOTATION_ALREADY_TERMINAL');
    }
  });
});
