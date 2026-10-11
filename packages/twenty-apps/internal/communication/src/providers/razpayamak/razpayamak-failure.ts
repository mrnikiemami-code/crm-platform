// Stable, app-owned classification of a RazPayamak send failure, derived from
// the official REST webservice document
// (`docs/providers/razpayamak-rest-webservice.pdf`).
//
// The document reports a failure either as a numeric `Value` code (on an
// HTTP 2xx response with `RetStatus != 1`) or as a `ReqStatus` code (on an
// HTTP 400 response). Both share the same numeric vocabulary, so they are
// normalized into one model here.
//
// The provider's own human-readable `Message`, when present, is NEVER trusted
// as translated copy: it is carried separately as sanitized untrusted detail.
// The application shows its own translated copy keyed by the stable code.

export type RazpayamakFailureCode =
  | 'INVALID_REQUESTER_IP'
  | 'API_KEY_REQUIRED'
  | 'ALLOWED_IP_NOT_CONFIGURED'
  | 'IP_BLOCKED'
  | 'INVALID_CREDENTIALS'
  | 'INSUFFICIENT_CREDIT'
  | 'DAILY_LIMIT_REACHED'
  | 'VOLUME_LIMIT_REACHED'
  | 'INVALID_SENDER'
  | 'PROVIDER_MAINTENANCE'
  | 'FILTERED_WORD'
  | 'PUBLIC_LINE_NOT_ALLOWED'
  | 'INACTIVE_USER'
  | 'NOT_SENT'
  | 'INCOMPLETE_DOCUMENTS'
  | 'MESSAGE_CONTAINS_LINK'
  | 'OPT_OUT_MISSING'
  | 'RECIPIENT_NOT_FOUND'
  | 'EMPTY_MESSAGE'
  | 'INVALID_MOBILE'
  | 'MISMATCHED_ARRAY_LENGTHS'
  | 'UNKNOWN_PROVIDER_ERROR';

// The numeric vocabulary from the document. Negative codes are the
// request-level / IP-level failures; non-negative codes are the send-level
// failures. Both the `Value` (2xx) and `ReqStatus` (400) paths use it.
const CODE_TO_FAILURE: Record<number, RazpayamakFailureCode> = {
  [-111]: 'INVALID_REQUESTER_IP',
  [-110]: 'API_KEY_REQUIRED',
  [-109]: 'ALLOWED_IP_NOT_CONFIGURED',
  [-108]: 'IP_BLOCKED',
  0: 'INVALID_CREDENTIALS',
  2: 'INSUFFICIENT_CREDIT',
  3: 'DAILY_LIMIT_REACHED',
  4: 'VOLUME_LIMIT_REACHED',
  5: 'INVALID_SENDER',
  6: 'PROVIDER_MAINTENANCE',
  7: 'FILTERED_WORD',
  9: 'PUBLIC_LINE_NOT_ALLOWED',
  10: 'INACTIVE_USER',
  11: 'NOT_SENT',
  12: 'INCOMPLETE_DOCUMENTS',
  14: 'MESSAGE_CONTAINS_LINK',
  15: 'OPT_OUT_MISSING',
  16: 'RECIPIENT_NOT_FOUND',
  17: 'EMPTY_MESSAGE',
  18: 'INVALID_MOBILE',
};

// NOTE: the document's `1` means SUCCESS for both `Value` and `ReqStatus`, so it
// is deliberately NOT in this map. It is only ever treated as success (the
// provider checks `RetStatus === 1` first), and any other unrecognized number
// falls through to `UNKNOWN_PROVIDER_ERROR`.

export const parseRazpayamakFailureCode = (
  value: string | number | undefined,
): { code: RazpayamakFailureCode; providerCode: number } | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const numeric = typeof value === 'number' ? value : Number.parseInt(value, 10);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  const code = CODE_TO_FAILURE[numeric] ?? 'UNKNOWN_PROVIDER_ERROR';

  return { code, providerCode: numeric };
};

// Whether a failure code is a request-level/credential problem (as opposed to a
// per-recipient send problem). Kept explicit so callers can present the right
// guidance without re-deriving it from the number.
export const isConfigurationFailure = (
  code: RazpayamakFailureCode,
): boolean =>
  code === 'INVALID_REQUESTER_IP' ||
  code === 'API_KEY_REQUIRED' ||
  code === 'ALLOWED_IP_NOT_CONFIGURED' ||
  code === 'IP_BLOCKED' ||
  code === 'INVALID_CREDENTIALS' ||
  code === 'INACTIVE_USER' ||
  code === 'INCOMPLETE_DOCUMENTS' ||
  code === 'INVALID_SENDER' ||
  code === 'PUBLIC_LINE_NOT_ALLOWED';

// Bounds and sanitizes provider-supplied text so it can be shown only as
// untrusted detail: control characters are stripped, it is trimmed and capped,
// and the numeric provider code (never a credential) is what carries meaning.
export const sanitizeProviderDetail = (
  raw: string | undefined,
  maxLength = 300,
): string | undefined => {
  if (typeof raw !== 'string') {
    return undefined;
  }

  // eslint-disable-next-line no-control-regex
  const withoutControl = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();

  if (withoutControl.length === 0) {
    return undefined;
  }

  return withoutControl.slice(0, maxLength);
};
