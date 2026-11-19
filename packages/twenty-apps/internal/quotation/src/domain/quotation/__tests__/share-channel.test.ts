import { describe, expect, it } from 'vitest';

import {
  buildQuotationShareLogSummary,
  buildQuotationShareMessage,
} from 'src/domain/quotation/share-message';
import {
  QUOTATION_SHARE_CHANNELS,
  resolveQuotationShareDelivery,
} from 'src/domain/quotation/share-channel';

describe('quotation share channels', () => {
  it('lists the seven messenger channels from the product brief', () => {
    expect([...QUOTATION_SHARE_CHANNELS]).toEqual([
      'BALE',
      'WHATSAPP',
      'TELEGRAM',
      'INSTAGRAM',
      'EITAA',
      'RUBIKA',
      'SOROUSH',
    ]);
  });

  it('resolves BALE to PROVIDER and other messengers to MANUAL_SHARE', () => {
    expect(resolveQuotationShareDelivery('BALE')).toEqual({
      kind: 'PROVIDER',
      communicationChannel: 'BALE',
      providerId: 'bale',
    });

    for (const channel of [
      'WHATSAPP',
      'TELEGRAM',
      'INSTAGRAM',
      'EITAA',
      'RUBIKA',
      'SOROUSH',
    ] as const) {
      expect(resolveQuotationShareDelivery(channel)).toEqual({
        kind: 'MANUAL_SHARE',
      });
    }
  });

  it('builds Persian share copy with number and secure link', () => {
    const text = buildQuotationShareMessage({
      channel: 'BALE',
      quotationNumber: 'QF-9',
      quotationTitle: 'پیشنهاد',
      customerLabel: 'علی',
      viewUrl: 'https://example.test/s/quotation/customer-view?token=secret',
    });

    expect(text).toContain('شماره سند: QF-9');
    expect(text).toContain('کانال: بله');
    expect(text).toContain('token=secret');
  });

  it('keeps public log summary free of token and secret URL', () => {
    const summary = buildQuotationShareLogSummary({
      channel: 'BALE',
      quotationId: 'q-1',
      linkId: 'link-9',
      outcome: 'PROVIDER_SENT',
    });

    expect(summary).toContain('linkId=link-9');
    expect(summary).not.toContain('token');
    expect(summary).not.toContain('customer-view');
  });
});
