import { hashQuotationRevision, type QuotationRevisionSnapshot, type QuotationRevisionLine } from './quotation-revision-snapshot.util';

// Reader parity with app/domain/quotation/revision.ts. Never convert stored integer micros twice.
type Result<T> = { ok: true; value: T } | { ok: false; refusal: { code: string; detail: string } };
const accepted = <T>(value: T): Result<T> => ({ ok: true, value });
const refused = (code: string, detail: string): Result<never> => ({ ok: false, refusal: { code, detail } });

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
  const gross = (quantity.value * unitPrice.value + BigInt(500000)) / BigInt(1000000);
  const net = total.value - tax.value;
  // Historical seals did not store the allocated document discount. It is recoverable
  // exactly from the sealed quantity, price, line discount and net; the document-level
  // sum below must also match. No magnitude/encoding guess or historical rewrite.
  const documentDiscount = gross - lineDiscount.value - net;
  if (quantity.value <= BigInt(0) || unitPrice.value < BigInt(0) || lineDiscount.value < BigInt(0) ||
      tax.value < BigInt(0) || net < BigInt(0) || documentDiscount < BigInt(0) ||
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
  let gross = BigInt(0), lineDiscount = BigInt(0), documentDiscount = BigInt(0), net = BigInt(0), tax = BigInt(0);
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
      (net + tax + rounding.value) % BigInt(1000000) !== BigInt(0) ||
      net + tax + rounding.value < BigInt(0) || duty.value < BigInt(0) || duty.value > tax ||
      (totals.taxOnlyMicros !== undefined && totals.taxOnlyMicros !== (tax - duty.value).toString()) ||
      (totals.preRoundTotalMicros !== undefined && totals.preRoundTotalMicros !== (net + tax).toString()) ||
      (revision.schemaVersion === 2 && (totals.lineDiscountMicros !== lineDiscount.toString() ||
        totals.documentDiscountMicros !== documentDiscount.toString()))) {
    return refused('TOTALS_INCONSISTENT', 'sealed line sums and document totals do not reconcile');
  }
  return accepted(true);
};


export const formatSealedMicros = (value: bigint): string => {
  const magnitude = value < BigInt(0) ? -value : value;
  return `${value < BigInt(0) ? '-' : ''}${magnitude / BigInt(1000000)}.${(magnitude % BigInt(1000000)).toString().padStart(6, '0')}`;
};

export const readSealedQuotation = (raw: unknown, hash: unknown, quotationId: string, revisionNumber: number | null) => {
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return null; }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const snapshot = raw as QuotationRevisionSnapshot;
  if (snapshot.quotationId !== quotationId || typeof hash !== 'string' ||
    hashQuotationRevision(snapshot) !== hash ||
    typeof snapshot.quotationNumber !== 'string' || !snapshot.quotationNumber.trim() ||
    typeof snapshot.issuedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.issuedAt)) ||
    snapshot.currencyCode !== 'IRR' ||
    (snapshot.schemaVersion === 2 && (snapshot.revisionNumber !== revisionNumber ||
      !snapshot.customerSnapshot || snapshot.customerSnapshot.id !== snapshot.customerRef ||
      typeof snapshot.customerSnapshot.name !== 'string' || !snapshot.customerSnapshot.name.trim()))) return null;
  const validation = validateRevisionFinancialFacts(snapshot);
  return validation.ok ? snapshot : null;
};
