import { describe, expect, it } from 'vitest';

import {
  NO_CAPABILITIES,
  decideOutboundAction,
  type AdapterCapabilities,
} from 'src/domain/accounting/capabilities';
import {
  buildAccountingOperationId,
  canRetryOperation,
  isEchoOfOwnWrite,
  isTerminalOperationState,
  type AccountingOperationIdentity,
} from 'src/domain/accounting/sync-operation';

const FULL: AdapterCapabilities = {
  items: {
    list: true,
    read: true,
    create: true,
    updateFields: 'ALL',
    delete: true,
    listPrices: true,
    readStock: true,
  },
  parties: {
    list: true,
    read: true,
    create: true,
    update: true,
    assignsOwnCode: true,
    returnsAssignedCode: true,
  },
  documents: {
    createProforma: true,
    createInvoice: true,
    readDocuments: true,
    readById: true,
    updateDocument: true,
    cancelDocument: true,
    remoteIdempotency: true,
    acceptsCallerDocumentNumber: true,
  },
  requiresSpecialItemCodes: false,
  transportIsSecure: true,
};

describe('outbound decisions', () => {
  it('sends an item create when the vendor can create', () => {
    expect(
      decideOutboundAction({
        intent: 'ITEM_CREATE',
        capabilities: FULL,
        hasExternalLink: false,
      }),
    ).toEqual({
      kind: 'SEND',
      intent: 'ITEM_CREATE',
      requiresReconciliationBeforeRetry: false,
    });
  });

  it('says manual export instead of pretending an unsupported create succeeded', () => {
    expect(
      decideOutboundAction({
        intent: 'ITEM_CREATE',
        capabilities: { ...FULL, items: { ...FULL.items, create: false } },
        hasExternalLink: false,
      }),
    ).toEqual({
      kind: 'MANUAL_EXPORT_REQUIRED',
      intent: 'ITEM_CREATE',
      reason: 'CAPABILITY_MISSING',
      detail: 'this destination cannot create items',
    });
  });

  it('allows a price-only change on a price-only vendor', () => {
    const decision = decideOutboundAction({
      intent: 'ITEM_UPDATE',
      capabilities: { ...FULL, items: { ...FULL.items, updateFields: 'PRICE_ONLY' } },
      hasExternalLink: true,
      changedFields: ['price'],
    });

    expect(decision.kind).toBe('SEND');
  });

  it('refuses a rename on a vendor that can only change prices', () => {
    // Asan's Products3/EditProduct silently ignores a name; reporting success would mean the
    // CRM believes a rename was published when it was not.
    const decision = decideOutboundAction({
      intent: 'ITEM_UPDATE',
      capabilities: { ...FULL, items: { ...FULL.items, updateFields: 'PRICE_ONLY' } },
      hasExternalLink: true,
      changedFields: ['price', 'name'],
    });

    expect(decision).toEqual({
      kind: 'MANUAL_EXPORT_REQUIRED',
      intent: 'ITEM_UPDATE',
      reason: 'FIELD_SCOPE_EXCLUDES_FIELDS',
      detail: expect.stringContaining('name'),
    });
  });

  it('refuses an update with no external link instead of creating a duplicate', () => {
    expect(
      decideOutboundAction({
        intent: 'ITEM_UPDATE',
        capabilities: FULL,
        hasExternalLink: false,
        changedFields: ['price'],
      }),
    ).toMatchObject({ kind: 'MANUAL_EXPORT_REQUIRED', reason: 'TARGET_NOT_LINKED' });
  });

  it('refuses a party update with no external link', () => {
    expect(
      decideOutboundAction({
        intent: 'PARTY_UPDATE',
        capabilities: FULL,
        hasExternalLink: false,
      }),
    ).toMatchObject({ kind: 'MANUAL_EXPORT_REQUIRED', reason: 'TARGET_NOT_LINKED' });
  });

  it('sends a party create and a pro-forma when supported', () => {
    expect(
      decideOutboundAction({
        intent: 'PARTY_CREATE',
        capabilities: FULL,
        hasExternalLink: false,
      }).kind,
    ).toBe('SEND');
    expect(
      decideOutboundAction({
        intent: 'PROFORMA_REGISTER',
        capabilities: FULL,
        hasExternalLink: true,
      }).kind,
    ).toBe('SEND');
  });

  it('marks a retry as needing reconciliation when the remote has no idempotency', () => {
    const decision = decideOutboundAction({
      intent: 'PROFORMA_REGISTER',
      capabilities: {
        ...FULL,
        documents: { ...FULL.documents, remoteIdempotency: false },
      },
      hasExternalLink: true,
    });

    expect(decision).toEqual({
      kind: 'SEND',
      intent: 'PROFORMA_REGISTER',
      requiresReconciliationBeforeRetry: true,
    });
  });

  it('treats a connection with no capabilities as manual export only', () => {
    expect(
      decideOutboundAction({
        intent: 'ITEM_CREATE',
        capabilities: NO_CAPABILITIES,
        hasExternalLink: false,
      }).kind,
    ).toBe('MANUAL_EXPORT_REQUIRED');
  });

  it('never reports an item deactivate as sent, because no vendor documents one', () => {
    expect(
      decideOutboundAction({
        intent: 'ITEM_DEACTIVATE',
        capabilities: FULL,
        hasExternalLink: true,
      }).kind,
    ).toBe('MANUAL_EXPORT_REQUIRED');
  });
});

describe('operation identity', () => {
  const identity: AccountingOperationIdentity = {
    connectionId: 'conn-1',
    kind: 'CATALOG_ITEM_UPDATE',
    internalEntityId: 'item-1',
    internalRevision: 2,
  };

  it('is a well-formed, deterministic uuid', () => {
    const first = buildAccountingOperationId(identity);

    expect(buildAccountingOperationId(identity)).toBe(first);
    expect(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        first,
      ),
    ).toBe(true);
  });

  it('gives a new revision a new operation', () => {
    expect(
      buildAccountingOperationId({ ...identity, internalRevision: 3 }),
    ).not.toBe(buildAccountingOperationId(identity));
  });

  it('keeps two connections independent for the same item', () => {
    expect(
      buildAccountingOperationId({ ...identity, connectionId: 'conn-2' }),
    ).not.toBe(buildAccountingOperationId(identity));
  });

  it('does not collide when an id contains the delimiter a naive join would use', () => {
    expect(
      buildAccountingOperationId({
        ...identity,
        internalEntityId: 'a::b',
        connectionId: 'c',
      }),
    ).not.toBe(
      buildAccountingOperationId({
        ...identity,
        internalEntityId: 'b',
        connectionId: 'a::c',
      }),
    );
  });
});

describe('operation lifecycle', () => {
  it('knows which states end the story', () => {
    expect(isTerminalOperationState('SUCCEEDED')).toBe(true);
    expect(isTerminalOperationState('FAILED_FINAL')).toBe(true);
    expect(isTerminalOperationState('MANUAL_EXPORT_REQUIRED')).toBe(true);
    expect(isTerminalOperationState('FAILED_RETRYABLE')).toBe(false);
    expect(isTerminalOperationState('IN_FLIGHT')).toBe(false);
  });

  it('retries only while attempts remain', () => {
    expect(
      canRetryOperation({ state: 'FAILED_RETRYABLE', attempts: 1 }, 3),
    ).toBe(true);
    expect(canRetryOperation({ state: 'FAILED_RETRYABLE', attempts: 3 }, 3)).toBe(
      false,
    );
    expect(canRetryOperation({ state: 'SUCCEEDED', attempts: 0 }, 3)).toBe(false);
  });
});

describe('echo suppression', () => {
  it('recognises an inbound event as the echo of our own write', () => {
    expect(
      isEchoOfOwnWrite({
        inboundCorrelationId: 'corr-1',
        outboundOperations: [{ correlationId: 'corr-1' }],
      }),
    ).toBe(true);
  });

  it('treats an unrelated correlation as a real change', () => {
    expect(
      isEchoOfOwnWrite({
        inboundCorrelationId: 'corr-2',
        outboundOperations: [{ correlationId: 'corr-1' }],
      }),
    ).toBe(false);
  });

  it('does not suppress an event that carries no correlation', () => {
    expect(
      isEchoOfOwnWrite({
        inboundCorrelationId: null,
        outboundOperations: [{ correlationId: 'corr-1' }],
      }),
    ).toBe(false);
  });
});
