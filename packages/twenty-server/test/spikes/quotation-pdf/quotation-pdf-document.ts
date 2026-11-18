import { createElement, type ReactElement } from 'react';

import {
  Document,
  type DocumentProps,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';

import { applyPersianPdfTextLayerFixes } from './fontkit-zwnj-preservation';
import { resolvePersianFont } from './persian-font';

// Proves the EXISTING server PDF stack (@react-pdf/renderer, already a
// twenty-server dependency) can lay out a Persian quotation, so S2 does not have
// to introduce Chromium or a new renderer. createElement instead of JSX because
// the twenty-server build compiles with `tsx: false`.
//
// The document deliberately contains the three shapes a quotation cannot avoid:
// Persian prose, Persian digits inside a number column, and a Latin SKU inside
// RTL text (the direction-mixing case a naive "just reverse the string" breaks).

export const SPIKE_FONT_FAMILY = 'QuotationSpikePersian';

let fontsRegistered = false;

export const registerQuotationSpikeFont = (): void => {
  // Must run before any layout: fontkit otherwise maps ZWNJ → SPACE in ToUnicode,
  // and pdfkit otherwise emits multi-code-point ligatures that RTL extractors scramble.
  applyPersianPdfTextLayerFixes();

  if (fontsRegistered) {
    return;
  }

  const font = resolvePersianFont();

  Font.register({
    family: SPIKE_FONT_FAMILY,
    fonts: [
      {
        src: `data:font/ttf;base64,${font.bytes.toString('base64')}`,
      },
    ],
  });

  fontsRegistered = true;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: SPIKE_FONT_FAMILY,
    lineHeight: 1.6,
    color: '#1a1a1a',
  },
  heading: { fontSize: 16, marginBottom: 6, textAlign: 'right' },
  meta: { fontSize: 9, color: '#555555', marginBottom: 12, textAlign: 'right' },
  tableHeader: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 2,
  },
  cellDescription: { width: '55%', textAlign: 'right', paddingHorizontal: 4 },
  cellQuantity: { width: '15%', textAlign: 'center', paddingHorizontal: 4 },
  cellPrice: { width: '30%', textAlign: 'left', paddingHorizontal: 4 },
  totalRow: {
    flexDirection: 'row-reverse',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#d0d0d0',
  },
  totalLabel: { width: '55%', textAlign: 'right', paddingHorizontal: 4 },
  totalValue: { width: '45%', textAlign: 'left', paddingHorizontal: 4 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#888888',
    textAlign: 'center',
  },
});

export type QuotationPdfSpikeLine = {
  description: string;
  quantity: string;
  unitPrice: string;
};

export type QuotationPdfSpikeInput = {
  title: string;
  number: string;
  customerName: string;
  sku: string;
  lines: QuotationPdfSpikeLine[];
  total: string;
};

// `direction: 'rtl'` is the switch that matters: @react-pdf/stylesheet passes it
// through untouched, textkit derives the bidi embedding level from it, and it
// also defaults text alignment to the right.
const RTL_TEXT_STYLE = { direction: 'rtl' as const, textAlign: 'right' as const };

const tableCell = (
  style: object,
  text: string,
  key?: string,
): ReactElement =>
  createElement(
    View,
    { style, key },
    createElement(Text, { style: RTL_TEXT_STYLE }, text),
  );

export const buildQuotationPdfSpikeDocument = (
  input: QuotationPdfSpikeInput,
): ReactElement<DocumentProps> => {
  registerQuotationSpikeFont();

  return createElement(
    Document,
    {
      title: input.title,
      author: 'quotation-spike',
      subject: input.number,
    },
    createElement(
      Page,
      { size: 'A4', style: styles.page, wrap: true },
      createElement(Text, { style: [styles.heading, RTL_TEXT_STYLE] }, input.title),
      createElement(
        Text,
        { style: [styles.meta, RTL_TEXT_STYLE] },
        `شماره ${input.number} — ${input.customerName}`,
      ),
      createElement(
        Text,
        { style: [styles.meta, RTL_TEXT_STYLE] },
        `کد کالا ${input.sku}`,
      ),
      createElement(
        View,
        { style: styles.tableHeader },
        tableCell(styles.cellDescription, 'شرح کالا یا خدمت'),
        tableCell(styles.cellQuantity, 'تعداد'),
        tableCell(styles.cellPrice, 'مبلغ'),
      ),
      ...input.lines.map((line, index) =>
        createElement(
          View,
          { key: `line-${index}`, style: styles.tableRow },
          tableCell(styles.cellDescription, line.description),
          tableCell(styles.cellQuantity, line.quantity),
          tableCell(styles.cellPrice, line.unitPrice),
        ),
      ),
      createElement(
        View,
        { style: styles.totalRow },
        tableCell(styles.totalLabel, 'جمع کل'),
        tableCell(styles.totalValue, input.total),
      ),
      createElement(
        Text,
        { style: styles.footer, fixed: true },
        'این پیش‌فاکتور سند مالی نیست',
      ),
    ),
  ) as ReactElement<DocumentProps>;
};
