// Integer division that rounds halves away from zero, the one rounding rule the
// quotation domain allows.
//
// WHY A SINGLE HELPER: every amount in a quotation is a division — a discount is a
// fraction of a line, a tax is a fraction of a net, a line is quantity times price
// over the quantity scale. If each site rounded its own way, the printed line
// total could differ from the sum of its parts by a micro, and a document that
// does not add up is rejected by an accountant no matter how small the gap.
//
// WHY BIGINT THROUGHOUT: micros are integers but the intermediate product of a
// quantity and a price is not representable in a JS number for a large line, so the
// numerator is bigint and the division happens before anything narrows.
export const divideRoundHalfUp = (
  numerator: bigint,
  denominator: bigint,
): bigint => {
  if (denominator === 0n) {
    throw new Error('divideRoundHalfUp: denominator must not be zero');
  }

  const isNegative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;

  const quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;

  // `remainder * 2 >= denominator` is the half-up test written without floating
  // point: a double comparison here would reintroduce the inexactness bigint exists
  // to remove.
  const rounded =
    remainder * 2n >= absoluteDenominator ? quotient + 1n : quotient;

  return isNegative ? -rounded : rounded;
};

// Rates are basis points: 10000 bp is 100%, 900 bp is 9%. Integers, because a
// percentage stored as 0.09 is a float, and 9% of a large net is exactly the kind
// of value where a float's representation error becomes a visible rial.
export const BASIS_POINTS_DENOMINATOR = 10_000n;
export const BASIS_POINTS_PER_PERCENT = 100n;
export const MAX_BASIS_POINTS = BASIS_POINTS_DENOMINATOR;

export const isBasisPointsInRange = (basisPoints: bigint): boolean =>
  basisPoints >= 0n && basisPoints <= MAX_BASIS_POINTS;

export const applyBasisPoints = (
  base: bigint,
  basisPoints: bigint,
): bigint => divideRoundHalfUp(base * basisPoints, BASIS_POINTS_DENOMINATOR);
