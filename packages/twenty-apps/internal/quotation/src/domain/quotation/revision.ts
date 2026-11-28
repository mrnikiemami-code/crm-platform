import { createHash } from 'node:crypto';

import { type QuotationLineAmounts } from 'src/domain/money/line';
import { canEditQuotationLines, type QuotationStatus } from 'src/domain/quotation/status';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// A revision is the immutable record of what a customer was actually shown.
//
// WHY A HASH AND NOT JUST A VERSION NUMBER: a version tells you WHICH snapshot, a
// hash tells you the snapshot has not moved. The two together are what let a later
// dispute be settled from the stored bytes instead of from someone's memory of the
// screen.
//
// WHY AMOUNTS ARE STRINGS: bigint does not survive JSON, and a JS number would lose
// precision on exactly the amounts this app exists to get right. The exact decimal
// text is also what a human can read in the audit trail.
export type SealedQuotationCustomer = {
  id: string;
  kind: 'PERSON' | 'COMPANY';
  name: string;
  nationalCode: string | null;
  economicCode: string | null;
  registrationNumber: string | null;
  accountingCode: string | null;
  customerCode: string | null;
  mobile: string | null;
  phone: string | null;
  secondPhone: string | null;
  fax: string | null;
  email: string | null;
  address: { street1: string | null; street2: string | null; city: string | null; state: string | null; postcode: string | null; country: string | null };
};

export type QuotationRevisionLine = {
  lineId: string;
  // V2 captures product identity and displayed content; old hashes stay untouched.
  itemId?: string | null;
  name?: string;
  kind?: 'PRODUCT' | 'SERVICE';
  itemSku?: string | null;
  itemAccountingCode?: string | null;
  taxPolicyRecordId?: string | null;
  taxAccountingCode?: string;
  grossMicros?: string;
  documentDiscountMicros?: string;
  description: string;
  unit: string;
  unitRecordId?: string | null;
  unitCode?: string;
  unitAccountingCode?: string;
  quantityScaled: string;
  unitPriceMicros: string;
  discountMicros: string;
  // Tax and duty for the line, combined. The document-level split is what a
  // destination is handed; a line's own share stays summed so every stored revision
  // issued before policies could carry duty keeps its exact old bytes.
  taxMicros: string;
  totalMicros: string;
  // WS3: optional per-line policy. Absent on sealed revisions that predate WS3 so
  // their snapshot hash stays identical.
  taxPolicy?: string;
  taxRateBasisPoints?: string | null;
  dutyRateBasisPoints?: string | null;
};

export type QuotationRevisionSnapshot = {
  // Absent on historical seals, which also used integer micros.
  schemaVersion?: 2;
  revisionNumber?: number;
  documentTitle?: string;
  customerSnapshot?: SealedQuotationCustomer;
  expiresAt?: string | null;
  taxPolicyRecordId?: string | null;
  taxAccountingCode?: string;
  currencyRecordId?: string | null;
  currencyAccountingCode?: string;
  quotationId: string;
  version: number;
  quotationNumber: string;
  currencyCode: string;
  customerRef: string;
  taxPolicy: string;
  // The exact rate the sealed amounts were computed with, in basis points. Kept in
  // the snapshot so changing the policy's rate later cannot rewrite history.
  taxRateBasisPoints: string | null;
  // The duty component of the same sealed policy. Zero for every revision issued before
  // policies could carry duty, which is what keeps those documents' amounts unchanged.
  dutyRateBasisPoints?: string | null;
  paymentTerms: string | null;
  lines: QuotationRevisionLine[];
  totals: {
    grossMicros: string;
    discountMicros: string;
    lineDiscountMicros?: string;
    documentDiscountMicros?: string;
    netMicros: string;
    taxOnlyMicros?: string;
    dutyMicros?: string;
    taxMicros: string;
    roundingMicros?: string;
    preRoundTotalMicros?: string;
    totalMicros: string;
  };
  roundingRuleCode?: string;
  roundingRuleName?: string;
  roundingStepRials?: string;
  issuedAt: string;
};

// Both historical Nest-issued seals and the app line builder store integer micros.
// This is NOT the draft decimal-IRR representation. Never infer encoding from magnitude,
// or multiply a sealed amount by the scale a second time.
export const parseRevisionMicros = (value: unknown): Result<bigint> =>
  typeof value === 'string' && /^(0|-?[1-9]\d*)$/.test(value)
    ? accepted(BigInt(value))
    : refused('AMOUNT_NOT_A_DECIMAL', 'revision amount must be a canonical integer micro-unit string');

export type DecodedRevisionLine = {
  quantity: bigint; unitPrice: bigint; gross: bigint; lineDiscount: bigint;
  documentDiscount: bigint; net: bigint; tax: bigint; total: bigint;
};

export const decodeRevisionLine = (line: QuotationRevisionLine): Result<DecodedRevisionLine> => {
  const quantity = parseRevisionMicros(line.quantityScaled);
  const unitPrice = parseRevisionMicros(line.unitPriceMicros);
  const lineDiscount = parseRevisionMicros(line.discountMicros);
  const tax = parseRevisionMicros(line.taxMicros);
  const total = parseRevisionMicros(line.totalMicros);
  if (!quantity.ok || !unitPrice.ok || !lineDiscount.ok || !tax.ok || !total.ok) {
    return refused('AMOUNT_NOT_A_DECIMAL', 'invalid sealed line amount');
  }
  const gross = (quantity.value * unitPrice.value + 500000n) / 1000000n;
  const net = total.value - tax.value;
  // Historical seals did not store the allocated document discount. It is recoverable
  // exactly from the sealed quantity, price, line discount and net; the document-level
  // sum below must also match. No magnitude/encoding guess or historical rewrite.
  const documentDiscount = gross - lineDiscount.value - net;
  if (quantity.value <= 0n || unitPrice.value < 0n || lineDiscount.value < 0n ||
      tax.value < 0n || net < 0n || documentDiscount < 0n ||
      (line.grossMicros !== undefined && line.grossMicros !== gross.toString()) ||
      (line.documentDiscountMicros !== undefined && line.documentDiscountMicros !== documentDiscount.toString())) {
    return refused('TOTALS_INCONSISTENT', 'sealed line quantity, price and discount do not reconcile');
  }
  return accepted({ quantity: quantity.value, unitPrice: unitPrice.value, gross,
    lineDiscount: lineDiscount.value, documentDiscount, net, tax: tax.value, total: total.value });
};

export const validateRevisionFinancialFacts = (revision: QuotationRevisionSnapshot): Result<true> => {
  if ((revision.schemaVersion !== undefined && revision.schemaVersion !== 2) ||
      !Array.isArray(revision.lines) || !revision.lines.length || !revision.totals) {
    return refused('REVISION_MISMATCH', 'unsupported or incomplete revision');
  }
  const ids = new Set<string>();
  let gross = 0n, lineDiscount = 0n, documentDiscount = 0n, net = 0n, tax = 0n;
  for (const line of revision.lines) {
    if (!line || typeof line.lineId !== 'string' || !line.lineId || ids.has(line.lineId) ||
      (revision.schemaVersion === 2 && (line.grossMicros === undefined || line.documentDiscountMicros === undefined))) {
      return refused('REVISION_MISMATCH', 'missing or duplicate sealed line identity');
    }
    ids.add(line.lineId);
    const decoded = decodeRevisionLine(line);
    if (!decoded.ok) return decoded;
    gross += decoded.value.gross;
    lineDiscount += decoded.value.lineDiscount;
    documentDiscount += decoded.value.documentDiscount;
    net += decoded.value.net;
    tax += decoded.value.tax;
  }
  const totals = revision.totals;
  const duty = parseRevisionMicros(totals.dutyMicros ?? '0');
  const rounding = parseRevisionMicros(totals.roundingMicros ?? '0');
  if (!duty.ok || !rounding.ok) return refused('AMOUNT_NOT_A_DECIMAL', 'invalid sealed duty or rounding');
  if (totals.grossMicros !== gross.toString() ||
      totals.discountMicros !== (lineDiscount + documentDiscount).toString() ||
      totals.netMicros !== net.toString() || totals.taxMicros !== tax.toString() ||
      totals.totalMicros !== (net + tax + rounding.value).toString() ||
      (net + tax + rounding.value) % 1000000n !== 0n ||
      net + tax + rounding.value < 0n || duty.value < 0n || duty.value > tax ||
      (totals.taxOnlyMicros !== undefined && totals.taxOnlyMicros !== (tax - duty.value).toString()) ||
      (totals.preRoundTotalMicros !== undefined && totals.preRoundTotalMicros !== (net + tax).toString()) ||
      (revision.schemaVersion === 2 && (totals.lineDiscountMicros !== lineDiscount.toString() ||
        totals.documentDiscountMicros !== documentDiscount.toString()))) {
    return refused('TOTALS_INCONSISTENT', 'sealed line sums and document totals do not reconcile');
  }
  return accepted(true);
};

// Key order is normalised before hashing so two structurally equal snapshots can
// never hash differently because one was built by a different code path.
export const canonicalizeForHash = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeForHash).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => (leftKey < rightKey ? -1 : 1))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalizeForHash(entryValue)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
};

export const hashQuotationRevision = (
  snapshot: QuotationRevisionSnapshot,
): string =>
  createHash('sha256').update(canonicalizeForHash(snapshot), 'utf8').digest('hex');

export const buildQuotationRevisionLine = ({
  lineId,
  description,
  unit,
  quantityScaled,
  unitPriceMicros,
  amounts,
}: {
  lineId: string;
  description: string;
  unit: string;
  quantityScaled: bigint;
  unitPriceMicros: bigint;
  amounts: QuotationLineAmounts;
}): QuotationRevisionLine => ({
  lineId,
  description,
  unit,
  quantityScaled: quantityScaled.toString(),
  unitPriceMicros: unitPriceMicros.toString(),
  discountMicros: amounts.discountMicros.toString(),
  taxMicros: amounts.taxMicros.toString(),
  totalMicros: amounts.totalMicros.toString(),
});

// Content edits are allowed only while nobody outside the workspace can see the
// document. Once it is SENT the lines are frozen, and a change means a NEW revision
// with a new number or a new version — never an in-place edit, because the customer
// is holding the old one.
export const checkLinesMutable = (status: QuotationStatus): Result<QuotationStatus> =>
  canEditQuotationLines(status)
    ? accepted(status)
    : refused(
        'QUOTATION_LINES_FROZEN',
        `a quotation in ${status} cannot have its lines edited; issue a new revision instead`,
      );

// Compares a stored revision with a proposed mutation. Any difference is refused:
// the stored snapshot is evidence, and an "almost the same" revision is worse than
// an obviously different one because it still hashes to the old value's document.
export const checkRevisionUnchanged = ({
  storedHash,
  proposedSnapshot,
}: {
  storedHash: string;
  proposedSnapshot: QuotationRevisionSnapshot;
}): Result<string> => {
  const proposedHash = hashQuotationRevision(proposedSnapshot);

  return proposedHash === storedHash
    ? accepted(storedHash)
    : refused(
        'REVISION_IMMUTABLE',
        'a stored revision cannot be modified; create a new version',
      );
};

// The next version number for a quotation. Kept here, beside the snapshot, so the
// rule "versions only ever increase by one" has a single home.
export const nextRevisionVersion = (existingVersions: number[]): number =>
  existingVersions.length === 0
    ? 1
    : Math.max(...existingVersions) + 1;
