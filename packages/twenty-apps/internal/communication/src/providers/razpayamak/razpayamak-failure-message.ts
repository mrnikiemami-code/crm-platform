import { type RazpayamakFailureCode } from 'src/providers/razpayamak/razpayamak-failure';

// Maps each stable failure code to the application's OWN English source copy.
// The fa-IR catalog translates these exact strings, so a caller resolves the
// message with the runtime `t(...)` and never shows the provider's untranslated
// text as if it were translated. The provider's own `Message` is separate,
// sanitized untrusted detail.
export const RAZPAYAMAK_FAILURE_MESSAGE: Record<
  RazpayamakFailureCode,
  string
> = {
  INVALID_REQUESTER_IP: 'RazPayamak failure: invalid requester IP.',
  API_KEY_REQUIRED:
    'RazPayamak failure: ApiKey is required instead of a password.',
  ALLOWED_IP_NOT_CONFIGURED:
    'RazPayamak failure: the allowed API IP is not configured.',
  IP_BLOCKED:
    'RazPayamak failure: the IP is blocked after failed API attempts.',
  INVALID_CREDENTIALS: 'RazPayamak failure: incorrect username or API key.',
  INSUFFICIENT_CREDIT: 'RazPayamak failure: insufficient credit.',
  DAILY_LIMIT_REACHED: 'RazPayamak failure: daily sending limit reached.',
  VOLUME_LIMIT_REACHED: 'RazPayamak failure: sending-volume limit reached.',
  INVALID_SENDER: 'RazPayamak failure: invalid sender number.',
  PROVIDER_MAINTENANCE: 'RazPayamak failure: the provider is under maintenance.',
  FILTERED_WORD: 'RazPayamak failure: the message contains a filtered word.',
  PUBLIC_LINE_NOT_ALLOWED:
    'RazPayamak failure: public sender lines cannot use this webservice.',
  INACTIVE_USER: 'RazPayamak failure: the user is not active.',
  NOT_SENT: 'RazPayamak failure: the message was not sent.',
  INCOMPLETE_DOCUMENTS: 'RazPayamak failure: the user documents are incomplete.',
  MESSAGE_CONTAINS_LINK: 'RazPayamak failure: the message contains a link.',
  OPT_OUT_MISSING:
    'RazPayamak failure: the required opt-out text is missing.',
  RECIPIENT_NOT_FOUND: 'RazPayamak failure: no recipient was found.',
  EMPTY_MESSAGE: 'RazPayamak failure: the message is empty.',
  INVALID_MOBILE: 'RazPayamak failure: the mobile number is invalid.',
  MISMATCHED_ARRAY_LENGTHS:
    'RazPayamak failure: the message and number counts do not match.',
  UNKNOWN_PROVIDER_ERROR:
    'RazPayamak failure: an unrecognized provider error occurred.',
};

export const resolveRazpayamakFailureMessage = (
  failureCode: string | undefined,
): string | undefined =>
  failureCode !== undefined &&
  failureCode in RAZPAYAMAK_FAILURE_MESSAGE
    ? RAZPAYAMAK_FAILURE_MESSAGE[
        failureCode as RazpayamakFailureCode
      ]
    : undefined;
