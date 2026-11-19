import {
  buildQuotationShareDetail,
  buildQuotationShareMessage,
  isQuotationShareChannel,
  isValidBaleChatId,
  resolveQuotationShareDelivery,
} from 'src/modules/quotation/utils/quotation-share.util';

describe('quotation-share.util', () => {
  it('accepts the seven product messenger channels', () => {
    expect(isQuotationShareChannel('BALE')).toBe(true);
    expect(isQuotationShareChannel('WHATSAPP')).toBe(true);
    expect(isQuotationShareChannel('SMS')).toBe(false);
  });

  it('resolves BALE to PROVIDER delivery and others to MANUAL_SHARE', () => {
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

  it('validates numeric Bale chat ids', () => {
    expect(isValidBaleChatId('183266491')).toBe(true);
    expect(isValidBaleChatId('bad')).toBe(false);
  });

  it('builds Persian share text with document number and link', () => {
    const text = buildQuotationShareMessage({
      channel: 'BALE',
      quotationNumber: 'QF-100',
      quotationTitle: 'پیشنهاد فروش',
      customerLabel: 'شرکت نمونه',
      viewUrl: 'http://localhost:3002/s/quotation/customer-view?token=abc',
    });

    expect(text).toContain('شماره سند: QF-100');
    expect(text).toContain('کانال: بله');
  });

  it('builds log-safe detail without the raw token or view URL', () => {
    const detail = buildQuotationShareDetail({
      channel: 'BALE',
      quotationId: 'q-1',
      linkId: 'link-1',
      outcome: 'PROVIDER_SENT',
      providerMessageId: '99',
    });

    expect(detail).toContain('providerMessageId=99');
    expect(detail).not.toContain('token=');
    expect(detail).not.toContain('customer-view');
  });
});
