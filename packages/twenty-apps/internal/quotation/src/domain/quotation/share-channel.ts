// Share channels offered on a quotation. These are product channels, not
// Communication provider ids: Communication today only registers SMS providers
// (kavenegar / razpayamak). Messenger channels therefore resolve to manual
// share until a real provider is registered for that channel.

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

// Channels that Communication's provider registry can actually carry today.
// Keep aligned with `communication` `CommunicationChannel` + registered
// providers — do not invent messenger success here.
const COMMUNICATION_SENDABLE_CHANNELS = new Set<string>(['SMS']);

export type QuotationShareDelivery =
  | { kind: 'MANUAL_SHARE' }
  | { kind: 'PROVIDER'; communicationChannel: string };

export const isQuotationShareChannel = (
  value: string,
): value is QuotationShareChannel =>
  (QUOTATION_SHARE_CHANNELS as readonly string[]).includes(value);

export const resolveQuotationShareDelivery = (
  channel: QuotationShareChannel,
): QuotationShareDelivery => {
  // No messenger maps onto Communication's SMS channel. When a real Bale /
  // WhatsApp / … provider is registered, map it here and call Send/Persist.
  if (COMMUNICATION_SENDABLE_CHANNELS.has(channel)) {
    return { kind: 'PROVIDER', communicationChannel: channel };
  }

  return { kind: 'MANUAL_SHARE' };
};
