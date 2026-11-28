import { type CustomerQuotationView } from 'src/domain/quotation/customer-view';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const renderCustomerQuotationHtml = (
  view: CustomerQuotationView,
): string => {
  const linesHtml = view.lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.name)}</td>
        <td>${escapeHtml(line.kindLabel)}</td>
        <td>${escapeHtml(line.unit)}</td>
        <td>${escapeHtml(line.quantityDisplay)}</td>
        <td>${escapeHtml(line.unitPriceDisplay)}</td>
        <td>${escapeHtml(line.lineTotalDisplay)}</td>
      </tr>`,
    )
    .join('');

  const row = (label: string, value: string | null) =>
    value
      ? `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
      : '';

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(view.title)}</title>
  <style>
    body { font-family: Tahoma, "Segoe UI", sans-serif; margin: 0; background: #f6f7f9; color: #1a1a1a; }
    main { max-width: 920px; margin: 24px auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    .meta { color: #555; font-size: 14px; line-height: 1.8; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #eee; padding: 10px 8px; text-align: right; vertical-align: top; }
    th { background: #fafafa; font-weight: 650; }
    .totals { margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; justify-content: space-between; gap: 16px; font-size: 14px; }
    .payable { border-top: 1px solid #ddd; padding-top: 10px; font-size: 16px; }
    .note { margin-top: 24px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(view.title)}</h1>
    <div class="meta">
      <div>شماره: ${escapeHtml(view.quotationNumber ?? '—')}</div>
      <div>وضعیت: ${escapeHtml(view.statusLabel)}</div>
      <div>مشتری: ${escapeHtml(view.customerLabel)}</div>
      <div>شرایط پرداخت: ${escapeHtml(view.paymentTerms ?? '—')}</div>
      ${view.validUntilDisplay ? `<div>اعتبار پیش‌فاکتور تا: ${escapeHtml(view.validUntilDisplay)}</div>` : ''}
      ${view.paymentDueDisplay ? `<div>سررسید پرداخت: ${escapeHtml(view.paymentDueDisplay)}</div>` : ''}
      ${view.deliveryTerms ? `<div>شرایط تحویل: ${escapeHtml(view.deliveryTerms)}</div>` : ''}
      ${view.visitorName ? `<div>بازدیدکننده: ${escapeHtml(view.visitorName)}</div>` : ''}
      ${view.priceListName ? `<div>فهرست قیمت: ${escapeHtml(view.priceListName)}</div>` : ''}
      ${view.issuerDisplay ? `<div>صادرکننده: ${escapeHtml(view.issuerDisplay)}</div>` : ''}
      ${view.documentNotes ? `<div>یادداشت: ${escapeHtml(view.documentNotes)}</div>` : ''}
    </div>
    ${view.issuedHint ? `<p class="note">${escapeHtml(view.issuedHint)}</p>` : ''}
    <table>
      <thead>
        <tr>
          <th>عنوان</th>
          <th>نوع</th>
          <th>واحد</th>
          <th>تعداد</th>
          <th>قیمت واحد</th>
          <th>جمع ردیف</th>
        </tr>
      </thead>
      <tbody>
        ${linesHtml || '<tr><td colspan="6">ردیفی ثبت نشده است</td></tr>'}
      </tbody>
    </table>
    <div class="totals">
      ${row('ناخالص', view.grossDisplay)}
      ${row('تخفیف ردیف‌ها', view.lineDiscountDisplay)}
      ${row('تخفیف کل', view.documentDiscountDisplay)}
      ${row('مالیات و عوارض', view.taxDisplay)}
      ${row('تعدیل گردکردن', view.roundingDisplay)}
      <div class="row payable"><span>مبلغ نهایی قابل پرداخت</span><strong>${escapeHtml(view.totalDisplay)}</strong></div>
    </div>
    <p class="note">این صفحه فقط‌خواندنی است و برای مشاهدهٔ پیش‌فاکتور شما صادر شده است. اطلاعات داخلی سامانه در آن نمایش داده نمی‌شود.</p>
  </main>
</body>
</html>`;
};

export const renderCustomerLinkErrorHtml = (
  title: string,
  detail: string,
): string => `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Tahoma, "Segoe UI", sans-serif; background: #f6f7f9; color: #1a1a1a; }
    main { max-width: 520px; margin: 64px auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
    h1 { margin: 0 0 12px; font-size: 20px; }
    p { margin: 0; color: #555; line-height: 1.7; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(detail)}</p>
  </main>
</body>
</html>`;
