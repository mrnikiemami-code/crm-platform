import {
  applyBasisPoints,
  divideRoundHalfUp,
  isBasisPointsInRange,
} from 'src/domain/money/arithmetic';
import { type LineDiscount } from 'src/domain/money/line';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Document-level discount applied AFTER line discounts and BEFORE tax.
//
// Allocation (auditable, deterministic):
//   share_i = halfUp(documentDiscount * net_i / sumNets) for i = 0..n-2
//   share_last = documentDiscount - sum(share_0..n-2)
// so sum(shares) === documentDiscount exactly. Lines with zero net get zero share;
// if every net is zero the discount must also be zero.

export type LineNetForAllocation = {
  netAfterLineDiscountMicros: bigint;
};

export const computeDocumentDiscountMicros = (
  discount: LineDiscount,
  sumOfLineNetsMicros: bigint,
): Result<bigint> => {
  if (sumOfLineNetsMicros < 0n) {
    return refused(
      'DOCUMENT_NET_NEGATIVE',
      'جمع خالص ردیف‌ها نمی‌تواند منفی باشد',
    );
  }

  switch (discount.kind) {
    case 'NONE':
      return accepted(0n);
    case 'RATE': {
      if (!isBasisPointsInRange(discount.basisPoints)) {
        return refused(
          'DOCUMENT_DISCOUNT_RATE_OUT_OF_RANGE',
          'درصد تخفیف کل باید بین ۰ و ۱۰۰ باشد',
        );
      }

      return accepted(
        applyBasisPoints(sumOfLineNetsMicros, discount.basisPoints),
      );
    }
    case 'AMOUNT': {
      if (discount.micros < 0n) {
        return refused(
          'DOCUMENT_DISCOUNT_NEGATIVE',
          'تخفیف کل نمی‌تواند منفی باشد',
        );
      }

      if (discount.micros > sumOfLineNetsMicros) {
        return refused(
          'DOCUMENT_DISCOUNT_EXCEEDS_NET',
          'تخفیف کل نمی‌تواند از جمع خالص پس از تخفیف ردیف‌ها بیشتر باشد',
        );
      }

      return accepted(discount.micros);
    }
  }
};

export const allocateDocumentDiscount = (
  lines: LineNetForAllocation[],
  documentDiscountMicros: bigint,
): Result<bigint[]> => {
  if (lines.length === 0) {
    return refused('DOCUMENT_HAS_NO_LINES', 'حداقل یک ردیف لازم است');
  }

  if (documentDiscountMicros < 0n) {
    return refused(
      'DOCUMENT_DISCOUNT_NEGATIVE',
      'تخفیف کل نمی‌تواند منفی باشد',
    );
  }

  if (documentDiscountMicros === 0n) {
    return accepted(lines.map(() => 0n));
  }

  const sumNets = lines.reduce(
    (sum, line) => sum + line.netAfterLineDiscountMicros,
    0n,
  );

  if (documentDiscountMicros > sumNets) {
    return refused(
      'DOCUMENT_DISCOUNT_EXCEEDS_NET',
      'تخفیف کل نمی‌تواند از جمع خالص پس از تخفیف ردیف‌ها بیشتر باشد',
    );
  }

  if (sumNets === 0n) {
    return refused(
      'DOCUMENT_DISCOUNT_ON_ZERO_NET',
      'تخفیف کل روی سند با خالص صفر مجاز نیست',
    );
  }

  const shares: bigint[] = [];
  let allocated = 0n;

  for (let index = 0; index < lines.length; index += 1) {
    if (index === lines.length - 1) {
      shares.push(documentDiscountMicros - allocated);
      break;
    }

    const share = divideRoundHalfUp(
      documentDiscountMicros * lines[index].netAfterLineDiscountMicros,
      sumNets,
    );

    shares.push(share);
    allocated += share;
  }

  return accepted(shares);
};
