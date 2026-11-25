export const QUOTATION_DRAFT_LINE_KINDS = ['PRODUCT', 'SERVICE'] as const;

export type QuotationDraftLineKind =
  (typeof QUOTATION_DRAFT_LINE_KINDS)[number];

export const QUOTATION_DRAFT_DISCOUNT_KINDS = [
  'NONE',
  'RATE',
  'AMOUNT',
] as const;

export type QuotationDraftDiscountKind =
  (typeof QUOTATION_DRAFT_DISCOUNT_KINDS)[number];

export const QUOTATION_DRAFT_CUSTOMER_TYPES = ['PERSON', 'COMPANY'] as const;

export type QuotationDraftCustomerType =
  (typeof QUOTATION_DRAFT_CUSTOMER_TYPES)[number];

// Money arrives as the exact decimal strings the app's Money Domain produced.
// The server never re-derives a price; it verifies the plan adds up and stores it.
export type QuotationDraftSaveLine = {
  name: string;
  kind: QuotationDraftLineKind;
  description: string | null;
  unit: string;
  quantityExact: string;
  unitPriceExact: string;
  grossExact: string;
  discountExact: string;
  discountKind: QuotationDraftDiscountKind;
  discountInputExact: string;
  documentDiscountExact: string;
  taxExact: string;
  totalExact: string;
  itemId: string | null;
  // WS3: frozen per-line tax/duty; absent on legacy header-only tax saves.
  taxPolicy?: string | null;
  taxRateBasisPoints?: string | null;
  dutyRateBasisPoints?: string | null;
  // WS4: inherits document currency; phase-1 always IRR.
  currencyCode?: string | null;
};

export type QuotationDraftSaveHeader = {
  name: string;
  customerType: QuotationDraftCustomerType;
  personId: string | null;
  companyId: string | null;
  currencyCode: string;
  taxPolicy: string | null;
  // Basis points the app computed the tax with (900 = 9%). Stored with the
  // document so a later settings change cannot re-interpret old amounts.
  taxRateBasisPoints: string | null;
  // The duty component of the same policy. Zero for documents saved before a
  // policy could carry duty.
  dutyRateBasisPoints?: string | null;
  paymentTerms: string | null;
  documentDiscountKind: QuotationDraftDiscountKind;
  documentDiscountInputExact: string;
  grossExact: string;
  lineDiscountExact: string;
  documentDiscountExact: string;
  netExact: string;
  taxExact: string;
  // The duty part of `taxExact`. Optional only for callers that predate the
  // split; a present value is validated against `dutyRateBasisPoints`.
  dutyExact?: string;
  roundingExact: string;
  totalExact: string;
};

export type QuotationDraftSaveRequest = {
  quotationId: string | null;
  expectedVersion: number | null;
  header: QuotationDraftSaveHeader;
  lines: QuotationDraftSaveLine[];
};

export type QuotationDraftSaveOutcome =
  | {
      kind: 'SAVED';
      quotationId: string;
      version: number;
      status: string;
    }
  | { kind: 'REJECTED'; code: string; message: string };

// 200 lines is the ceiling the edit form reads; a save larger than that is not a
// quotation any operator could have produced in the panel.
export const QUOTATION_DRAFT_MAX_LINES = 200;
