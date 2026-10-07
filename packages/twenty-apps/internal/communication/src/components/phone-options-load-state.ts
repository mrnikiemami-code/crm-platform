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

  // EMPTY is reserved for a genuinely empty list. A list that carries entries
  // but none of them is a usable phone number is a malformed response, not an
  // absence of numbers.
  if (payload.phones.length === 0) {
    return { kind: 'EMPTY' };
  }

  const phones = payload.phones
    .map(toPhoneOption)
    .filter((phone): phone is PhoneOption => phone !== null);

  if (phones.length === 0) {
    return { kind: 'ERROR' };
  }

  const primary = phones.find((phone) => phone.isPrimary) ?? phones[0];

  return { kind: 'READY', phones, selectedPhone: primary.value };
};

/** Send is allowed only when a real number is loaded and chosen. */
export const isPhoneSelectionReady = (
  state: PhoneOptionsLoadState,
): boolean => state.kind === 'READY' && state.selectedPhone.length > 0;

export type PhoneOptionsTransport = () => Promise<{
  ok: boolean;
  data: unknown;
}>;

export type PhoneOptionsLoader = {
  /** Starts a load. Returns a promise that settles when this request does. */
  load: () => Promise<void>;
};

/**
 * Wraps the person-phones request with a monotonic request id so a slow earlier
 * response cannot overwrite the state produced by a newer request. Only the
 * latest request is allowed to publish state or change `selectedPhone`; a stale
 * result (or a stale failure) is dropped entirely.
 *
 * The callback receives the new state together with the number to select, so
 * the caller never has to reconcile a stale selection itself.
 */
export const createPhoneOptionsLoader = (options: {
  transport: PhoneOptionsTransport;
  onState: (state: PhoneOptionsLoadState, selectedPhone: string) => void;
}): PhoneOptionsLoader => {
  let latestRequestId = 0;

  const load = async (): Promise<void> => {
    latestRequestId += 1;
    const requestId = latestRequestId;

    options.onState({ kind: 'LOADING' }, '');

    try {
      const response = await options.transport();

      if (requestId !== latestRequestId) {
        return;
      }

      const nextState = resolvePhoneOptionsLoadState(response);

      options.onState(
        nextState,
        nextState.kind === 'READY' ? nextState.selectedPhone : '',
      );
    } catch {
      if (requestId !== latestRequestId) {
        return;
      }

      options.onState({ kind: 'ERROR' }, '');
    }
  };

  return { load };
};
