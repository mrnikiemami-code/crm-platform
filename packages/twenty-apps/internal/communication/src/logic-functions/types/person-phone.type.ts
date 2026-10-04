// Minimal shape of the Person `phones` composite field as returned by the
// workspace API. It mirrors the platform's PHONES composite type without
// importing it, so the logic-function bundle stays small.
export type PersonPhones = {
  primaryPhoneNumber?: string | null;
  primaryPhoneCountryCode?: string | null;
  primaryPhoneCallingCode?: string | null;
  additionalPhones?: { number?: string | null }[] | null;
} | null;

export type PersonPhoneOption = {
  /** Stable key used by the UI to identify the selected number. */
  id: string;
  /** Exact value that will be passed to the provider as the recipient. */
  value: string;
  /** Whether this is the Person's primary number. */
  isPrimary: boolean;
};

// Builds the selectable phone options for a Person. The value is the exact
// destination that will be sent; no normalization is applied, per scope.
export const buildPersonPhoneOptions = (
  phones: PersonPhones,
): PersonPhoneOption[] => {
  const options: PersonPhoneOption[] = [];

  const primary = phones?.primaryPhoneNumber?.trim();

  if (primary !== undefined && primary.length > 0) {
    options.push({ id: 'primary', value: primary, isPrimary: true });
  }

  const additionalPhones = phones?.additionalPhones ?? [];

  additionalPhones.forEach((phone, index) => {
    const number = phone?.number?.trim();

    if (number !== undefined && number.length > 0) {
      options.push({
        id: `additional-${index}`,
        value: number,
        isPrimary: false,
      });
    }
  });

  return options;
};
