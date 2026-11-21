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

  return failing === undefined
    ? { ok: true }
    : {
        ok: false,
        code: 'TOTALS_INCONSISTENT',
        message: failing.message,
      };
};
