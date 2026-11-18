import { type AccountingItemLink } from 'src/domain/catalog/item-link';

// What an accounting package can actually do. A vendor that can list products but
// not create them must say so, because the alternative is a CRM that shows
// "published" for a record that never left the building.
export type AccountingItemCapabilities = {
  listItems: boolean;
  getItem: boolean;
  createItem: boolean;
  updateItem: boolean;
  listPrices: boolean;
  readStock: boolean;
  webhooks: boolean;
  // Whether the remote honours a caller-supplied idempotency key. Without it, a
  // retry after a timeout can create a duplicate, so the operation must be recorded
  // as needing reconciliation rather than retried blindly.
  externalIdempotency: boolean;
};

export const NO_ITEM_CAPABILITIES: AccountingItemCapabilities = {
  listItems: false,
  getItem: false,
  createItem: false,
  updateItem: false,
  listPrices: false,
  readStock: false,
  webhooks: false,
  externalIdempotency: false,
};

export type OutboundItemIntent = 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'NONE';

export type OutboundItemDecision =
  | { kind: 'SEND'; intent: OutboundItemIntent; requiresExternalIdempotency: boolean }
  | {
      kind: 'MANUAL_EXPORT_REQUIRED';
      intent: OutboundItemIntent;
      missingCapability: keyof AccountingItemCapabilities;
    };

// Maps the intended change to what the connection can do. `MANUAL_EXPORT_REQUIRED`
// is a first-class outcome rather than an error: the item is queued for a human to
// export through the vendor's own screen, and the UI says exactly that.
export const decideOutboundItemAction = ({
  intent,
  link,
  capabilities,
}: {
  intent: OutboundItemIntent;
  link: AccountingItemLink | null;
  capabilities: AccountingItemCapabilities;
}): OutboundItemDecision => {
  if (intent === 'NONE') {
    return { kind: 'SEND', intent: 'NONE', requiresExternalIdempotency: false };
  }

  if (intent === 'CREATE' && !capabilities.createItem) {
    return {
      kind: 'MANUAL_EXPORT_REQUIRED',
      intent,
      missingCapability: 'createItem',
    };
  }

  if ((intent === 'UPDATE' || intent === 'DEACTIVATE') && !capabilities.updateItem) {
    return {
      kind: 'MANUAL_EXPORT_REQUIRED',
      intent,
      missingCapability: 'updateItem',
    };
  }

  // An update without a link has nothing to update; the caller should have asked to
  // create. Saying so prevents a push that silently creates a duplicate.
  if (intent !== 'CREATE' && link?.externalItemId == null) {
    return {
      kind: 'MANUAL_EXPORT_REQUIRED',
      intent,
      missingCapability: 'getItem',
    };
  }

  return {
    kind: 'SEND',
    intent,
    requiresExternalIdempotency: !capabilities.externalIdempotency,
  };
};
