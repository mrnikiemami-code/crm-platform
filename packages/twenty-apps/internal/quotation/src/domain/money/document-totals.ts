import { type QuotationLineAmounts } from 'src/domain/money/line';
import { formatMicrosExact, parseMicrosExact } from 'src/domain/money/micros';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// A document total is the sum of already-rounded line buckets. There is no second// rounding pass here on purpose: re-rounding a sum is how a printed total ends up
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
// The stored form of every bucket: exact decimal text, which is what a snapshot records and
// what an accountant reads. There is deliberately no "fit the column" check any more — the
// column is text, so there is no boundary to fit. That check existed only because an amount
// used to be written to a numeric field that silently changed large values.
export type QuotationTotalsExactText = {
  grossExact: string;
  discountExact: string;
  netExact: string;
  taxExact: string;
  totalExact: string;
};

export const formatTotalsExact = (
  totals: QuotationDocumentTotals,
): QuotationTotalsExactText => ({
  grossExact: formatMicrosExact(totals.grossMicros),
  discountExact: formatMicrosExact(totals.discountMicros),
  netExact: formatMicrosExact(totals.netMicros),
  taxExact: formatMicrosExact(totals.taxMicros),
  totalExact: formatMicrosExact(totals.totalMicros),
});

// Round-tripping the stored text back to the amounts must be identity. This is the check a
// caller reuses after loading a record, and it is the one that would have caught the numeric
// field losing precision.
export const readTotalsExact = (
  text: QuotationTotalsExactText,
): Result<QuotationDocumentTotals> => {
  const parsed = {
    grossMicros: parseMicrosExact(text.grossExact),
    discountMicros: parseMicrosExact(text.discountExact),
    netMicros: parseMicrosExact(text.netExact),
    taxMicros: parseMicrosExact(text.taxExact),
    totalMicros: parseMicrosExact(text.totalExact),
  };

  for (const [label, result] of Object.entries(parsed)) {
    if (!result.ok) {
      return refused('TOTALS_TEXT_INVALID', `${label} is not an exact decimal`);
    }
  }

  return accepted({
    grossMicros: (parsed.grossMicros as { ok: true; value: bigint }).value,
    discountMicros: (parsed.discountMicros as { ok: true; value: bigint }).value,
    netMicros: (parsed.netMicros as { ok: true; value: bigint }).value,
    taxMicros: (parsed.taxMicros as { ok: true; value: bigint }).value,
    totalMicros: (parsed.totalMicros as { ok: true; value: bigint }).value,
  });
};
