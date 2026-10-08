// A shared number means two or more DISTINCT recipients resolve to the same
// destination. This is computed from a set of `{ personId, phone }` entries so
// the SAME rule is used by the server (after overrides are applied) and by the
// client (from the recipients still in the form and their current numbers).
export type SharedPhoneWarning = {
  phone: string;
  /** The distinct recipients that resolve to the same number. */
  personIds: string[];
};

/**
 * Reports every number used by two or more distinct recipients.
 *
 * A `null`/empty phone is ignored (it is not a destination), and a number that
 * appears twice for the SAME recipient is not a warning — only a number shared
 * across distinct recipients is.
 */
export const computeSharedPhoneWarnings = (
  entries: readonly { personId: string; phone: string | null }[],
): SharedPhoneWarning[] => {
  const personIdsByPhone = new Map<string, string[]>();

  for (const entry of entries) {
    if (entry.phone === null || entry.phone.length === 0) {
      continue;
    }

    const existing = personIdsByPhone.get(entry.phone) ?? [];

    existing.push(entry.personId);
    personIdsByPhone.set(entry.phone, existing);
  }

  const warnings: SharedPhoneWarning[] = [];

  for (const [phone, personIds] of personIdsByPhone) {
    if (personIds.length > 1) {
      warnings.push({ phone, personIds });
    }
  }

  return warnings;
};
