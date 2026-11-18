import { accepted, refused, type Result } from 'src/domain/shared/result';

// Document numbers cannot rely on the platform. Twenty has no auto-number field
// type and no sequence primitive (checked: FieldMetadataType has no AUTO_NUMBER and
// there is no nextSequence helper in the server), so the app owns allocation.
//
// THE PROBLEM THIS SOLVES: two people issuing a quotation at the same second must
// not receive the same number, and the number must not be reused. The mechanism is
// compare-and-set on a single "last issued" value per scope, retried by the caller.
// The database's uniqueness on the scope key is what makes that safe; the loop below
// is the optimistic protocol around it.
export type QuotationSequenceScope = {
  // The workspace is implicit: the store is per workspace.
  documentType: 'QUOTATION';
  // Fiscal year, in the Persian calendar for this workspace. Kept as a plain number
  // because the fiscal calendar is a business setting, not a date library decision.
  fiscalYear: number;
  prefix: string;
  // Zero-padded width, so numbers sort as text as well as numerically.
  width: number;
};

// Numbers may have GAPS and must NOT have duplicates. A gapless requirement needs a
// lock held across the whole transaction that issues the document, which the
// platform cannot offer an app; a documented gap is rejected by an auditor far less
// often than a duplicate.
export const SEQUENCE_GAP_POLICY = 'GAPS_ALLOWED_DUPLICATES_FORBIDDEN' as const;

export const buildSequenceScopeKey = (scope: QuotationSequenceScope): string =>
  `${scope.documentType}:${scope.fiscalYear}`;

export const formatQuotationNumber = ({
  scope,
  sequence,
}: {
  scope: QuotationSequenceScope;
  sequence: number;
}): Result<string> => {
  if (!Number.isInteger(sequence) || sequence < 1) {
    return refused(
      'SEQUENCE_INVALID',
      `a sequence must be a positive integer, received ${sequence}`,
    );
  }

  const padded = String(sequence).padStart(scope.width, '0');

  if (padded.length > scope.width) {
    // Overflowing the width would silently change the shape of every later number,
    // which breaks sorting and any downstream parser.
    return refused(
      'SEQUENCE_EXCEEDS_WIDTH',
      `sequence ${sequence} does not fit in ${scope.width} digits`,
    );
  }

  return accepted(`${scope.prefix}-${scope.fiscalYear}-${padded}`);
};

// The number as it is printed on a Persian document.
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export const toPersianDigits = (input: string): string =>
  input.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);

export const formatQuotationNumberForPrinting = (
  quotationNumber: string,
): string => toPersianDigits(quotationNumber);

// The store is a narrow port so the domain never learns whether the value lives in a
// Twenty object, Redis, or a test double.
export type QuotationSequenceStore = {
  readLastIssued(scopeKey: string): Promise<number | null>;
  // Returns false when another writer moved the value first. Must be atomic; the
  // Twenty implementation is a single update guarded by the scope key.
  compareAndSetLastIssued(
    scopeKey: string,
    expected: number | null,
    next: number,
  ): Promise<boolean>;
};

export type QuotationNumberAllocation = {
  quotationNumber: string;
  sequence: number;
};

export const allocateQuotationNumber = async ({
  store,
  scope,
  maxAttempts = 5,
}: {
  store: QuotationSequenceStore;
  scope: QuotationSequenceScope;
  maxAttempts?: number;
}): Promise<Result<QuotationNumberAllocation>> => {
  const scopeKey = buildSequenceScopeKey(scope);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const lastIssued = await store.readLastIssued(scopeKey);
    const sequence = (lastIssued ?? 0) + 1;
    const formatted = formatQuotationNumber({ scope, sequence });

    // Validated before the write: a sequence that cannot be formatted must not
    // consume a number, or the gap becomes permanent for a reason no one can see.
    if (!formatted.ok) {
      return formatted;
    }

    const claimed = await store.compareAndSetLastIssued(
      scopeKey,
      lastIssued,
      sequence,
    );

    if (claimed) {
      return accepted({ quotationNumber: formatted.value, sequence });
    }
  }

  return refused(
    'SEQUENCE_CONTENDED',
    `could not allocate a number after ${maxAttempts} attempts; another issuer kept winning`,
  );
};
