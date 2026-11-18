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

  const header = createElement(
    View,
    { style: styles.tableHeader },
    createElement(Text, { style: [styles.cellDescription, RTL_TEXT_STYLE] }, 'شرح کالا یا خدمت'),
    createElement(Text, { style: [styles.cellQuantity, RTL_TEXT_STYLE] }, 'تعداد'),
    createElement(Text, { style: [styles.cellPrice, RTL_TEXT_STYLE] }, 'مبلغ'),
  );

  const rows = input.lines.map((line, index) =>
    createElement(
      View,
      { key: index, style: styles.tableRow, wrap: false },
      createElement(Text, { style: [styles.cellDescription, RTL_TEXT_STYLE] }, line.description),
      createElement(Text, { style: [styles.cellQuantity, RTL_TEXT_STYLE] }, line.quantity),
      createElement(Text, { style: [styles.cellPrice, RTL_TEXT_STYLE] }, line.unitPrice),
    ),
  );

  const page = createElement(
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
    header,
    ...rows,
    createElement(
      View,
      { style: styles.totalRow },
      createElement(Text, { style: RTL_TEXT_STYLE }, 'جمع کل'),
      createElement(Text, { style: RTL_TEXT_STYLE }, input.total),
    ),
    createElement(
      Text,
      { style: styles.footer, fixed: true },
      'این پیش‌فاکتور سند مالی نیست',
    ),
  );

  return createElement(
    Document,
    {
      title: input.title,
      author: 'quotation-spike',
      subject: input.number,
    },
    page,
  ) as ReactElement<DocumentProps>;
};

