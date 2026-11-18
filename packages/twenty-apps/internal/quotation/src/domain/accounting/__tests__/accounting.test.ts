import { describe, expect, it } from 'vitest';

import {
  NO_ITEM_CAPABILITIES,
  decideOutboundItemAction,
  type AccountingItemCapabilities,
} from 'src/domain/accounting/capabilities';
import {
  buildAccountingOperationId,
  canRetryOperation,
  isEchoOfOwnWrite,
  isTerminalOperationState,
  type AccountingOperationIdentity,
} from 'src/domain/accounting/sync-operation';
import { type AccountingItemLink } from 'src/domain/catalog/item-link';

const FULL_CAPABILITIES: AccountingItemCapabilities = {
  listItems: true,
  getItem: true,
  createItem: true,
  updateItem: true,
  listPrices: true,
  readStock: true,
  webhooks: true,
  externalIdempotency: true,
};

const linkedItem = (externalItemId: string | null): AccountingItemLink => ({
  internalItemId: 'item-1',
  connectionId: 'conn-1',
  externalItemId,
  externalCode: null,
  remoteVersion: null,
  lastSyncedAt: null,
  syncStatus: externalItemId === null ? 'PENDING_PUSH' : 'LINKED',
});

describe('outbound item decisions', () => {
  it('sends a create when the vendor can create', () => {
    expect(
      decideOutboundItemAction({
        intent: 'CREATE',
        link: null,
        capabilities: FULL_CAPABILITIES,
      }),
    ).toEqual({
      kind: 'SEND',
      intent: 'CREATE',
      requiresExternalIdempotency: false,
    });
  });

  it('says manual export instead of pretending a create succeeded', () => {
    const decision = decideOutboundItemAction({
      intent: 'CREATE',
      link: null,
      capabilities: { ...FULL_CAPABILITIES, createItem: false },
    });

    expect(decision).toEqual({
      kind: 'MANUAL_EXPORT_REQUIRED',
      intent: 'CREATE',
      missingCapability: 'createItem',
    });
  });

  it('says manual export when the vendor cannot update', () => {
    const decision = decideOutboundItemAction({
      intent: 'UPDATE',
      link: linkedItem('ext-9'),
      capabilities: { ...FULL_CAPABILITIES, updateItem: false },
    });

    expect(decision.kind).toBe('MANUAL_EXPORT_REQUIRED');
  });

  it('refuses to update an item that has no link yet', () => {
    // Without a link there is nothing to update; treating it as a create would
    // produce a second copy of the item in accounting.
    const decision = decideOutboundItemAction({
      intent: 'UPDATE',
      link: linkedItem(null),
      capabilities: FULL_CAPABILITIES,
    });

    expect(decision.kind).toBe('MANUAL_EXPORT_REQUIRED');
  });

  it('flags operations that cannot be made idempotent by the remote', () => {
    const decision = decideOutboundItemAction({
      intent: 'CREATE',
      link: null,
      capabilities: { ...FULL_CAPABILITIES, externalIdempotency: false },
    });

    expect(decision).toEqual({
      kind: 'SEND',
      intent: 'CREATE',
      requiresExternalIdempotency: true,
    });
  });

  it('treats a connection with no capabilities as manual export only', () => {
    expect(
      decideOutboundItemAction({
        intent: 'CREATE',
        link: null,
        capabilities: NO_ITEM_CAPABILITIES,
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
    const second = buildAccountingOperationId(identity);

    expect(first).toBe(second);
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

  it('separates the kinds of write', () => {
    expect(
      buildAccountingOperationId({ ...identity, kind: 'CATALOG_ITEM_DEACTIVATE' }),
    ).not.toBe(buildAccountingOperationId(identity));
  });

  it('does not collide when an id contains the delimiter a naive join would use', () => {
    const left = buildAccountingOperationId({
      ...identity,
      internalEntityId: 'a::b',
      connectionId: 'c',
    });
    const right = buildAccountingOperationId({
      ...identity,
      internalEntityId: 'b',
      connectionId: 'a::c',
    });

    expect(left).not.toBe(right);
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
    expect(
      canRetryOperation({ state: 'FAILED_RETRYABLE', attempts: 3 }, 3),
    ).toBe(false);
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
