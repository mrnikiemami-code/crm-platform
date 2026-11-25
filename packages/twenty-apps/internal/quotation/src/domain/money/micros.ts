import { accepted, refused, type Result } from 'src/domain/shared/result';

// ONE authoritative monetary representation: an integer number of micros held in a
// bigint, and NOTHING else. Every object stores it as the exact decimal string produced
// by `formatMicrosExact`, and every other form (a JS number for display, rial integers
// for an accounting wire format) is derived on demand and never stored.
//
// WHY THERE IS NO NUMERIC OR CURRENCY COLUMN: Twenty's GraphQL layer serialises a
// numeric field with `parseFloat` on read and `Number()` on write
// (big-float.scalar.ts, transform-numeric-field.util.ts). A value above 2^53-1 micros
// therefore comes back from the server as a DIFFERENT integer — silently, with no error.
// Storing a second, lossy copy alongside the exact one would be two independent amounts
// that can disagree, which is precisely what the architect rejected. The fix is to have
// only the lossless one.
//
// The cost is that the platform cannot sort or aggregate money natively. That is
// recovered with `formatMicrosSortable`, a fixed-width form that orders lexicographically
// exactly as the numbers order, so a text index still sorts correctly.
export const MICROS_PER_UNIT = 1_000_000n;

// Document payable: floor toward −∞ to a whole IRR (step = 1). Prefer
// floorMicrosToStepRials when a named rule supplies an arbitrary step.
export const roundMicrosToWholeRial = (micros: bigint): bigint => {
  if (micros >= 0n) {
    return (micros / MICROS_PER_UNIT) * MICROS_PER_UNIT;
  }

  if (micros % MICROS_PER_UNIT === 0n) {
    return micros;
  }

  return (micros / MICROS_PER_UNIT - 1n) * MICROS_PER_UNIT;
};

export const isWholeRialMicros = (micros: bigint): boolean =>
  micros % MICROS_PER_UNIT === 0n;

// The largest integer a JS number represents exactly. Not a storage limit any more — a
// storage limit would mean rejecting the data — but the boundary beyond which a DISPLAY
// projection through `Number` stops being exact, so `toDisplayNumber` refuses there
// instead of returning a wrong figure.
export const EXACT_NUMBER_LIMIT = BigInt(Number.MAX_SAFE_INTEGER);

export const isExactlyRepresentableAsNumber = (micros: bigint): boolean => {
  const magnitude = micros < 0n ? -micros : micros;

  return magnitude <= EXACT_NUMBER_LIMIT;
};

// Exact decimal text, always six fraction digits. This is THE stored form of an amount
// and also the form a snapshot records, so a value that cannot be shown in a UI number
// verbatim is still recorded verbatim.
export const formatMicrosExact = (micros: bigint): string => {
  const negative = micros < 0n;
  const magnitude = negative ? -micros : micros;
  const units = magnitude / MICROS_PER_UNIT;
  const fraction = (magnitude % MICROS_PER_UNIT).toString().padStart(6, '0');

  return `${negative ? '-' : ''}${units}.${fraction}`;
};

// Fixed-width, zero-padded, so text ordering equals numeric ordering even for negative
// values. Width: 20 digits of units covers ~1e14 rial in micros with room to spare, and
// the offset makes the sign part of the ordering instead of the alphabet.
const SORTABLE_UNIT_DIGITS = 20;
const SORTABLE_SIGN_OFFSET = 10n ** BigInt(SORTABLE_UNIT_DIGITS + 6);

export const formatMicrosSortable = (micros: bigint): string => {
  const shifted = micros + SORTABLE_SIGN_OFFSET;

  if (shifted < 0n) {
    throw new Error(
      'formatMicrosSortable: amount magnitude exceeds the sortable window',
    );
  }

  return shifted.toString().padStart(SORTABLE_UNIT_DIGITS + 7, '0');
};

const DECIMAL_AMOUNT = /^(-)?(\d+)(?:\.(\d{1,6}))?$/;

// Reads an exact decimal into micros. A seventh decimal digit is REFUSED rather than
// rounded: rounding at parse time is how a stored total ends up different from the one
// that was agreed, and there is no rounding rule at this layer that the caller could have
// chosen deliberately.
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

// The ONLY conversion into a JS number, and it refuses when the value would change.
// Used to fill a chart or a sort key that genuinely needs a number; never used to write a
// stored amount.
export const toExactNumberOrRefuse = (
  micros: bigint,
): Result<number> => {
  if (!isExactlyRepresentableAsNumber(micros)) {
    return refused(
      'AMOUNT_NOT_EXACTLY_REPRESENTABLE',
      'this amount cannot be shown as a JS number without changing it; display the exact decimal instead',
    );
  }

  return accepted(Number(micros));
};

// A stored amount must be a canonical string: re-formatting what was parsed has to give
// the same text, otherwise two records can hold the same value in two spellings and a
// unique index or a hash would treat them as different.
export const isCanonicalMicrosText = (text: string): boolean => {
  const parsed = parseMicrosExact(text);

  return parsed.ok && formatMicrosExact(parsed.value) === text;
};
