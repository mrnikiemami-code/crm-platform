// RazPayamak delivery-status model, per the official REST webservice document
// (`docs/providers/razpayamak-rest-webservice.pdf`, `GetDeliveries2`).
//
// `GetDeliveries2` is POSTed with `username`, `password` and `recID`, and
// returns `{ Value, RetStatus, StrRetStatus }` where `Value` is a numeric
// status code for that message. `RetStatus = 1` / `StrRetStatus = "Ok"` means
// the LOOKUP succeeded; the `Value` then carries the delivery state.

export type RazpayamakDeliveryState =
  /** `1`: reached the phone — the only true delivery confirmation. */
  | 'DELIVERED'
  /** `0`/`8`: accepted by the telecom operator, not yet on the phone. */
  | 'IN_TRANSIT'
  /** `200`: sent. */
  | 'SENT'
  /** `400`: queued for sending. */
  | 'PENDING'
  /** `2`/`16`: not reached the phone / the operator. */
  | 'NOT_DELIVERED'
  /** `3`/`5`/`35`/`300`/`500`: a definite failure. */
  | 'FAILED'
  /** `100`/`-1`: the operator did not report a determinate status. */
  | 'UNKNOWN';

// The document's numeric vocabulary, mapped to an app-owned state. Kept
// explicit so an unmapped number becomes UNKNOWN rather than a wrong claim.
const CODE_TO_DELIVERY_STATE: Record<number, RazpayamakDeliveryState> = {
  [-111]: 'FAILED',
  [-110]: 'FAILED',
  [-109]: 'FAILED',
  [-108]: 'FAILED',
  0: 'IN_TRANSIT',
  1: 'DELIVERED',
  2: 'NOT_DELIVERED',
  3: 'FAILED',
  5: 'FAILED',
  8: 'IN_TRANSIT',
  16: 'NOT_DELIVERED',
  35: 'FAILED',
  100: 'UNKNOWN',
  200: 'SENT',
  300: 'FAILED',
  400: 'PENDING',
  500: 'FAILED',
  [-1]: 'UNKNOWN',
};

export type RazpayamakDeliveryResult =
  | {
      state: RazpayamakDeliveryState;
      /** The numeric provider status code, when one was returned. */
      providerCode?: number;
    }
  /** The lookup itself could not be interpreted (transport, non-JSON, ...). */
  | { state: 'LOOKUP_FAILED' };

export const parseRazpayamakDeliveryStatus = (
  value: string | number | undefined,
): RazpayamakDeliveryResult => {
  if (value === undefined || value === null) {
    return { state: 'LOOKUP_FAILED' };
  }

  const numeric = typeof value === 'number' ? value : Number.parseInt(value, 10);

  if (!Number.isFinite(numeric)) {
    return { state: 'LOOKUP_FAILED' };
  }

  return {
    state: CODE_TO_DELIVERY_STATE[numeric] ?? 'UNKNOWN',
    providerCode: numeric,
  };
};

/** Whether a state is a truthful confirmation the message reached the phone. */
export const isDeliveredState = (state: RazpayamakDeliveryState): boolean =>
  state === 'DELIVERED';
