// How a caller proved the right to change a tax rate. `null` (no proof) is a
// refusal; there is deliberately no "missing identity therefore trusted" value.
export type TaxSettingsAuthority = 'SYSTEM' | 'APPLICATION' | 'SETTINGS_ROLE';

// The workspace `taxPolicy` row, as the server reads it. The rate is a text column
// because it is an integer count of basis points, never a float.
export type WorkspaceTaxPolicyRow = {
  id: string;
  code: string | null;
  name: string | null;
  rateBasisPoints: string | null;
  dutyRateBasisPoints: string | null;
  isActive: boolean | null;
  isDefault: boolean | null;
  isExempt: boolean | null;
};

// What the settings route returns. `recordId` is the row id; `code` is the stable
// identity documents carry.
export type WorkspaceTaxPolicyView = {
  recordId: string;
  code: string;
  name: string;
  rateBasisPoints: string;
  ratePercent: string;
  dutyRateBasisPoints: string;
  dutyRatePercent: string;
  // Tax + duty. Computed for display only; it is never written back as a rate,
  // because storing the sum would lose which component a document carried.
  totalRateBasisPoints: string;
  totalRatePercent: string;
  isActive: boolean;
  isDefault: boolean;
  isExempt: boolean;
};

export type TaxPolicyMutationOutcome =
  | { kind: 'OK'; policies: WorkspaceTaxPolicyView[]; message: string }
  | { kind: 'REFUSED'; code: string; message: string };

export type SaveTaxPolicyInput = {
  recordId: string | null;
  name: string;
  ratePercentText: string;
  // The duty component of the same policy. Empty means zero duty.
  dutyRatePercentText: string;
  isActive: boolean;
  isDefault: boolean;
  isExempt: boolean;
};
