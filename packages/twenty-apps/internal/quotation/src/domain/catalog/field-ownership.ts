// Fields whose value can come from either side of the connection. The list is
// closed on purpose: a field absent from it is CRM-owned and never synced, so
// adding a synced field is a deliberate change with a migration behind it rather
// than an accident of a new column.
export const CATALOG_SYNC_FIELDS = [
  'name',
  'sku',
  'unit',
  'kind',
  'description',
  'price',
  'taxRate',
  'category',
  'isActive',
  'inventoryQuantity',
] as const;

export type CatalogSyncField = (typeof CATALOG_SYNC_FIELDS)[number];

// Which side's value wins FOR A FIELD. Per field, per connection, because an
// accounting package that owns prices in one workspace may own only the item names
// in another.
export type FieldOwner = 'CRM' | 'ACCOUNTING';

export type FieldOwnershipPolicy = Record<CatalogSyncField, FieldOwner>;

// Fields the CRM must never own, regardless of configuration. Stock and valuation
// are the accounting system's truth by the agreed boundary; allowing the CRM to win
// them would create two answers to "how many are left".
export const ACCOUNTING_OWNED_FIELDS: readonly CatalogSyncField[] = [
  'inventoryQuantity',
];

// The default for a new connection: the CRM is the place people type product names
// and prices, while stock and tax rates come from accounting. Any deviation is an
// explicit policy a workspace sets, not a default.
export const DEFAULT_FIELD_OWNERSHIP_POLICY: FieldOwnershipPolicy = {
  name: 'CRM',
  sku: 'CRM',
  unit: 'CRM',
  kind: 'CRM',
  description: 'CRM',
  price: 'CRM',
  taxRate: 'ACCOUNTING',
  category: 'ACCOUNTING',
  isActive: 'CRM',
  inventoryQuantity: 'ACCOUNTING',
};

export type PolicyProblem = {
  field: CatalogSyncField;
  reason: 'ACCOUNTING_FIELD_CLAIMED_BY_CRM';
};

// Returns every field whose configured owner contradicts the agreed boundary.
// Refusing the whole policy rather than silently overriding one field keeps the
// configuration honest: a saved policy must mean what it says.
export const findFieldOwnershipPolicyProblems = (
  policy: FieldOwnershipPolicy,
): PolicyProblem[] =>
  ACCOUNTING_OWNED_FIELDS.filter((field) => policy[field] !== 'ACCOUNTING').map(
    (field) => ({ field, reason: 'ACCOUNTING_FIELD_CLAIMED_BY_CRM' }),
  );

export type FieldChange = {
  field: CatalogSyncField;
  crmValue: string | null;
  accountingValue: string | null;
};

export type FieldOutcome =
  | { kind: 'AGREE'; field: CatalogSyncField; value: string | null }
  | {
      kind: 'APPLY_OWNER';
      field: CatalogSyncField;
      value: string | null;
      owner: FieldOwner;
      // The losing side's value, recorded so the caller can surface it instead of
      // the change disappearing.
      discardedValue: string | null;
    }
  | {
      kind: 'CONFLICT';
      field: CatalogSyncField;
      crmValue: string | null;
      accountingValue: string | null;
    };

// Decides each field independently. The rule that matters: when BOTH sides changed
// the same field, the owner does not simply win — it becomes a CONFLICT for a human,
// because "the CRM wins" applied to two real edits is exactly the silent overwrite
// the plan forbids. Ownership decides which side is authoritative for a FAILED
// comparison, not which edit to throw away.
export const resolveFieldOutcomes = ({
  changes,
  policy,
  previouslySynced,
}: {
  changes: FieldChange[];
  policy: FieldOwnershipPolicy;
  // The field values at the last successful sync, keyed by field. A field whose
  // value equals its synced value on one side has not changed on that side.
  previouslySynced: Partial<Record<CatalogSyncField, string | null>>;
}): FieldOutcome[] =>
  changes.map((change) => {
    const syncedValue = previouslySynced[change.field] ?? null;
    const crmChanged = change.crmValue !== syncedValue;
    const accountingChanged = change.accountingValue !== syncedValue;
    const owner = policy[change.field];

    if (change.crmValue === change.accountingValue) {
      return { kind: 'AGREE', field: change.field, value: change.crmValue };
    }

    if (crmChanged && accountingChanged) {
      return {
        kind: 'CONFLICT',
        field: change.field,
        crmValue: change.crmValue,
        accountingValue: change.accountingValue,
      };
    }

    // Only one side moved, so the owner's current value is the truth and the other
    // side's stale value is replaced. The replaced value is reported, not dropped.
    const ownerValue = owner === 'CRM' ? change.crmValue : change.accountingValue;
    const discardedValue = owner === 'CRM' ? change.accountingValue : change.crmValue;

    return {
      kind: 'APPLY_OWNER',
      field: change.field,
      value: ownerValue,
      owner,
      discardedValue,
    };
  });
