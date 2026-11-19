import {
  QUOTATION_SHARE_CHANNEL_LABELS,
  type QuotationShareChannel,
} from 'src/domain/quotation/share-channel';

export type QuotationShareMessageInput = {
  channel: QuotationShareChannel;
  quotationNumber: string | null;
  quotationTitle: string | null;
  customerLabel: string;
  viewUrl: string;
};

// Operator-facing Persian body for messenger paste. Includes the secure link
// once; callers must not write this string into public server logs.
export const buildQuotationShareMessage = ({
  channel,
  quotationNumber,
  quotationTitle,
  customerLabel,
  viewUrl,
}: QuotationShareMessageInput): string => {
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

// Log-safe summary: never includes the raw token or full view URL.
export const buildQuotationShareLogSummary = ({
  channel,
  quotationId,
  linkId,
  outcome,
}: {
  channel: QuotationShareChannel;
  quotationId: string;
  linkId: string;
  outcome: string;
}): string =>
  `quotation-share channel=${channel} outcome=${outcome} quotationId=${quotationId} linkId=${linkId}`;
