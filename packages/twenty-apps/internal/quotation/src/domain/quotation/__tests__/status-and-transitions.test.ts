import { describe, expect, it } from 'vitest';

import {
  QUOTATION_STATUSES,
  TERMINAL_QUOTATION_STATUSES,
  canEditQuotationLines,
  type QuotationStatus,
} from 'src/domain/quotation/status';
import {
  QUOTATION_TRANSITIONS,
  checkTransition,
  findTransition,
  findUnreachableStatuses,
  type QuotationPermission,
} from 'src/domain/quotation/transitions';

const ALL_PERMISSIONS: QuotationPermission[] = [
  'quotation.edit',
  'quotation.submitForApproval',
  'quotation.approve',
  'quotation.send',
  'quotation.recordCustomerDecision',
  'quotation.cancel',
  'quotation.convertToInvoice',
  'quotation.expire',
];

const refusalCode = (result: { ok: boolean } & Record<string, unknown>): string => {
  const refusal = result.refusal as { code: string } | undefined;

  return refusal?.code ?? 'NO_REFUSAL';
};

describe('quotation status model', () => {
  it('treats every terminal status as a dead end', () => {
    for (const status of TERMINAL_QUOTATION_STATUSES) {
      expect(canEditQuotationLines(status)).toBe(false);
    }
  });

  it('freezes lines once the document can be sent', () => {
    expect(canEditQuotationLines('DRAFT')).toBe(true);
    expect(canEditQuotationLines('PENDING_INTERNAL_APPROVAL')).toBe(true);
    expect(canEditQuotationLines('READY_TO_SEND')).toBe(false);
    expect(canEditQuotationLines('SENT')).toBe(false);
  });

  it('has no status that nothing can reach', () => {
    expect(findUnreachableStatuses()).toEqual([]);
  });

  it('declares an edge only for statuses it lists', () => {
    for (const transition of QUOTATION_TRANSITIONS) {
      expect(QUOTATION_STATUSES).toContain(transition.from);
      expect(QUOTATION_STATUSES).toContain(transition.to);
    }
  });
});

describe('transitions', () => {
  it('walks the happy path', () => {
    const path: QuotationStatus[] = [
      'DRAFT',
      'PENDING_INTERNAL_APPROVAL',
      'READY_TO_SEND',
      'SENT',
      'CUSTOMER_ACCEPTED',
      'CONVERTED',
    ];

    for (let index = 0; index < path.length - 1; index += 1) {
      const step = `${path[index]} -> ${path[index + 1]}`;
      const result = checkTransition({
        from: path[index],
        to: path[index + 1],
        heldPermissions: ALL_PERMISSIONS,
      });

      if (!result.ok) {
        throw new Error(`${step} was refused: ${result.refusal.code}`);
      }

      expect(result.value.from).toBe(path[index]);
    }
  });

  it('refuses an edge that does not exist', () => {
    const result = checkTransition({
      from: 'DRAFT',
      to: 'SENT',
      heldPermissions: ALL_PERMISSIONS,
    });

    expect(refusalCode(result)).toBe('TRANSITION_NOT_ALLOWED');
  });

  it('refuses a self transition instead of treating it as a no-op', () => {
    const result = checkTransition({
      from: 'SENT',
      to: 'SENT',
      heldPermissions: ALL_PERMISSIONS,
    });

    expect(refusalCode(result)).toBe('TRANSITION_NOT_ALLOWED');
  });

  it('refuses every edge out of a terminal status', () => {
    for (const from of TERMINAL_QUOTATION_STATUSES) {
      for (const to of QUOTATION_STATUSES) {
        const result = checkTransition({
          from,
          to,
          heldPermissions: ALL_PERMISSIONS,
        });

        if (result.ok) {
          throw new Error(`${from} -> ${to} was wrongly allowed`);
        }

        expect(result.refusal.code).toBe('QUOTATION_ALREADY_TERMINAL');
      }
    }
  });

  it('refuses an approval without the approval permission', () => {
    const result = checkTransition({
      from: 'PENDING_INTERNAL_APPROVAL',
      to: 'READY_TO_SEND',
      heldPermissions: ['quotation.edit'],
    });

    expect(refusalCode(result)).toBe('PERMISSION_MISSING');
  });

  it('sends back to draft when an approver rejects', () => {
    expect(
      findTransition('PENDING_INTERNAL_APPROVAL', 'DRAFT')?.requiredPermission,
    ).toBe('quotation.approve');
  });

  it('never lets a draft jump to converted', () => {
    expect(findTransition('DRAFT', 'CONVERTED')).toBeUndefined();
  });

  it('refuses conversion unless the customer accepted', () => {
    expect(findTransition('SENT', 'CONVERTED')).toBeUndefined();
    expect(findTransition('CUSTOMER_ACCEPTED', 'CONVERTED')).toBeDefined();
  });
});
