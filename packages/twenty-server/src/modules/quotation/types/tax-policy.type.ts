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
  accountingCode: string | null;
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
  // Derived on the server from the two rates being zero: an exemption is the arithmetic
  // fact of a 0% policy, never a separate choice an operator can tick against a rate.
  isExempt: boolean;
  // Optional CRM ledger code for the whole policy (tax + duty). Empty allowed.
  accountingCode: string;
  // Live quotations that name this policy. Produced by the same read that produces the
  // row, so the list and the delete refusal cannot disagree.
  quotationCount: number;
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
  // Optional CRM ledger code; empty clears / leaves unset. Lock-on-use is WS2.
  accountingCodeText: string;
  isActive: boolean;
  isDefault: boolean;
};
