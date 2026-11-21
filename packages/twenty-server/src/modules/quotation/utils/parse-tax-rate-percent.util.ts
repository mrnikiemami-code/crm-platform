// Server-side parser for the percentage an operator types in the tax settings.
//
// WHY IT IS DUPLICATED HERE: the rate is now written by the REST boundary, and
// twenty-server must not import twenty-apps. This checks the *shape* of a
// percentage only; the tax arithmetic still belongs to the app's Money Domain and
// to `quotation-draft-totals.util`.
const BASIS_POINTS_PER_PERCENT = BigInt(100);
const MAX_BASIS_POINTS = BigInt(10000);

export type TaxRateParseOutcome =
  | { ok: true; rateBasisPoints: bigint }
  | { ok: false; code: string; message: string };

const refused = (code: string, message: string): TaxRateParseOutcome => ({
  ok: false,
  code,
  message,
});

// Persian and Arabic digits are how this text is actually typed in the panel.
const toAsciiDigits = (text: string): string =>
  text.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (digit) => {
    const codePoint = digit.codePointAt(0) ?? 0;
    const base = codePoint >= 0x06f0 ? 0x06f0 : 0x0660;

    return String(codePoint - base);
  });

export const parseTaxRatePercent = (text: string): TaxRateParseOutcome => {
  // The momayyez becomes a dot rather than being stripped: concatenating the
  // digits would turn 10.5% into 105%.
  const normalized = toAsciiDigits(text)
    .replace(/[\u066b\u060c,]/g, '.')
    .replace(/[\u066c\u00a0\u202f\s٪%]/g, '');

  if (normalized === '') {
    return refused('TAX_RATE_REQUIRED', 'درصد مالیات را وارد کنید');
  }

  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(normalized);

  if (match === null) {
    return refused(
      'TAX_RATE_INVALID',
      'درصد مالیات باید عددی با حداکثر دو رقم اعشار باشد (مثلاً ۹ یا ۱۰٫۵)',
    );
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? '').padEnd(2, '0'));
  const basisPoints = whole * BASIS_POINTS_PER_PERCENT + fraction;

  if (basisPoints > MAX_BASIS_POINTS) {
    return refused('TAX_RATE_OUT_OF_RANGE', 'درصد مالیات باید بین ۰ و ۱۰۰ باشد');
  }

  return { ok: true, rateBasisPoints: basisPoints };
};

export const formatBasisPointsAsPercent = (basisPoints: bigint): string => {
  const whole = basisPoints / BASIS_POINTS_PER_PERCENT;
  const fraction = basisPoints % BASIS_POINTS_PER_PERCENT;

  if (fraction === BigInt(0)) {
    return whole.toString();
  }

  return `${whole.toString()}.${fraction
    .toString()
    .padStart(2, '0')
    .replace(/0$/, '')}`;
};
