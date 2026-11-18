import { createElement, type ReactElement } from 'react';

import {
  Document,
  type DocumentProps,
  Page,
  Text,
  renderToBuffer,
} from '@react-pdf/renderer';

import {
  SPIKE_FONT_FAMILY,
  buildQuotationPdfSpikeDocument,
  registerQuotationSpikeFont,
  type QuotationPdfSpikeInput,
} from './quotation-pdf-document';

// renderToBuffer keeps the whole path server-side: @react-pdf/renderer lays the
// page out with its own engine and needs no DOM, no browser and no headless
// Chromium. That is the property S2 depends on, so it is the property the spike
// renders through.
export const renderQuotationPdfSpike = (
  input: QuotationPdfSpikeInput,
): Promise<Buffer> => renderToBuffer(buildQuotationPdfSpikeDocument(input));

// Renders one bare RTL line. Used to isolate a single script property — the
// contextual shaping of repeated letters — from the table layout of the full
// document, where a failure would be ambiguous.
export const renderPersianProbeText = (text: string): Promise<Buffer> => {
  registerQuotationSpikeFont();

  return renderToBuffer(
    createElement(
      Document,
      {},
      createElement(
        Page,
        {
          size: 'A4',
          style: { padding: 40, fontFamily: SPIKE_FONT_FAMILY, fontSize: 14 },
        },
        createElement(
          Text,
          { style: { direction: 'rtl', textAlign: 'right' } },
          text,
        ),
      ),
    ) as ReactElement<DocumentProps>,
  );
};

export const SPIKE_SAMPLE_INPUT: QuotationPdfSpikeInput = {
  title: 'پیش‌فاکتور فروش کالا و خدمات',
  number: '۱۴۰۳-۰۰۰۱۲۳',
  customerName: 'شرکت نمونه بازرگانی',
  sku: 'SKU-4417',
  lines: [
    { description: 'کابل شبکه کت ۶', quantity: '۱۲', unitPrice: '۲٬۴۵۰٬۰۰۰' },
    {
      description: 'خدمت نصب و راه‌اندازی',
      quantity: '۱',
      unitPrice: '۱۸٬۰۰۰٬۰۰۰',
    },
  ],
  total: '۴۷٬۴۰۰٬۰۰۰',
};

// Logical strings the document must be able to recover. Table cells are independent runs
// (real columns), so extractors may return them as separate items — callers join as needed.
export const quotationSourceStrings = (
  input: QuotationPdfSpikeInput,
): string[] => [
  input.title,
  input.number,
  input.customerName,
  input.sku,
  'شرح کالا یا خدمت',
  'تعداد',
  'مبلغ',
  ...input.lines.flatMap((line) => [
    line.description,
    line.quantity,
    line.unitPrice,
  ]),
  'جمع کل',
  input.total,
  'این پیش\u200cفاکتور سند مالی نیست',
];

// Kept for the S1-R2 ActualText proof, which still joins cells into visual lines.
export const quotationSourceLines = (
  input: QuotationPdfSpikeInput,
): string[] => [
  input.title,
  `شماره ${input.number} — ${input.customerName}`,
  `کد کالا ${input.sku}`,
  'شرح کالا یا خدمت',
  'تعداد',
  'مبلغ',
  ...input.lines.flatMap((line) => [
    line.description,
    line.quantity,
    line.unitPrice,
  ]),
  'جمع کل',
  input.total,
  'این پیش\u200cفاکتور سند مالی نیست',
];

