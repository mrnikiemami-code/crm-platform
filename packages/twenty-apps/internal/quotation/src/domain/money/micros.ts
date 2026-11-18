import { accepted, refused, type Result } from 'src/domain/shared/result';

// All money in this app is an integer number of micros, held in a bigint.
//
// WHY BIGINT AND NOT number: Twenty's CURRENCY field stores `amountMicros`, and a
// 1,000,000,000,000 rial quotation is 1e18 micros — far past Number.MAX_SAFE_INTEGER
// (9.007e15). A JS number cannot hold that exactly, so arithmetic on it silently
// changes the total. bigint has no such ceiling.
//
// WHY THE BOUNDARY LIMIT IS A SEPARATE CONCEPT: the value does not stay in bigint.
// It crosses Twenty's GraphQL layer, where the `BigFloat` scalar serialises with
// parseFloat and the currency transformer calls Number(). Anything above
// 2^53-1 therefore comes back from the server as a DIFFERENT number than it was
// written as. The domain can compute it; the platform cannot store it. That gap is
// what `fitsApiBoundary` makes explicit instead of discovering later on a real
// invoice.
export const MICROS_PER_UNIT = 1_000_000n;

// 2^53 - 1: the largest integer a JS number represents exactly, and therefore the
// largest amountMicros that survives a round trip through the API.
export const API_SAFE_MICROS_LIMIT = BigInt(Number.MAX_SAFE_INTEGER);

export const isApiSafeMicros = (micros: bigint): boolean => {
  const magnitude = micros < 0n ? -micros : micros;

  return magnitude <= API_SAFE_MICROS_LIMIT;
};

export const checkApiSafeMicros = (
  micros: bigint,
  label: string,
): Result<bigint> =>
  isApiSafeMicros(micros)
    ? accepted(micros)
    : refused(
        'AMOUNT_EXCEEDS_API_RANGE',
        `${label} is beyond the range Twenty can persist exactly (2^53-1 micros); raise the unit or store the exact decimal in a text field instead`,
      );

// The exact decimal form is how an amount is written to a TEXT field when it is
// too large for amountMicros, and how a snapshot records it. Always six decimals,
// never rounded: a value that does not fit loses nothing on the way out.
export const formatMicrosExact = (micros: bigint): string => {
  const negative = micros < 0n;
  const magnitude = negative ? -micros : micros;
  const units = magnitude / MICROS_PER_UNIT;
  const fraction = (magnitude % MICROS_PER_UNIT).toString().padStart(6, '0');

  return `${negative ? '-' : ''}${units}.${fraction}`;
};

const DECIMAL_AMOUNT = /^(-)?(\d+)(?:\.(\d{1,6}))?$/;

// Reads an exact decimal into micros. A seventh decimal digit is REFUSED rather
// than rounded: rounding at parse time is how a stored total ends up different
// from the one that was agreed, and there is no rounding rule at this layer that
// the caller could have chosen deliberately.
export const parseMicrosExact = (text: string): Result<bigint> => {
  const trimmed = text.trim();
  const match = DECIMAL_AMOUNT.exec(trimmed);

  if (match === null) {
    return refused(
      'AMOUNT_NOT_A_DECIMAL',
      `expected a decimal with at most 6 fraction digits, received "${trimmed}"`,
    );
  }

  const fraction = (match[3] ?? '').padEnd(6, '0');
  const magnitude =
    BigInt(match[2]) * MICROS_PER_UNIT + BigInt(fraction === '' ? '0' : fraction);

  return accepted(match[1] === '-' ? -magnitude : magnitude);
};
