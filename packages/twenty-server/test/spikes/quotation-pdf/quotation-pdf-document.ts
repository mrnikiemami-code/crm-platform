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
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: { flexDirection: 'row', paddingVertical: 2 },
  cellDescription: { flexGrow: 1, textAlign: 'right' },
  cellQuantity: { width: 60, textAlign: 'center' },
  cellPrice: { width: 110, textAlign: 'left' },
  totalRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#d0d0d0',
    justifyContent: 'space-between',
  },
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

// Every visual line of this document is ONE text element. That is a deliberate constraint, not a
// layout shortcut: a line drawn as several elements (a table row of three cells) is emitted as
// several content runs, and a `/ActualText` remedy can then only attach the line's text to one of
// them, which duplicates or loses the others. Joining the cells keeps one run per line so the
// remedy is exact — and an extractor sees a row as one line, which is how a reader reads it anyway.
const lineOf = (...parts: string[]): string => parts.join('  ');

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
        lineOf('شماره', input.number, '—', input.customerName),
      ),
      createElement(
        Text,
        { style: [styles.meta, RTL_TEXT_STYLE] },
        lineOf('کد کالا', input.sku),
      ),
      createElement(
        Text,
        { style: [styles.tableRow, RTL_TEXT_STYLE] },
        lineOf('شرح کالا یا خدمت', 'تعداد', 'مبلغ'),
      ),
      ...input.lines.map((line, index) =>
        createElement(
          Text,
          { key: index, style: [styles.tableRow, RTL_TEXT_STYLE] },
          lineOf(line.description, line.quantity, line.unitPrice),
        ),
      ),
      createElement(
        Text,
        { style: [styles.totalRow, RTL_TEXT_STYLE] },
        lineOf('جمع کل', input.total),
      ),
      createElement(
        Text,
        { style: styles.footer, fixed: true },
        'این پیش‌فاکتور سند مالی نیست',
      ),
    ),
  ) as ReactElement<DocumentProps>;
};

