import { describe, expect, it } from 'vitest';

import { renderCustomerQuotationHtml } from 'src/utils/render-customer-quotation-html';

describe('customer HTML commercial parity', () => {
  it('renders sealed commercial and issuer fields in Persian RTL', () => {
    const html = renderCustomerQuotationHtml({
      quotationNumber: 'Q-100',
      title: 'پیش‌فاکتور تجاری',
      statusLabel: 'ارسال‌شده',
      customerLabel: 'شرکت نمونه',
      paymentTerms: 'نقد',
      paymentDueDisplay: '1404/01/15',
      deliveryTerms: 'ارسال زمینی',
      documentNotes: 'یادداشت مهر',
      visitorName: 'بازدیدکننده',
      priceListName: 'فهرست اصلی',
      issuerDisplay: 'شرکت صادرکننده',
      validUntilDisplay: '1404/02/01',
      currencyLabel: 'ریال',
      lines: [
        {
          name: 'کالا',
          kindLabel: 'کالا',
          unit: 'عدد',
          quantityDisplay: '2',
          unitPriceDisplay: '1٬000 ریال',
          lineTotalDisplay: '2٬000 ریال',
        },
      ],
      grossDisplay: '2٬000 ریال',
      lineDiscountDisplay: null,
      documentDiscountDisplay: null,
      taxDisplay: null,
      roundingDisplay: null,
      totalDisplay: '2٬000 ریال',
      issuedHint: null,
    });

    expect(html).toContain('dir="rtl"');
    expect(html).toContain('سررسید پرداخت: 1404/01/15');
    expect(html).toContain('شرایط تحویل: ارسال زمینی');
    expect(html).toContain('فهرست قیمت: فهرست اصلی');
    expect(html).toContain('صادرکننده: شرکت صادرکننده');
    expect(html).toContain('یادداشت: یادداشت مهر');
  });
});
