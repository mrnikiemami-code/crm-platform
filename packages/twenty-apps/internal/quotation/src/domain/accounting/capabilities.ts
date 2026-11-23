// What an accounting adapter can actually do, in three groups. The grouping is not
// cosmetic: item writes, party writes and document writes have different failure costs, so
// a caller must be able to ask about one without the others being implied.
//
// Every field answers a question a caller would otherwise learn by failing:
//   - can I read the catalog at all?
//   - can I create an item, or only import it?
//   - if I can update an item, WHICH fields? (A vendor that only accepts prices must not
//     let the CRM believe a renamed product was published.)
//   - can I create a customer, or must one exist first?
//   - can I register a pro-forma, and does it come back with a number I can trust?

export type ItemCapabilities = {
  list: boolean;
  read: boolean;
  create: boolean;
  updateFields: ItemFieldEditScope;
  delete: boolean;
  listPrices: boolean;
  readStock: boolean;
};

// The scope of an update, as a closed set. `PRICE_ONLY` is a first-class value, not an
// "update: true" with a footnote: a vendor that silently ignores a name change would
// otherwise report success for a write that never happened.
export const ITEM_FIELD_EDIT_SCOPES = ['ALL', 'PRICE_ONLY', 'NONE'] as const;

export type ItemFieldEditScope = (typeof ITEM_FIELD_EDIT_SCOPES)[number];

export type PartyCapabilities = {
  list: boolean;
  read: boolean;
  create: boolean;
  update: boolean;
  // Whether the remote assigns the code itself. When false, the caller must supply one and
  // is responsible for uniqueness.
  assignsOwnCode: boolean;
  // Whether a create returns the assigned identifier, or only a success flag.
  returnsAssignedCode: boolean;
};

export type DocumentCapabilities = {
  // A pro-forma is a request for approval; an invoice is a posted fiscal document. They
  // are separate capabilities because writing one must never be read as writing the other.
  createProforma: boolean;
  createInvoice: boolean;
  readDocuments: boolean;
  readById: boolean;
  updateDocument: boolean;
  cancelDocument: boolean;
  // Whether the remote can be trusted to deduplicate a retried create on its own. When
  // false, a retry after an ambiguous timeout needs reconciliation before it is repeated.
  remoteIdempotency: boolean;
  // Whether the remote honours a caller-chosen document number.
  acceptsCallerDocumentNumber: boolean;
};

// How a destination hands over its long lists, decided by what its API can actually do.
//
// REMOTE_PAGED   the destination accepts a cursor/offset/limit, so page N is fetched from
//                the destination itself.
// REMOTE_UNPAGED the destination answers a whole list in one response and documents no
//                cursor, offset or page token. The rows are ingested once, bounded, into a
//                local snapshot, and the CRM pages inside that snapshot.
//
// This is a capability, not a per-call decision: it is declared once per adapter and read
// by the mapping service. The screens read one page shape either way, so a person never
// sees a different interface because a vendor pages differently.
export const REMOTE_READ_STRATEGIES = [
  'REMOTE_PAGED',
  'REMOTE_UNPAGED',
] as const;

export type RemoteReadStrategy = (typeof REMOTE_READ_STRATEGIES)[number];

export const isRemoteReadStrategy = (
  value: unknown,
): value is RemoteReadStrategy =>
  typeof value === 'string' &&
  (REMOTE_READ_STRATEGIES as readonly string[]).includes(value);

export type AdapterCapabilities = {
  items: ItemCapabilities;
  parties: PartyCapabilities;
  documents: DocumentCapabilities;
  // How long lists are read. A `REMOTE_UNPAGED` adapter must be ingested through the
  // bounded snapshot reader; treating it as paged would re-download the whole list per
  // page, which is the unbounded path the scale gate forbids.
  readStrategy: RemoteReadStrategy;
  // Whether the vendor needs pre-existing special item codes (a discount line, a tax line)
  // rather than accepting tax and discount as fields on a normal line.
  requiresSpecialItemCodes: boolean;
  // What the destination's documented contract can carry for tax and for currency. Declared
  // per adapter, never read from a caller: a panel that could claim "this vendor takes a
  // rate" would silently drop the fiscal code the vendor actually needs.
  taxHandling: TaxHandlingMode;
  currencyHandling: CurrencyHandlingMode;
  // The currency the destination books in when `currencyHandling` is `SINGLE_CURRENCY`.
  // Empty for adapters that take a code; there is nothing to declare.
  baseCurrency: string;
  // Whether the transport itself provides confidentiality. False means the connector needs
  // an approved tunnel, because credentials would otherwise cross a network in clear text.
  transportIsSecure: boolean;
};

// How a destination wants tax expressed. These are five different contracts, not a
// preference: a vendor that takes a rate has no field for a fiscal code, and a vendor that
// takes a code will post the wrong tax if a rate is sent in its place.
//
//   TAX_RATE             the destination expects a percentage and computes the amount itself
//   TAX_AMOUNT           the destination expects the already-computed tax amount
//   TAX_CODE             the destination expects its own fiscal tax code and no amount
//   TAX_CODE_AND_AMOUNT  the destination needs both the code and the amount
//   UNSUPPORTED          the documented contract cannot carry this document's tax at all
export const TAX_HANDLING_MODES = [
  'TAX_RATE',
  'TAX_AMOUNT',
  'TAX_CODE',
  'TAX_CODE_AND_AMOUNT',
  'UNSUPPORTED',
] as const;

export type TaxHandlingMode = (typeof TAX_HANDLING_MODES)[number];

export const isTaxHandlingMode = (value: unknown): value is TaxHandlingMode =>
  typeof value === 'string' &&
  (TAX_HANDLING_MODES as readonly string[]).includes(value);

// How a destination wants the document currency expressed. Under `SINGLE_CURRENCY` the
// destination books everything in one currency and has no field for a code, so asking an
// accountant to type one would invent a requirement the vendor never had.
export const CURRENCY_HANDLING_MODES = [
  'SINGLE_CURRENCY',
  'CURRENCY_CODE',
  'CURRENCY_NAME',
  'CURRENCY_CODE_AND_RATE',
  'UNSUPPORTED',
] as const;

export type CurrencyHandlingMode = (typeof CURRENCY_HANDLING_MODES)[number];

export const isCurrencyHandlingMode = (
  value: unknown,
): value is CurrencyHandlingMode =>
  typeof value === 'string' &&
  (CURRENCY_HANDLING_MODES as readonly string[]).includes(value);

// True when the destination identifies tax by its own code, so a CRM tax policy must be
// mapped to a vendor code before a taxed document can travel. A rate or amount destination
// reads the rate/amount from the document and must NOT be forced to invent a code.
export const taxModeNeedsVendorCode = (mode: TaxHandlingMode): boolean =>
  mode === 'TAX_CODE' || mode === 'TAX_CODE_AND_AMOUNT';

export const taxModeNeedsAmount = (mode: TaxHandlingMode): boolean =>
  mode === 'TAX_AMOUNT' || mode === 'TAX_CODE_AND_AMOUNT';

export const taxModeNeedsRate = (mode: TaxHandlingMode): boolean =>
  mode === 'TAX_RATE';

export const currencyModeNeedsVendorValue = (
  mode: CurrencyHandlingMode,
): boolean =>
  mode === 'CURRENCY_CODE' ||
  mode === 'CURRENCY_NAME' ||
  mode === 'CURRENCY_CODE_AND_RATE';

export const currencyModeNeedsRate = (mode: CurrencyHandlingMode): boolean =>
  mode === 'CURRENCY_CODE_AND_RATE';

export const NO_CAPABILITIES: AdapterCapabilities = {
  items: {
    list: false,
    read: false,
    create: false,
    updateFields: 'NONE',
    delete: false,
    listPrices: false,
    readStock: false,
  },
  parties: {
    list: false,
    read: false,
    create: false,
    update: false,
    assignsOwnCode: false,
    returnsAssignedCode: false,
  },
  documents: {
    createProforma: false,
    createInvoice: false,
    readDocuments: false,
    readById: false,
    updateDocument: false,
    cancelDocument: false,
    remoteIdempotency: false,
    acceptsCallerDocumentNumber: false,
  },
  requiresSpecialItemCodes: true,
  transportIsSecure: false,
  // An adapter that declares no financial contract cannot receive tax or a currency code.
  // Fail closed: without a declaration, a taxed document is refused rather than sent
  // without its tax.
  taxHandling: 'UNSUPPORTED',
  currencyHandling: 'SINGLE_CURRENCY',
  baseCurrency: '',
  // The conservative default: an adapter that declares nothing is ingested through the
  // bounded snapshot path rather than trusted to page.
  readStrategy: 'REMOTE_UNPAGED',
};

export type OutboundIntent =
  | 'ITEM_CREATE'
  | 'ITEM_UPDATE'
  | 'ITEM_DEACTIVATE'
  | 'PARTY_CREATE'
  | 'PARTY_UPDATE'
  | 'PROFORMA_REGISTER'
  | 'NONE';

export type OutboundDecision =
  | {
      kind: 'SEND';
      intent: OutboundIntent;
      // The caller must reconcile before retrying, because a retried create could duplicate.
      requiresReconciliationBeforeRetry: boolean;
    }
  | {
      kind: 'MANUAL_EXPORT_REQUIRED';
      intent: OutboundIntent;
      reason:
        | 'CAPABILITY_MISSING'
        | 'FIELD_SCOPE_EXCLUDES_FIELDS'
        | 'TARGET_NOT_LINKED';
      detail: string;
    };

// Decides whether a write can be attempted, and says WHY when it cannot. A refused write is
// a first-class outcome: it becomes an explicit "needs manual export" state a person can
// act on, never a silent success.
export const decideOutboundAction = ({
  intent,
  capabilities,
  hasExternalLink,
  changedFields,
}: {
  intent: OutboundIntent;
  capabilities: AdapterCapabilities;
  // Required for anything that updates rather than creates.
  hasExternalLink: boolean;
  // The item fields this write intends to change, so a price-only vendor can be told apart
  // from a full-field vendor.
  changedFields?: string[];
}): OutboundDecision => {
  const reconciliation = !capabilities.documents.remoteIdempotency;

  switch (intent) {
    case 'NONE':
      return {
        kind: 'SEND',
        intent: 'NONE',
        requiresReconciliationBeforeRetry: false,
      };

    case 'ITEM_CREATE':
      return capabilities.items.create
        ? { kind: 'SEND', intent, requiresReconciliationBeforeRetry: reconciliation }
        : {
            kind: 'MANUAL_EXPORT_REQUIRED',
            intent,
            reason: 'CAPABILITY_MISSING',
            detail: 'this destination cannot create items',
          };

    case 'ITEM_UPDATE': {
      if (!hasExternalLink) {
        return {
          kind: 'MANUAL_EXPORT_REQUIRED',
          intent,
          reason: 'TARGET_NOT_LINKED',
          detail: 'the item has no counterpart in this destination yet',
        };
      }

      if (capabilities.items.updateFields === 'NONE') {
        return {
          kind: 'MANUAL_EXPORT_REQUIRED',
          intent,
          reason: 'CAPABILITY_MISSING',
          detail: 'this destination cannot update items',
        };
      }

      if (capabilities.items.updateFields === 'PRICE_ONLY') {
        const unsupported = (changedFields ?? []).filter(
          (field) => field !== 'price',
        );

        if (unsupported.length > 0) {
          return {
            kind: 'MANUAL_EXPORT_REQUIRED',
            intent,
            reason: 'FIELD_SCOPE_EXCLUDES_FIELDS',
            detail: `this destination can only change prices, but the change also touches: ${unsupported.join(', ')}`,
          };
        }
      }

      return {
        kind: 'SEND',
        intent,
        requiresReconciliationBeforeRetry: reconciliation,
      };
    }

    case 'ITEM_DEACTIVATE':
      return {
        kind: 'MANUAL_EXPORT_REQUIRED',
        intent,
        reason: 'CAPABILITY_MISSING',
        detail:
          'this destination documents no delete or deactivate operation; deactivate it there',
      };

    case 'PARTY_CREATE':
      return capabilities.parties.create
        ? { kind: 'SEND', intent, requiresReconciliationBeforeRetry: reconciliation }
        : {
            kind: 'MANUAL_EXPORT_REQUIRED',
            intent,
            reason: 'CAPABILITY_MISSING',
            detail: 'this destination cannot create parties',
          };

    case 'PARTY_UPDATE': {
      if (!hasExternalLink) {
        return {
          kind: 'MANUAL_EXPORT_REQUIRED',
          intent,
          reason: 'TARGET_NOT_LINKED',
          detail: 'the party has no counterpart in this destination yet',
        };
      }

      return capabilities.parties.update
        ? { kind: 'SEND', intent, requiresReconciliationBeforeRetry: reconciliation }
        : {
            kind: 'MANUAL_EXPORT_REQUIRED',
            intent,
            reason: 'CAPABILITY_MISSING',
            detail: 'this destination cannot update parties',
          };
    }

    case 'PROFORMA_REGISTER':
      return capabilities.documents.createProforma
        ? { kind: 'SEND', intent, requiresReconciliationBeforeRetry: reconciliation }
        : {
            kind: 'MANUAL_EXPORT_REQUIRED',
            intent,
            reason: 'CAPABILITY_MISSING',
            detail: 'this destination cannot register a pro-forma',
          };
  }
};
