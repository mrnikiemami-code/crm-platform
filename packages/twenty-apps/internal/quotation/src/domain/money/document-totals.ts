import { type QuotationLineAmounts } from 'src/domain/money/line';
import { checkApiSafeMicros } from 'src/domain/money/micros';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// A document total is the sum of already-rounded line buckets. There is no second
// rounding pass here on purpose: re-rounding a sum is how a printed total ends up
// one micro away from the column it summarises, and that is the single most common
// reason an accountant rejects a document.
export type QuotationDocumentTotals = {
  grossMicros: bigint;
  discountMicros: bigint;
  netMicros: bigint;
  taxMicros: bigint;
  totalMicros: bigint;
};

export const computeDocumentTotals = (
  lines: QuotationLineAmounts[],
): Result<QuotationDocumentTotals> => {
  if (lines.length === 0) {
    return refused(
      'DOCUMENT_HAS_NO_LINES',
      'a quotation must have at least one line',
    );
  }

  const totals = lines.reduce<QuotationDocumentTotals>(
    (accumulator, line) => ({
      grossMicros: accumulator.grossMicros + line.grossMicros,
      discountMicros: accumulator.discountMicros + line.discountMicros,
      netMicros: accumulator.netMicros + line.netMicros,
      taxMicros: accumulator.taxMicros + line.taxMicros,
      totalMicros: accumulator.totalMicros + line.totalMicros,
    }),
    {
      grossMicros: 0n,
      discountMicros: 0n,
      netMicros: 0n,
      taxMicros: 0n,
      totalMicros: 0n,
    },
  );

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

// Every amount that will be written to a CURRENCY field must survive the API
// round trip, so the check happens once here rather than at each write site.
export const checkTotalsFitApiBoundary = (
  totals: QuotationDocumentTotals,
): Result<QuotationDocumentTotals> => {
  const buckets: [bigint, string][] = [
    [totals.grossMicros, 'gross total'],
    [totals.discountMicros, 'discount total'],
    [totals.netMicros, 'net total'],
    [totals.taxMicros, 'tax total'],
    [totals.totalMicros, 'grand total'],
  ];

  for (const [micros, label] of buckets) {
    const check = checkApiSafeMicros(micros, label);

    if (!check.ok) {
      return check;
    }
  }

  return accepted(totals);
};
