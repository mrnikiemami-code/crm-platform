import {
  buildQuotationShareDetail,
  buildQuotationShareMessage,
  isQuotationShareChannel,
  resolveQuotationShareDelivery,
} from 'src/modules/quotation/utils/quotation-share.util';

describe('quotation-share.util', () => {
  it('accepts the seven product messenger channels', () => {
    expect(isQuotationShareChannel('BALE')).toBe(true);
    expect(isQuotationShareChannel('WHATSAPP')).toBe(true);
    expect(isQuotationShareChannel('TELEGRAM')).toBe(true);
    expect(isQuotationShareChannel('INSTAGRAM')).toBe(true);
    expect(isQuotationShareChannel('EITAA')).toBe(true);
    expect(isQuotationShareChannel('RUBIKA')).toBe(true);
    expect(isQuotationShareChannel('SOROUSH')).toBe(true);
    expect(isQuotationShareChannel('SMS')).toBe(false);
  });

  it('resolves all messenger channels to MANUAL_SHARE (no fake provider)', () => {
    for (const channel of [
      'BALE',
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

  it('builds Persian share text with document number and link', () => {
    const text = buildQuotationShareMessage({
      channel: 'TELEGRAM',
      quotationNumber: 'QF-100',
      quotationTitle: 'پیشنهاد فروش',
      customerLabel: 'شرکت نمونه',
      viewUrl: 'http://localhost:3002/s/quotation/customer-view?token=abc',
    });

    expect(text).toContain('شماره سند: QF-100');
    expect(text).toContain('مشتری: شرکت نمونه');
    expect(text).toContain('کانال: تلگرام');
    expect(text).toContain(
      'http://localhost:3002/s/quotation/customer-view?token=abc',
    );
  });

  it('builds log-safe detail without the raw token or view URL', () => {
    const detail = buildQuotationShareDetail({
      channel: 'BALE',
      quotationId: 'q-1',
      linkId: 'link-1',
      outcome: 'MANUAL_SHARE',
    });

    expect(detail).toContain('quotationId=q-1');
    expect(detail).toContain('linkId=link-1');
    expect(detail).not.toContain('token=');
    expect(detail).not.toContain('customer-view');
  });
});
