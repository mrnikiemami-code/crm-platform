import { normalizeMoneyFigureText } from 'src/domain/money/money-input-text';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// IRR is the canonical storage unit. Toman exists only where a person types a number or
// reads one, and it is always labelled.
//
// WHY THIS IS NOT A CURRENCY CONVERSION: the rial/toman difference is not an exchange
// rate — it is the same currency with a fixed 1:10 unit scale, like cents and dollars.
// Keeping it in the money module as an explicit UNIT, rather than as a rate table, means
// no code path can ever apply a floating-point rate to it.
export const TOMAN_TO_IRR_RATIO = 10n;

export const MONEY_UNITS = ['IRR', 'TOMAN'] as const;

export type MoneyUnit = (typeof MONEY_UNITS)[number];

// What the UI shows next to an amount. A bare number on a Persian invoice is ambiguous,
// and the difference between 100,000 rial and 100,000 toman is a factor of ten, so the
// unit is always part of the rendered string.
export const MONEY_UNIT_LABELS: Record<MoneyUnit, string> = {
  IRR: 'ریال',
  TOMAN: 'تومان',
};

// Micros are per IRR, always. A toman amount is converted ONCE, at the boundary.
export const tomanToIrrMicros = (tomanMicros: bigint): bigint =>
  tomanMicros * TOMAN_TO_IRR_RATIO;

// The reverse, and it can fail. Micros are fine enough to express a tenth of a rial, so an
// ordinary amount converts exactly; what cannot convert is a value whose rial figure carries a
// fraction of a micro, because dividing it by ten would drop that fraction. Refusing is the
// only honest answer — rounding here would report an amount the workspace never agreed to.
export const irrMicrosToTomanMicros = (irrMicros: bigint): Result<bigint> => {
  if (irrMicros % TOMAN_TO_IRR_RATIO !== 0n) {
    return refused(
      'AMOUNT_NOT_WHOLE_TOMAN',
      'this rial amount cannot be expressed in toman without dropping a fraction of a micro; show it in rial',
    );
  }

  return accepted(irrMicros / TOMAN_TO_IRR_RATIO);
};

export type ParsedMoneyInput = {
  // Micros of IRR — the stored form.
  irrMicros: bigint;
  // The unit the person actually typed, kept so the record can explain itself.
  unit: MoneyUnit;
};

// Reads what a person typed, in the unit they chose, and returns micros of IRR.
// Grouping separators are validated (never silently repaired). Incomplete trailing
// decimals are refused here — the UI may keep them as display-only intermediate text.
export const parseMoneyInput = (
  input: string,
  unit: MoneyUnit,
): Result<ParsedMoneyInput> => {
  const normalized = normalizeMoneyFigureText(input);

  if (!normalized.ok) {
    return normalized;
  }

  if (normalized.value.trailingDecimal) {
    return refused(
      'AMOUNT_NOT_A_DECIMAL',
      `expected a non-negative decimal with at most 6 fraction digits, received "${input.trim()}"`,
    );
  }

  const [unitsText, fractionText = ''] =
    normalized.value.asciiCompact.split('.');
  const fraction = fractionText.padEnd(6, '0');
  const typedMicros =
    BigInt(unitsText) * 1_000_000n + BigInt(fraction === '' ? '0' : fraction);

  return accepted({
    irrMicros: unit === 'TOMAN' ? tomanToIrrMicros(typedMicros) : typedMicros,
    unit,
  });
};

// The display form for a chosen unit, with the unit always stated. Toman is used only
// when the amount is a whole number of tomans; otherwise the caller gets the refusal and
// shows rial, instead of a rounded figure that reads as a different price.
export const formatMoneyForDisplay = ({
  irrMicros,
  unit,
  formatExact,
  formatPeople,
}: {
  irrMicros: bigint;
  unit: MoneyUnit;
  // Injected so this module never depends on the formatting helpers, which keeps the
  // conversion rules testable on their own.
  formatExact: (micros: bigint) => string;
  // Optional people-facing formatter (Persian digits / grouping). Defaults to exact.
  formatPeople?: (exact: string) => string;
}): Result<string> => {
  const render = (micros: bigint, label: string): string => {
    const exact = formatExact(micros);
    const figure =
      formatPeople === undefined ? exact : formatPeople(exact);

    return `${figure} ${label}`;
  };

  if (unit === 'IRR') {
    return accepted(render(irrMicros, MONEY_UNIT_LABELS.IRR));
  }

  const tomanMicros = irrMicrosToTomanMicros(irrMicros);

  if (!tomanMicros.ok) {
    return tomanMicros;
  }

  return accepted(render(tomanMicros.value, MONEY_UNIT_LABELS.TOMAN));
};
