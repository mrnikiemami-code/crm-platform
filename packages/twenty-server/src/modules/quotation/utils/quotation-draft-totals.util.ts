import {
  type QuotationDraftSaveHeader,
  type QuotationDraftSaveLine,
} from 'src/modules/quotation/types/quotation-draft-save.type';

// Exact amounts are stored with up to six fraction digits and never pass through
// a float. The arithmetic here only checks that the plan the app computed through
// its Money Domain adds up; it never derives a price, discount or tax rate.
const EXACT_AMOUNT_PATTERN = /^-?\d{1,18}(?:\.\d{1,6})?$/;
const FRACTION_DIGITS = 6;
// es2018 target: bigint literals are not available, only BigInt() calls.
const FRACTION_SCALE = BigInt(1000000);

export type QuotationDraftTotalsDecision =
  | { ok: true }
  | { ok: false; code: string; message: string };

export const isExactAmountText = (value: unknown): value is string =>
  typeof value === 'string' && EXACT_AMOUNT_PATTERN.test(value.trim());

export const parseExactAmountToMicros = (value: string): bigint | null => {
  if (!isExactAmountText(value)) {
    return null;
  }

  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [integerPart, fractionPart = ''] = unsigned.split('.');
  const fraction = (fractionPart + '000000').slice(0, FRACTION_DIGITS);
  const micros = BigInt(integerPart) * FRACTION_SCALE + BigInt(fraction);

  return negative ? -micros : micros;
};

const sum = (values: bigint[]): bigint =>
  values.reduce((total, value) => total + value, BigInt(0));

// Basis points are integers (100% = 10000 bp). Halves round away from zero, the
// same rule the app's Money Domain uses; a different rule here would reject a
// document the app computed correctly.
const BASIS_POINTS_DENOMINATOR = BigInt(10000);

const applyBasisPoints = (base: bigint, basisPoints: bigint): bigint => {
  const numerator = base * basisPoints;
  const negative = numerator < BigInt(0);
  const absolute = negative ? -numerator : numerator;
  const quotient = absolute / BASIS_POINTS_DENOMINATOR;
  const remainder = absolute % BASIS_POINTS_DENOMINATOR;
  const rounded =
    remainder * BigInt(2) >= BASIS_POINTS_DENOMINATOR
      ? quotient + BigInt(1)
      : quotient;

  return negative ? -rounded : rounded;
};

const LINE_EXACT_KEYS = [
  'quantityExact',
  'unitPriceExact',
  'grossExact',
  'discountExact',
  'discountInputExact',
  'documentDiscountExact',
  'taxExact',
  'totalExact',
] as const;

const HEADER_EXACT_KEYS = [
  'documentDiscountInputExact',
  'grossExact',
  'lineDiscountExact',
  'documentDiscountExact',
  'netExact',
  'taxExact',
  'roundingExact',
  'totalExact',
] as const;

const parsePositiveStepRials = (value: string | null | undefined): bigint | null => {
  if (value === null || value === undefined || value.trim() === '') {
    // Legacy documents without a named rule keep whole-rial floor (step 1).
    return BigInt(1);
  }

  const trimmed = value.trim();

  if (!/^[1-9]\d{0,17}$/.test(trimmed)) {
    return null;
  }

  return BigInt(trimmed);
};

const floorMicrosToStep = (
  micros: bigint,
  stepRials: bigint,
): { payableMicros: bigint; roundingMicros: bigint } => {
  const stepMicros = stepRials * FRACTION_SCALE;

  if (micros >= BigInt(0)) {
    const payableMicros = (micros / stepMicros) * stepMicros;

    return {
      payableMicros,
      roundingMicros: payableMicros - micros,
    };
  }

  if (micros % stepMicros === BigInt(0)) {
    return { payableMicros: micros, roundingMicros: BigInt(0) };
  }

  const payableMicros = (micros / stepMicros - BigInt(1)) * stepMicros;

  return {
    payableMicros,
    roundingMicros: payableMicros - micros,
  };
};

export const evaluateQuotationDraftTotals = ({
  header,
  lines,
}: {
  header: QuotationDraftSaveHeader;
  lines: QuotationDraftSaveLine[];
}): QuotationDraftTotalsDecision => {
  if (lines.length === 0) {
    return {
      ok: false,
      code: 'DOCUMENT_HAS_NO_LINES',
      message: 'a quotation needs at least one line',
    };
  }

  for (const key of HEADER_EXACT_KEYS) {
    if (!isExactAmountText(header[key])) {
      return {
        ok: false,
        code: 'INVALID_EXACT_AMOUNT',
        message: `header.${key} is not an exact decimal`,
      };
    }
  }

  for (const [index, line] of lines.entries()) {
    for (const key of LINE_EXACT_KEYS) {
      if (!isExactAmountText(line[key])) {
        return {
          ok: false,
          code: 'INVALID_EXACT_AMOUNT',
          message: `lines[${index}].${key} is not an exact decimal`,
        };
      }
    }
  }

  const headerMicros = Object.fromEntries(
    HEADER_EXACT_KEYS.map((key) => [
      key,
      parseExactAmountToMicros(header[key]) as bigint,
    ]),
  ) as Record<(typeof HEADER_EXACT_KEYS)[number], bigint>;

  const lineMicros = lines.map(
    (line) =>
      Object.fromEntries(
        LINE_EXACT_KEYS.map((key) => [
          key,
          parseExactAmountToMicros(line[key]) as bigint,
        ]),
      ) as Record<(typeof LINE_EXACT_KEYS)[number], bigint>,
  );

  // When the app declares the rate it used, the server re-derives every line's
  // tax instead of trusting the amounts it is asked to store. A client cannot
  // lower the tax on a document by sending a smaller taxExact.
  //
  // WS3: each line may carry its own frozen rates; absent line rates inherit the
  // document default. Duty is summed from per-line applications (same as Money Domain).
  if (
    typeof header.taxRateBasisPoints === 'string' &&
    /^\d{1,5}$/.test(header.taxRateBasisPoints)
  ) {
    const headerRate = BigInt(header.taxRateBasisPoints);
    const headerDutyRate =
      typeof header.dutyRateBasisPoints === 'string' &&
      /^\d{1,5}$/.test(header.dutyRateBasisPoints)
        ? BigInt(header.dutyRateBasisPoints)
        : BigInt(0);

    if (headerRate > BASIS_POINTS_DENOMINATOR) {
      return {
        ok: false,
        code: 'TAX_RATE_OUT_OF_RANGE',
        message: 'the declared tax rate is outside 0%..100%',
      };
    }

    if (
      headerDutyRate > BASIS_POINTS_DENOMINATOR ||
      headerRate + headerDutyRate > BASIS_POINTS_DENOMINATOR
    ) {
      return {
        ok: false,
        code: 'DUTY_RATE_OUT_OF_RANGE',
        message:
          'the declared duty rate is outside 0%..100% or tax plus duty exceeds 100%',
      };
    }

    let expectedDutySum = BigInt(0);

    for (const [index, line] of lineMicros.entries()) {
      const lineRow = lines[index];
      const lineTaxRateText =
        typeof lineRow.taxRateBasisPoints === 'string' &&
        /^\d{1,5}$/.test(lineRow.taxRateBasisPoints)
          ? lineRow.taxRateBasisPoints
          : header.taxRateBasisPoints;
      const lineDutyRateText =
        typeof lineRow.dutyRateBasisPoints === 'string' &&
        /^\d{1,5}$/.test(lineRow.dutyRateBasisPoints)
          ? lineRow.dutyRateBasisPoints
          : typeof header.dutyRateBasisPoints === 'string' &&
              /^\d{1,5}$/.test(header.dutyRateBasisPoints)
            ? header.dutyRateBasisPoints
            : '0';

      const rate = BigInt(lineTaxRateText as string);
      const dutyRate = BigInt(lineDutyRateText);

      if (rate > BASIS_POINTS_DENOMINATOR) {
        return {
          ok: false,
          code: 'TAX_RATE_OUT_OF_RANGE',
          message: `lines[${index}] tax rate is outside 0%..100%`,
        };
      }

      if (
        dutyRate > BASIS_POINTS_DENOMINATOR ||
        rate + dutyRate > BASIS_POINTS_DENOMINATOR
      ) {
        return {
          ok: false,
          code: 'DUTY_RATE_OUT_OF_RANGE',
          message: `lines[${index}] duty rate is outside 0%..100% or tax plus duty exceeds 100%`,
        };
      }

      const taxableNet =
        line.grossExact - line.discountExact - line.documentDiscountExact;
      const lineDuty = applyBasisPoints(taxableNet, dutyRate);
      const expectedTax =
        applyBasisPoints(taxableNet, rate) + lineDuty;

      expectedDutySum += lineDuty;

      if (line.taxExact !== expectedTax) {
        return {
          ok: false,
          code: 'TAX_AMOUNT_MISMATCH',
          message: `lines[${index}].taxExact is not the declared rate applied to its net`,
        };
      }
    }

    // Absent means a caller that predates the split: nothing to check.
    if (isExactAmountText(header.dutyExact)) {
      const declaredDuty = parseExactAmountToMicros(
        header.dutyExact as string,
      ) as bigint;

      if (declaredDuty !== expectedDutySum) {
        return {
          ok: false,
          code: 'DUTY_AMOUNT_MISMATCH',
          message: 'header.dutyExact is not the sum of per-line duty amounts',
        };
      }
    }
  }

  const checks: Array<{ ok: boolean; message: string }> = [
    {
      // net = gross − line discounts − document discount
      ok:
        headerMicros.netExact ===
        headerMicros.grossExact -
          headerMicros.lineDiscountExact -
          headerMicros.documentDiscountExact,
      message: 'header net does not equal gross minus all discounts',
    },
    {
      // payable = net + tax + rounding
      ok:
        headerMicros.totalExact ===
        headerMicros.netExact +
          headerMicros.taxExact +
          headerMicros.roundingExact,
      message: 'header total does not equal net plus tax plus rounding',
    },
    {
      ok:
        sum(lineMicros.map((line) => line.grossExact)) ===
        headerMicros.grossExact,
      message: 'line gross amounts do not add up to the header gross',
    },
    {
      ok:
        sum(lineMicros.map((line) => line.discountExact)) ===
        headerMicros.lineDiscountExact,
      message: 'line discounts do not add up to the header line discount',
    },
    {
      ok:
        sum(lineMicros.map((line) => line.documentDiscountExact)) ===
        headerMicros.documentDiscountExact,
      message:
        'line document-discount shares do not add up to the header document discount',
    },
    {
      ok:
        sum(lineMicros.map((line) => line.taxExact)) === headerMicros.taxExact,
      message: 'line taxes do not add up to the header tax',
    },
    {
      ok:
        sum(lineMicros.map((line) => line.totalExact)) ===
        headerMicros.netExact + headerMicros.taxExact,
      message: 'line totals do not add up to header net plus tax',
    },
    {
      // A posted payable is a whole rial; the rounding field carries the rest.
      ok: headerMicros.totalExact % FRACTION_SCALE === BigInt(0),
      message: 'header total is not a whole rial amount',
    },
  ];

  const failing = checks.find((check) => !check.ok);

  if (failing !== undefined) {
    return {
      ok: false,
      code: 'TOTALS_INCONSISTENT',
      message: failing.message,
    };
  }

  const stepRials = parsePositiveStepRials(header.roundingStepRials);

  if (stepRials === null) {
    return {
      ok: false,
      code: 'ROUNDING_STEP_INVALID',
      message: 'مبنای رُند باید عدد صحیح مثبت برحسب ریال باشد',
    };
  }

  const rawPayable =
    headerMicros.netExact + headerMicros.taxExact;
  const expected = floorMicrosToStep(rawPayable, stepRials);

  if (rawPayable > BigInt(0) && expected.payableMicros === BigInt(0)) {
    return {
      ok: false,
      code: 'PAYABLE_ROUNDED_TO_ZERO',
      message:
        'مبلغ پس از رُند کردن صفر می‌شود؛ مبنای کوچک‌تری انتخاب کنید یا مبلغ را افزایش دهید',
    };
  }

  if (
    headerMicros.totalExact !== expected.payableMicros ||
    headerMicros.roundingExact !== expected.roundingMicros
  ) {
    return {
      ok: false,
      code: 'ROUNDING_MISMATCH',
      message: 'مبلغ رُند شده با مبنای انتخاب‌شده هم‌خوان نیست',
    };
  }

  const preRoundText = header.preRoundTotalExact;

  if (
    typeof preRoundText === 'string' &&
    preRoundText.trim() !== ''
  ) {
    const preRoundMicros = parseExactAmountToMicros(preRoundText);

    if (preRoundMicros === null || preRoundMicros !== rawPayable) {
      return {
        ok: false,
        code: 'PRE_ROUND_MISMATCH',
        message: 'مبلغ قبل از رُند با خالص به‌علاوه مالیات هم‌خوان نیست',
      };
    }
  }

  return { ok: true };
};
