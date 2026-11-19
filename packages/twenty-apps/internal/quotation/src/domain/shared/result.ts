// One shape for "this input was refused", used everywhere in the quotation
// domain. A refusal always carries a stable machine code, because the caller is
// often a logic function that must log WHY without leaking a customer's amount
// into a log the whole workspace can read.
export type Refusal = {
  code: string;
  detail: string;
};

export type Result<TValue> = { ok: true; value: TValue } | { ok: false; refusal: Refusal };

// Function declarations (not `<T>() =>` arrows): front-component esbuild loads
// app `.ts` sources with the `tsx` loader, which would parse arrow generics as JSX.
export function accepted<TValue>(value: TValue): Result<TValue> {
  return {
    ok: true,
    value,
  };
}

export function refused<TValue = never>(
  code: string,
  detail: string,
): Result<TValue> {
  return { ok: false, refusal: { code, detail } };
}
