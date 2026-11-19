// Keep aligned with
// packages/twenty-apps/internal/quotation/src/domain/quotation/share-channel.ts
// and share-message.ts. Nest must not invent a parallel send stack: delivery
// resolves against Communication's real channel set (SMS only today).

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

export type QuotationShareOutcome =
  | 'MANUAL_SHARE'
  | 'PROVIDER_SENT'
  | 'PROVIDER_FAILED'
  | 'REFUSED';

// Mirrors CommunicationChannel + registered providers — SMS only.
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
  if (COMMUNICATION_SENDABLE_CHANNELS.has(channel)) {
    return { kind: 'PROVIDER', communicationChannel: channel };
  }

  return { kind: 'MANUAL_SHARE' };
};

export const buildQuotationShareMessage = ({
  channel,
  quotationNumber,
  quotationTitle,
  customerLabel,
  viewUrl,
}: {
  channel: QuotationShareChannel;
  quotationNumber: string | null;
  quotationTitle: string | null;
  customerLabel: string;
  viewUrl: string;
}): string => {
  const channelLabel = QUOTATION_SHARE_CHANNEL_LABELS[channel];
  const numberLabel =
    typeof quotationNumber === 'string' && quotationNumber.trim() !== ''
      ? quotationNumber.trim()
      : '—';
  const titleLabel =
    typeof quotationTitle === 'string' && quotationTitle.trim() !== ''
      ? quotationTitle.trim()
      : 'پیش‌فاکتور';

  return [
    `پیش‌فاکتور ${titleLabel}`,
    `شماره سند: ${numberLabel}`,
    `مشتری: ${customerLabel}`,
    `کانال: ${channelLabel}`,
    '',
    'برای مشاهدهٔ فقط‌خواندنی روی لینک زیر بزنید:',
    viewUrl,
  ].join('\n');
};

export const buildQuotationShareDetail = ({
  channel,
  quotationId,
  linkId,
  outcome,
}: {
  channel: QuotationShareChannel;
  quotationId: string;
  linkId: string;
  outcome: QuotationShareOutcome;
}): string =>
  `channel=${channel}; outcome=${outcome}; quotationId=${quotationId}; linkId=${linkId}`;
