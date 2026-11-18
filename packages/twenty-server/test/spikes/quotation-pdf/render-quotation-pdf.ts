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

// The logical string of every VISUAL line, in the order the document draws them. This is the
// single source of truth the `/ActualText` remedy attaches to the page, and it exists because a
// glyph cannot carry a character the font never encoded: the half-space has to come from here.
//
// A table row is one visual line even though it is drawn as several cells, so its cells are joined
// the way a reader reads them. The remedy asserts the count against what the page actually drew, so
// this function drifting from the document fails loudly instead of attaching the wrong text.
export const quotationSourceLines = (
  input: QuotationPdfSpikeInput,
): string[] => [
  input.title,
  ['شماره', input.number, '—', input.customerName].join('  '),
  ['کد کالا', input.sku].join('  '),
  ['شرح کالا یا خدمت', 'تعداد', 'مبلغ'].join('  '),
  ...input.lines.map((line) =>
    [line.description, line.quantity, line.unitPrice].join('  '),
  ),
  ['جمع کل', input.total].join('  '),
  'این پیش‌فاکتور سند مالی نیست',
];

