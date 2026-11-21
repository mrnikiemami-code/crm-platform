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
export type QuotationRevisionLine = {
  lineId: string;
  description: string;
  unit: string;
  quantityScaled: string;
  unitPriceMicros: string;
  discountMicros: string;
  taxMicros: string;
  totalMicros: string;
};

export type QuotationRevisionSnapshot = {
  quotationId: string;
  version: number;
  quotationNumber: string;
  currencyCode: string;
  customerRef: string;
  taxPolicy: string;
  // The exact rate the sealed amounts were computed with, in basis points. Kept in
  // the snapshot so changing the policy's rate later cannot rewrite history.
  taxRateBasisPoints: string | null;
  paymentTerms: string | null;
  lines: QuotationRevisionLine[];
  totals: {
    grossMicros: string;
    discountMicros: string;
    netMicros: string;
    taxMicros: string;
    totalMicros: string;
  };
  issuedAt: string;
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
