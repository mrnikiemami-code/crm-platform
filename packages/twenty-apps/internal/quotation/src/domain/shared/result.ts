// One shape for "this input was refused", used everywhere in the quotation
// domain. A refusal always carries a stable machine code, because the caller is
// often a logic function that must log WHY without leaking a customer's amount
// into a log the whole workspace can read.
export type Refusal = {
  code: string;
  detail: string;
};

export type Result<TValue> = { ok: true; value: TValue } | { ok: false; refusal: Refusal };

export const accepted = <TValue>(value: TValue): Result<TValue> => ({
  ok: true,
  value,
});

export const refused = <TValue = never>(
  code: string,
  detail: string,
): Result<TValue> => ({ ok: false, refusal: { code, detail } });
