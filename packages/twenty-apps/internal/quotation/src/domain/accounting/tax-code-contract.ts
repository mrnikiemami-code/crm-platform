// The destination's own statement about a tax code it defines.
//
// WHY THE COMPOSITION IS HERE: a CRM policy carries two components (tax and duty). Some
// destinations identify the whole value-added treatment with ONE code, so that code is what
// has to be mapped — not a tax code plus a duty code. Two policies can sum to the same total
// while splitting it differently, and only the composition tells them apart. When the
// destination states its rate, this is the data the mapping is checked against; when it does
// not, the CRM says the match is unverifiable instead of pretending 9% is enough.
export type TaxCodeContract = {
  code: string;
  label: string;
  // Basis points as decimal text, the same representation the policy row stores.
  totalRateBasisPoints: string;
  // Present only when the destination publishes its internal split. A destination that
  // states a single total is compared on the total alone.
  taxRateBasisPoints?: string;
  dutyRateBasisPoints?: string;
};

export type TaxPolicyRateProfile = {
  totalRateBasisPoints: string;
  taxRateBasisPoints: string;
  dutyRateBasisPoints: string;
};

export type TaxCodeMatch =
  // The destination published no catalog, or does not list this code. A code an operator
  // reads off the destination's own settings is not an error just because it is unknown
  // here; it only means the CRM cannot verify it.
  | { kind: 'UNVERIFIABLE'; reason: 'NO_CATALOG' | 'CODE_NOT_LISTED' }
  | { kind: 'MATCH' }
  | {
      kind: 'MISMATCH';
      reason: 'TOTAL_RATE' | 'COMPOSITION';
      detail: string;
    };

const BASIS_POINTS_PATTERN = /^\d{1,5}$/;

const readBasisPoints = (text: string | undefined): bigint | null => {
  const normalized = (text ?? '').trim();

  return BASIS_POINTS_PATTERN.test(normalized) ? BigInt(normalized) : null;
};

// The policy a sealed revision carries, in the shape the comparison takes. An ABSENT component
// is zero duty — that is how every revision issued before policies had duty keeps its meaning —
// while an unreadable one leaves the total empty, so the matcher reports the mapping as
// unverifiable instead of comparing a zero the document never contained.
export const taxPolicyProfileFromSnapshot = (snapshot: {
  taxRateBasisPoints: string | null;
  dutyRateBasisPoints?: string | null;
}): TaxPolicyRateProfile => {
  const tax = (snapshot.taxRateBasisPoints ?? '').trim();
  const duty = (snapshot.dutyRateBasisPoints ?? '').trim();
  const component = (text: string): bigint | null =>
    text === '' ? BigInt(0) : readBasisPoints(text);
  const taxPoints = component(tax);
  const dutyPoints = component(duty);

  return {
    taxRateBasisPoints: taxPoints === null ? tax : taxPoints.toString(),
    dutyRateBasisPoints: dutyPoints === null ? duty : dutyPoints.toString(),
    totalRateBasisPoints:
      taxPoints === null || dutyPoints === null
        ? ''
        : (taxPoints + dutyPoints).toString(),
  };
};

// Compares the CRM policy the document carries with the destination code it is mapped to.
// The comparison is exact (basis points, never a float) and refuses to guess: an
// unreadable side makes the match unverifiable rather than a pass.
export const matchTaxPolicyToDestinationCode = ({
  policy,
  destinationCode,
  catalog,
}: {
  policy: TaxPolicyRateProfile;
  destinationCode: string;
  catalog: readonly TaxCodeContract[] | undefined;
}): TaxCodeMatch => {
  const code = destinationCode.trim();

  if (catalog === undefined || catalog.length === 0) {
    return { kind: 'UNVERIFIABLE', reason: 'NO_CATALOG' };
  }

  const entry = catalog.find((candidate) => candidate.code.trim() === code);

  if (entry === undefined) {
    return { kind: 'UNVERIFIABLE', reason: 'CODE_NOT_LISTED' };
  }

  const policyTotal = readBasisPoints(policy.totalRateBasisPoints);
  const policyTax = readBasisPoints(policy.taxRateBasisPoints);
  const policyDuty = readBasisPoints(policy.dutyRateBasisPoints);
  const entryTotal = readBasisPoints(entry.totalRateBasisPoints);
  const entryTax = readBasisPoints(entry.taxRateBasisPoints);
  const entryDuty = readBasisPoints(entry.dutyRateBasisPoints);

  if (
    policyTotal === null ||
    policyTax === null ||
    policyDuty === null ||
    entryTotal === null
  ) {
    return { kind: 'UNVERIFIABLE', reason: 'CODE_NOT_LISTED' };
  }

  if (policyTotal !== entryTotal) {
    return {
      kind: 'MISMATCH',
      reason: 'TOTAL_RATE',
      detail: `total rate differs: CRM ${policyTotal} bp, destination ${entryTotal} bp`,
    };
  }

  // The destination publishes a split, so the components are compared too. Equal totals are
  // not enough: 6% + 3% and 7% + 2% both read 9%, and the destination books them differently.
  if (entryTax !== null && entryDuty !== null) {
    if (policyTax !== entryTax || policyDuty !== entryDuty) {
      return {
        kind: 'MISMATCH',
        reason: 'COMPOSITION',
        detail: `composition differs: CRM ${policyTax}+${policyDuty} bp, destination ${entryTax}+${entryDuty} bp`,
      };
    }
  }

  return { kind: 'MATCH' };
};
