// Pure mapping from the person-phones route response to the composer's phone
// load state. Kept out of the React component so the shipped behavior can be
// unit-tested without the front-component sandbox.

export type PhoneOption = {
  id: string;
  value: string;
  isPrimary: boolean;
};

export type PhoneOptionsLoadState =
  /** A request is in flight; nothing can be claimed about the result yet. */
  | { kind: 'LOADING' }
  /** A successful response carrying at least one phone number. */
  | { kind: 'READY'; phones: PhoneOption[]; selectedPhone: string }
  /** A successful response carrying an empty list — the only honest "none". */
  | { kind: 'EMPTY' }
  /**
   * The request failed (HTTP error, network error, or an unreadable body).
   * A failure is never an empty result: the numbers may still exist.
   */
  | { kind: 'ERROR' };

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const toPhoneOption = (value: unknown): PhoneOption | null => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = record.id;
  const phone = record.value;

  if (!isNonEmptyString(id) || !isNonEmptyString(phone)) {
    return null;
  }

  return { id, value: phone, isPrimary: record.isPrimary === true };
};

/**
 * Interprets a person-phones response into a load state.
 *
 * `ok` reflects the HTTP outcome; a non-ok response, a missing `success: true`
 * flag, or a malformed body are all ERROR — never EMPTY. Only a genuinely
 * successful response with an empty `phones` array is EMPTY.
 */
export const resolvePhoneOptionsLoadState = (response: {
  ok: boolean;
  data: unknown;
}): PhoneOptionsLoadState => {
  if (!response.ok) {
    return { kind: 'ERROR' };
  }

  if (response.data === null || typeof response.data !== 'object') {
    return { kind: 'ERROR' };
  }

  const payload = response.data as Record<string, unknown>;

  if (payload.success !== true) {
    return { kind: 'ERROR' };
  }

  if (!Array.isArray(payload.phones)) {
    return { kind: 'ERROR' };
  }

  const phones = payload.phones
    .map(toPhoneOption)
    .filter((phone): phone is PhoneOption => phone !== null);

  if (phones.length === 0) {
    return { kind: 'EMPTY' };
  }

  const primary = phones.find((phone) => phone.isPrimary) ?? phones[0];

  return { kind: 'READY', phones, selectedPhone: primary.value };
};

/** Send is allowed only when a real number is loaded and chosen. */
export const isPhoneSelectionReady = (
  state: PhoneOptionsLoadState,
): boolean => state.kind === 'READY' && state.selectedPhone.length > 0;
