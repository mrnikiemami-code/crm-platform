// Keep aligned with
// packages/twenty-apps/internal/quotation/src/domain/quotation/share-channel.ts
// and share-message.ts. Nest must not invent a parallel send stack: delivery
// resolves against Communication's real channel + registered providers.

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

// Share channel → Communication registry mapping. Only channels with a real
// registered provider appear here (Bale as of S3-R4).
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
  providerMessageId,
}: {
  channel: QuotationShareChannel;
  quotationId: string;
  linkId: string;
  outcome: QuotationShareOutcome;
  providerMessageId?: string | null;
}): string => {
  const base = `channel=${channel}; outcome=${outcome}; quotationId=${quotationId}; linkId=${linkId}`;

  if (
    typeof providerMessageId === 'string' &&
    providerMessageId.trim() !== ''
  ) {
    return `${base}; providerMessageId=${providerMessageId.trim()}`;
  }

  return base;
};
