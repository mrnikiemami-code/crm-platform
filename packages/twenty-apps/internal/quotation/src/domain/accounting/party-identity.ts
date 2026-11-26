// National identifiers are strings: leading zeroes are significant. Length determines
// the structural kind under the current adapter contract; it is not a civil-registry check.
export const asciiDigits = (value: string): string =>
  value.replace(/[۰-۹٠-٩]/g, (digit) =>
    String('۰۱۲۳۴۵۶۷۸۹'.includes(digit)
      ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)
      : '٠١٢٣٤٥٦٧٨٩'.indexOf(digit)),
  );

export const normalizeNationalCode = (value: string | null | undefined): string | null => {
  const normalized = asciiDigits(value ?? '').trim().replace(/[\s-]/g, '');
  return /^\d{10,11}$/.test(normalized) ? normalized : null;
};

export const partyTypeFromNationalCode = (value: string | null | undefined): 'PERSON' | 'COMPANY' | null => {
  const code = normalizeNationalCode(value);
  return code === null ? null : code.length === 10 ? 'PERSON' : 'COMPANY';
};

export const normalizePartyName = (value: string): string =>
  value.trim().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c]+/g, ' ').toLowerCase();

export const splitPartyPersonName = (value: string): { firstName: string; lastName: string } => {
  const parts = value.trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
};

// Only a structurally valid Iranian mobile is promoted to the standard Person phones
// composite. Empty or invalid vendor values never erase existing CRM contact data.
export const normalizeIranMobile = (value: string | null | undefined): string | null => {
  const number = asciiDigits(value ?? '').trim().replace(/[\s()-]/g, '');
  const match = /^(?:\+98|0098|98|0)?(9\d{9})$/.exec(number);
  return match?.[1] ?? null;
};
