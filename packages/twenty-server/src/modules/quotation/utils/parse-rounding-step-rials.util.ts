export type ParseRoundingStepOutcome =
  | { ok: true; stepRials: bigint }
  | { ok: false; code: string; message: string };

// Positive whole IRR only. Persian digits and grouping separators accepted.
export const parseRoundingStepRialsText = (
  text: string,
): ParseRoundingStepOutcome => {
  const trimmed = text
    .trim()
    .replace(/[,\u066C\u060C\s]/g, '')
    .replace(/[\u06F0-\u06F9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    );

  if (!/^[1-9]\d{0,17}$/.test(trimmed)) {
    return {
      ok: false,
      code: 'ROUNDING_STEP_INVALID',
      message: 'مبنای رُند باید عدد صحیح مثبت برحسب ریال باشد',
    };
  }

  return { ok: true, stepRials: BigInt(trimmed) };
};

export const floorMicrosToStepRials = (
  micros: bigint,
  stepRials: bigint,
): { payableMicros: bigint; roundingMicros: bigint } => {
  const fractionScale = BigInt(1_000_000);
  const stepMicros = stepRials * fractionScale;

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
