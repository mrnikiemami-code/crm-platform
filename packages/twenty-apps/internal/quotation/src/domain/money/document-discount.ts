import {
  applyBasisPoints,
  isBasisPointsInRange,
} from 'src/domain/money/arithmetic';
import { type LineDiscount } from 'src/domain/money/line';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// Document-level discount applied AFTER line discounts and BEFORE tax.
//
// Allocation (largest-remainder + capacity, deterministic):
//   1. zero-net lines get 0 and never receive remainder
//   2. floor share_i = floor(discount * net_i / sumNets), capped at net_i
//   3. remaining micros go one-by-one to lines with spare capacity, ordered by
//      fractional remainder descending, then by stable line index ascending
// so: sum(shares) === discount, 0 <= share_i <= net_i, reproducible.

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

  for (const line of lines) {
    if (line.netAfterLineDiscountMicros < 0n) {
      return refused(
        'DOCUMENT_NET_NEGATIVE',
        'خالص ردیف نمی‌تواند منفی باشد',
      );
    }
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

  // Floor shares; zero-net lines stay at 0 by construction.
  const shares: bigint[] = lines.map((line) => {
    if (line.netAfterLineDiscountMicros === 0n) {
      return 0n;
    }

    const uncapped =
      (documentDiscountMicros * line.netAfterLineDiscountMicros) / sumNets;

    return uncapped > line.netAfterLineDiscountMicros
      ? line.netAfterLineDiscountMicros
      : uncapped;
  });

  let remaining =
    documentDiscountMicros - shares.reduce((sum, share) => sum + share, 0n);

  // Fractional part for ranking: (discount * net) % sumNets — larger first.
  // Tie-break by ascending index so the order is fully reproducible.
  const rankOrder = lines
    .map((line, index) => ({
      index,
      net: line.netAfterLineDiscountMicros,
      fractional:
        line.netAfterLineDiscountMicros === 0n
          ? -1n
          : (documentDiscountMicros * line.netAfterLineDiscountMicros) %
            sumNets,
    }))
    .filter((entry) => entry.net > 0n)
    .sort((left, right) => {
      if (left.fractional !== right.fractional) {
        return left.fractional > right.fractional ? -1 : 1;
      }

      return left.index - right.index;
    });

  // One micro per eligible line in rank order (classic largest-remainder).
  for (const entry of rankOrder) {
    if (remaining === 0n) {
      break;
    }

    if (shares[entry.index] >= entry.net) {
      continue;
    }

    shares[entry.index] += 1n;
    remaining -= 1n;
  }

  if (remaining !== 0n) {
    return refused(
      'DOCUMENT_DISCOUNT_ALLOCATION_FAILED',
      'تخفیف کل قابل تخصیص بدون عبور از ظرفیت ردیف‌ها نیست',
    );
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (shares[index] < 0n) {
      return refused(
        'DOCUMENT_DISCOUNT_ALLOCATION_FAILED',
        'سهم تخفیف ردیف نمی‌تواند منفی باشد',
      );
    }

    if (shares[index] > lines[index].netAfterLineDiscountMicros) {
      return refused(
        'DOCUMENT_DISCOUNT_ALLOCATION_FAILED',
        'سهم تخفیف ردیف از خالص همان ردیف بیشتر است',
      );
    }
  }

  const allocated = shares.reduce((sum, share) => sum + share, 0n);

  if (allocated !== documentDiscountMicros) {
    return refused(
      'DOCUMENT_DISCOUNT_ALLOCATION_FAILED',
      'مجموع سهم ردیف‌ها با تخفیف کل برابر نیست',
    );
  }

  return accepted(shares);
};
