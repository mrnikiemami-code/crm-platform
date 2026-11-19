// Share channels offered on a quotation. These are product channels, not
// Communication provider ids. Delivery resolves only when Communication has a
// registered provider for that channel (Bale as of S3-R4).

export const QUOTATION_SHARE_CHANNELS = [
  'BALE',
  'WHATSAPP',
  'TELEGRAM',
  'INSTAGRAM',
  'EITAA',
  'RUBIKA',
  'SOROUSH',
] as const;

export type QuotationShareChannel =
  (typeof QUOTATION_SHARE_CHANNELS)[number];

export const QUOTATION_SHARE_CHANNEL_LABELS: Record<
  QuotationShareChannel,
  string
> = {
  BALE: 'بله',
  WHATSAPP: 'واتساپ',
  TELEGRAM: 'تلگرام',
  INSTAGRAM: 'اینستاگرام',
  EITAA: 'ایتا',
  RUBIKA: 'روبیکا',
  SOROUSH: 'سروش',
};

export const QUOTATION_SHARE_OUTCOMES = [
  'MANUAL_SHARE',
  'PROVIDER_SENT',
  'PROVIDER_FAILED',
  'REFUSED',
] as const;

export type QuotationShareOutcome = (typeof QUOTATION_SHARE_OUTCOMES)[number];

export const QUOTATION_SHARE_OUTCOME_LABELS: Record<
  QuotationShareOutcome,
  string
> = {
  MANUAL_SHARE: 'اشتراک‌گذاری دستی',
  PROVIDER_SENT: 'ارسال‌شده توسط ارائه‌دهنده',
  PROVIDER_FAILED: 'ارسال ناموفق',
  REFUSED: 'رد شده',
};

const SHARE_PROVIDER_BY_CHANNEL: Partial<
  Record<
    QuotationShareChannel,
    { communicationChannel: 'BALE'; providerId: 'bale' }
  >
> = {
  BALE: { communicationChannel: 'BALE', providerId: 'bale' },
};

export type QuotationShareDelivery =
  | { kind: 'MANUAL_SHARE' }
  | {
      kind: 'PROVIDER';
      communicationChannel: 'BALE';
      providerId: 'bale';
    };

export const isQuotationShareChannel = (
  value: string,
): value is QuotationShareChannel =>
  (QUOTATION_SHARE_CHANNELS as readonly string[]).includes(value);

export const isValidBaleChatId = (value: string): boolean =>
  /^-?\d+$/.test(value.trim());

export const resolveQuotationShareDelivery = (
  channel: QuotationShareChannel,
): QuotationShareDelivery => {
  const mapped = SHARE_PROVIDER_BY_CHANNEL[channel];

  if (mapped !== undefined) {
    return { kind: 'PROVIDER', ...mapped };
  }

  return { kind: 'MANUAL_SHARE' };
};
