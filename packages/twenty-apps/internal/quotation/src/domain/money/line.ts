import {
  applyBasisPoints,
  divideRoundHalfUp,
  isBasisPointsInRange,
} from 'src/domain/money/arithmetic';
import { QUANTITY_SCALE } from 'src/domain/money/quantity';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// One line of a quotation, reduced to what money cares about.
//
// THE CALCULATION ORDER IS A CONTRACT, NOT A CONVENIENCE:
//   gross    = round(quantity x unitPrice)
//   discount = a rate on gross, or a stated amount
//   net      = gross - discount
//   tax      = round(net x taxRate)      <- on the discounted amount
//   total    = net + tax
// Tax on the DISCOUNTED amount is the Iranian VAT convention, but it is the kind of
// rule that needs an accountant's sign-off rather than a developer's assumption, so
// it is stated here once, tested, and left as an open decision in the S1 report.
//
// Every line is rounded to a whole micro ONCE, at each step, and the document total
// is the sum of the rounded line totals. Nothing is re-rounded at the document
// level, which is what makes `sum(lines) === total` exact rather than approximate.
export type LineDiscount =
  | { kind: 'NONE' }
  | { kind: 'RATE'; basisPoints: bigint }
  | { kind: 'AMOUNT'; micros: bigint };

export type QuotationLineInput = {
  quantityScaled: bigint;
  unitPriceMicros: bigint;
  discount: LineDiscount;
  taxRateBasisPoints: bigint;
};

export type QuotationLineAmounts = {
  grossMicros: bigint;
  discountMicros: bigint;
  netMicros: bigint;
  taxMicros: bigint;
  totalMicros: bigint;
};

export const computeLineAmounts = (
  input: QuotationLineInput,
): Result<QuotationLineAmounts> => {
  if (input.quantityScaled <= 0n) {
    return refused(
      'QUANTITY_NOT_POSITIVE',
      'a quotation line must have a positive quantity',
    );
  }

  if (input.unitPriceMicros < 0n) {
    return refused('UNIT_PRICE_NEGATIVE', 'a unit price cannot be negative');
  }

  if (!isBasisPointsInRange(input.taxRateBasisPoints)) {
    return refused(
      'TAX_RATE_OUT_OF_RANGE',
      'a tax rate must be between 0% and 100% in basis points',
    );
  }

  const grossMicros = divideRoundHalfUp(
    input.quantityScaled * input.unitPriceMicros,
    QUANTITY_SCALE,
  );

  const discountResult = computeDiscount(input.discount, grossMicros);

  if (!discountResult.ok) {
    return discountResult;
  }

  const discountMicros = discountResult.value;
  const netMicros = grossMicros - discountMicros;
  const taxMicros = applyBasisPoints(netMicros, input.taxRateBasisPoints);

  return accepted({
    grossMicros,
    discountMicros,
    netMicros,
    taxMicros,
    totalMicros: netMicros + taxMicros,
  });
};

const computeDiscount = (
  discount: LineDiscount,
  grossMicros: bigint,
): Result<bigint> => {
  switch (discount.kind) {
    case 'NONE':
      return accepted(0n);
    case 'RATE': {
      if (!isBasisPointsInRange(discount.basisPoints)) {
        return refused(
          'DISCOUNT_RATE_OUT_OF_RANGE',
          'a discount rate must be between 0% and 100% in basis points',
        );
      }

      return accepted(applyBasisPoints(grossMicros, discount.basisPoints));
    }
    case 'AMOUNT': {
      if (discount.micros < 0n) {
        return refused('DISCOUNT_NEGATIVE', 'a discount cannot be negative');
      }

      // A discount larger than the line is refused rather than clamped: clamping
      // would silently turn a data-entry mistake into a free line.
      if (discount.micros > grossMicros) {
        return refused(
          'DISCOUNT_EXCEEDS_LINE',
          'a discount cannot be larger than the line it is applied to',
        );
      }

      return accepted(discount.micros);
    }
  }
};
