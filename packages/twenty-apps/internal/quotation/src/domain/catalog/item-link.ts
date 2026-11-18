// The link between a CRM catalog item and its counterpart in one accounting
// package. Separate from the item because the same item can be linked in two
// connections, and because unlinking must not delete the item.
//
// IDENTITY: an external item is identified by (connectionId, externalItemId). A SKU
// or a name is NEVER used to match, because the first renames or duplicates and the
// second collides across suppliers — matching on them is how two products become one.
export type SyncDirection = 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';

export const ACCOUNTING_ITEM_SYNC_STATUSES = [
  'LINKED',
  'PENDING_PUSH',
  'PENDING_IMPORT',
  'CONFLICT',
  'MANUAL_EXPORT_REQUIRED',
  'REMOTE_DELETED',
] as const;

export type AccountingItemSyncStatus =
  (typeof ACCOUNTING_ITEM_SYNC_STATUSES)[number];

export type AccountingItemLink = {
  internalItemId: string;
  connectionId: string;
  externalItemId: string | null;
  externalCode: string | null;
  // The remote's own change marker (etag, version, updatedAt). Used to detect that
  // the record moved under us between read and write.
  remoteVersion: string | null;
  lastSyncedAt: string | null;
  syncStatus: AccountingItemSyncStatus;
};

export type ExternalItemIdentity = {
  connectionId: string;
  externalItemId: string;
};

export const isSameExternalItem = (
  left: ExternalItemIdentity,
  right: ExternalItemIdentity,
): boolean =>
  left.connectionId === right.connectionId &&
  left.externalItemId === right.externalItemId;

export type LinkKey = {
  connectionId: string;
  internalItemId: string;
};

// One CRM item can only be linked once per connection. Two links for the same pair
// would mean two rows answering "what is this item over there", and a push could
// then create a duplicate in accounting.
export const buildLinkKey = (link: LinkKey): string =>
  `${link.connectionId}::${link.internalItemId}`;

export const findDuplicateLinkKeys = (
  links: { connectionId: string; internalItemId: string }[],
): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const link of links) {
    const key = buildLinkKey(link);

    if (seen.has(key)) {
      duplicates.add(key);
    }

    seen.add(key);
  }

  return [...duplicates];
};

// A remote version that differs from the one we last synced means the accounting
// package changed the record since we read it. Writing over it without checking
// would discard that change, so the caller must re-read instead.
export const hasRemoteVersionDrifted = ({
  link,
  observedRemoteVersion,
}: {
  link: AccountingItemLink;
  observedRemoteVersion: string | null;
}): boolean => {
  if (link.remoteVersion === null) {
    return false;
  }

  return observedRemoteVersion !== link.remoteVersion;
};
