import { applyBasisPoints } from 'src/domain/money/arithmetic';
import {
  allocateDocumentDiscount,
  computeDocumentDiscountMicros,
} from 'src/domain/money/document-discount';
import {
  type LineDiscount,
  type QuotationLineAmounts,
  type QuotationLinePreTaxAmounts,
} from 'src/domain/money/line';
import {
  formatMicrosExact,
  isWholeRialMicros,
  parseMicrosExact,
  roundMicrosToWholeRial,
} from 'src/domain/money/micros';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Document totals after line discounts, document discount allocation, tax, and
// whole-rial payable rounding.
//
// ORDER (unchanged provisional S1 contract, extended for document discount):
//   1. line gross → line discount → line net
//   2. document discount on sum(line nets), allocated with capacity-safe
//      largest-remainder (see document-discount.ts)
//   3. tax on (line net − document share) from the tax policy — never mutated
//   4. payable = floor(sum(line totals)) to whole IRR (toward −∞)
//      roundingMicros = payable − (net + tax)  // independent field, not tax

export type QuotationDocumentTotals = {
  grossMicros: bigint;
  lineDiscountMicros: bigint;
  documentDiscountMicros: bigint;
  // Alias kept for callers that still read `discountMicros` as "all discounts".
  discountMicros: bigint;
  netMicros: bigint;
  taxMicros: bigint;
  totalMicros: bigint;
  roundingMicros: bigint;
};

export type QuotationTotalsExactText = {
  grossExact: string;
  lineDiscountExact: string;
  documentDiscountExact: string;
  discountExact: string;
  netExact: string;
  taxExact: string;
  totalExact: string;
  roundingExact: string;
};

export const finalizeLinesWithDocumentDiscount = ({
  preTaxLines,
  documentDiscount,
  taxRateBasisPoints,
}: {
  preTaxLines: QuotationLinePreTaxAmounts[];
  documentDiscount: LineDiscount;
  taxRateBasisPoints: bigint;
}): Result<{ lines: QuotationLineAmounts[]; totals: QuotationDocumentTotals }> => {
  if (preTaxLines.length === 0) {
    return refused(
      'DOCUMENT_HAS_NO_LINES',
      'a quotation must have at least one line',
    );
  }

  const sumNets = preTaxLines.reduce(
    (sum, line) => sum + line.netAfterLineDiscountMicros,
    0n,
  );

  const documentDiscountResult = computeDocumentDiscountMicros(
    documentDiscount,
    sumNets,
  );

  if (!documentDiscountResult.ok) {
    return documentDiscountResult;
  }

  const sharesResult = allocateDocumentDiscount(
    preTaxLines,
    documentDiscountResult.value,
  );

  if (!sharesResult.ok) {
    return sharesResult;
  }

  const lines: QuotationLineAmounts[] = preTaxLines.map((preTax, index) => {
    const documentDiscountMicros = sharesResult.value[index];
    const netMicros =
      preTax.netAfterLineDiscountMicros - documentDiscountMicros;
    const taxMicros = applyBasisPoints(netMicros, taxRateBasisPoints);

    return {
      grossMicros: preTax.grossMicros,
      discountMicros: preTax.discountMicros,
      documentDiscountMicros,
      netMicros,
      taxMicros,
      // Line total is pre-rounding; document payable adds roundingExact.
      totalMicros: netMicros + taxMicros,
    };
  });

  const lineTotals = sumLineBuckets(lines);
  const rawPayableMicros = lineTotals.netMicros + lineTotals.taxMicros;
  const payableMicros = roundMicrosToWholeRial(rawPayableMicros);
  const roundingMicros = payableMicros - rawPayableMicros;

  const totals: QuotationDocumentTotals = {
    ...lineTotals,
    roundingMicros,
    totalMicros: payableMicros,
  };

  if (totals.netMicros !== totals.grossMicros - totals.discountMicros) {
    return refused(
      'TOTALS_INCONSISTENT',
      'net total does not equal gross minus all discounts',
    );
  }

  // Payable = net + tax + rounding adjustment (tax itself stays policy-pure).
  if (
    totals.totalMicros !==
    totals.netMicros + totals.taxMicros + totals.roundingMicros
  ) {
    return refused(
      'TOTALS_INCONSISTENT',
      'payable does not equal net plus tax plus rounding',
    );
  }

  if (!isWholeRialMicros(totals.totalMicros)) {
    return refused(
      'PAYABLE_NOT_WHOLE_RIAL',
      'مبلغ نهایی باید به ریال صحیح باشد',
    );
  }

  return accepted({ lines, totals });
};

const sumLineBuckets = (
  lines: QuotationLineAmounts[],
): QuotationDocumentTotals => {
  const totals = lines.reduce<QuotationDocumentTotals>(
    (accumulator, line) => ({
      grossMicros: accumulator.grossMicros + line.grossMicros,
      lineDiscountMicros:
        accumulator.lineDiscountMicros + line.discountMicros,
      documentDiscountMicros:
        accumulator.documentDiscountMicros + line.documentDiscountMicros,
      discountMicros:
        accumulator.discountMicros +
        line.discountMicros +
        line.documentDiscountMicros,
      netMicros: accumulator.netMicros + line.netMicros,
      taxMicros: accumulator.taxMicros + line.taxMicros,
      totalMicros: accumulator.totalMicros + line.totalMicros,
      roundingMicros: 0n,
    }),
    {
      grossMicros: 0n,
      lineDiscountMicros: 0n,
      documentDiscountMicros: 0n,
      discountMicros: 0n,
      netMicros: 0n,
      taxMicros: 0n,
      totalMicros: 0n,
      roundingMicros: 0n,
    },
  );

  return totals;
};

// Backward-compatible helper used by older tests that only pass post-line amounts
// with documentDiscountMicros already set (usually 0). No document rounding here.
export const computeDocumentTotals = (
  lines: QuotationLineAmounts[],
): Result<QuotationDocumentTotals> => {
  if (lines.length === 0) {
    return refused(
      'DOCUMENT_HAS_NO_LINES',
      'a quotation must have at least one line',
    );
  }

  const normalized = lines.map((line) => ({
    ...line,
    documentDiscountMicros: line.documentDiscountMicros ?? 0n,
  }));

  const totals = sumLineBuckets(normalized);

  if (totals.netMicros !== totals.grossMicros - totals.discountMicros) {
    return refused(
      'TOTALS_INCONSISTENT',
      'net total does not equal gross minus discount',
    );
  }

  if (totals.totalMicros !== totals.netMicros + totals.taxMicros) {
    return refused(
      'TOTALS_INCONSISTENT',
      'total does not equal net plus tax',
    );
  }

  return accepted(totals);
};

export const formatTotalsExact = (
  totals: QuotationDocumentTotals,
): QuotationTotalsExactText => ({
  grossExact: formatMicrosExact(totals.grossMicros),
  lineDiscountExact: formatMicrosExact(totals.lineDiscountMicros),
  documentDiscountExact: formatMicrosExact(totals.documentDiscountMicros),
  discountExact: formatMicrosExact(totals.discountMicros),
  netExact: formatMicrosExact(totals.netMicros),
  taxExact: formatMicrosExact(totals.taxMicros),
  totalExact: formatMicrosExact(totals.totalMicros),
  roundingExact: formatMicrosExact(totals.roundingMicros),
});

export const readTotalsExact = (
  text: QuotationTotalsExactText,
): Result<QuotationDocumentTotals> => {
  const parsed = {
    grossMicros: parseMicrosExact(text.grossExact),
    lineDiscountMicros: parseMicrosExact(text.lineDiscountExact),
    documentDiscountMicros: parseMicrosExact(text.documentDiscountExact),
    discountMicros: parseMicrosExact(text.discountExact),
    netMicros: parseMicrosExact(text.netExact),
    taxMicros: parseMicrosExact(text.taxExact),
    totalMicros: parseMicrosExact(text.totalExact),
    roundingMicros: parseMicrosExact(text.roundingExact),
  };

  for (const [label, result] of Object.entries(parsed)) {
    if (!result.ok) {
      return refused('TOTALS_TEXT_INVALID', `${label} is not an exact decimal`);
    }
  }

  const totals = {
    grossMicros: (parsed.grossMicros as { ok: true; value: bigint }).value,
    lineDiscountMicros: (
      parsed.lineDiscountMicros as { ok: true; value: bigint }
    ).value,
    documentDiscountMicros: (
      parsed.documentDiscountMicros as { ok: true; value: bigint }
    ).value,
    discountMicros: (parsed.discountMicros as { ok: true; value: bigint })
      .value,
    netMicros: (parsed.netMicros as { ok: true; value: bigint }).value,
    taxMicros: (parsed.taxMicros as { ok: true; value: bigint }).value,
    totalMicros: (parsed.totalMicros as { ok: true; value: bigint }).value,
    roundingMicros: (parsed.roundingMicros as { ok: true; value: bigint })
      .value,
  };

  if (
    totals.totalMicros !==
    totals.netMicros + totals.taxMicros + totals.roundingMicros
  ) {
    return refused(
      'TOTALS_INCONSISTENT',
      'payable does not equal net plus tax plus rounding',
    );
  }

  return accepted(totals);
};
